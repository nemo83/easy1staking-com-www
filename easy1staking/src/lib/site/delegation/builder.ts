import * as Address from "@evolution-sdk/evolution/Address";
import * as Assets from "@evolution-sdk/evolution/Assets";
import * as Certificate from "@evolution-sdk/evolution/Certificate";
import * as KeyHash from "@evolution-sdk/evolution/KeyHash";
import * as PoolKeyHash from "@evolution-sdk/evolution/PoolKeyHash";
import * as Transaction from "@evolution-sdk/evolution/Transaction";
import * as TransactionBody from "@evolution-sdk/evolution/TransactionBody";
import * as TransactionHash from "@evolution-sdk/evolution/TransactionHash";
import * as TransactionInput from "@evolution-sdk/evolution/TransactionInput";
import * as TransactionWitnessSet from "@evolution-sdk/evolution/TransactionWitnessSet";
import * as TxOut from "@evolution-sdk/evolution/TxOut";
import { array, decode } from "./cbor";
import { EASY1_POOL_HASH, reviewBody } from "./guard";
import { GuardContext, GuardError, Input, requireGuard, Review } from "./types";

export type BuildCode = "ALREADY_DELEGATED" | "CORROBORATION" | "INSUFFICIENT_FUNDS" | "SINGLE_CHANGE" | "BUILD";
const messages: Record<BuildCode, string> = {
  ALREADY_DELEGATED: "This account already delegates to EASY1. No transaction is needed.",
  CORROBORATION: "Complete matching unspent input observations are required before building.",
  INSUFFICIENT_FUNDS: "Supported inputs cannot fund the deposit, fee and minimum change ADA.",
  SINGLE_CHANGE: "This wallet needs more change outputs than this delegation builder supports.",
  BUILD: "The stake transaction could not be constructed safely. Refresh and try again.",
};
export class BuildError extends Error {
  constructor(readonly code: BuildCode) { super(messages[code]); this.name = "BuildError"; }
}
export interface BuiltStakeTransaction {
  readonly unsignedHex: string;
  readonly review: Review;
}
const ZERO = BigInt(0), MAX_COIN = BigInt("45000000000000000"), MAX_ASSET = BigInt("9223372036854775807");
const ref = (i: Input) => `${i.txId}#${i.index}`;
function plain(value: unknown): asserts value is Record<string, unknown> {
  requireGuard(value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype, "CONTEXT");
}
function hex(value: unknown, min: number, max = min): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max && value.length % 2 === 0 && /^[0-9a-f]*$/.test(value);
}
function quantity(value: unknown, max = MAX_COIN): asserts value is bigint {
  requireGuard(typeof value === "bigint" && value >= ZERO && value <= max, "VALUE");
}
function input(value: Input): void {
  plain(value);
  requireGuard(hex(value.txId, 64), "INPUT"); quantity(value.index, BigInt(65535));
  requireGuard(hex(value.addressHex, 114) && value.addressHex.startsWith("01"), "ADDRESS");
  quantity(value.lovelace); plain(value.assets);
  requireGuard(Object.keys(value.assets).length <= 2048, "VALUE");
  for (const [unit, amount] of Object.entries(value.assets)) {
    requireGuard(hex(unit, 56, 120), "VALUE"); quantity(amount, MAX_ASSET); requireGuard(amount > ZERO, "VALUE");
  }
  requireGuard(value.datum === null || hex(value.datum, 2, 131072), "INPUT");
  requireGuard(value.referenceScript === null || hex(value.referenceScript, 2, 131072), "INPUT");
}
function sameInput(a: Input, b: Input): boolean {
  const units = Object.keys(a.assets);
  return a.txId === b.txId && a.index === b.index && a.addressHex === b.addressHex && a.lovelace === b.lovelace &&
    a.datum === b.datum && a.referenceScript === b.referenceScript && units.length === Object.keys(b.assets).length &&
    units.every((u) => a.assets[u] === b.assets[u]);
}
/** Bounds work before SDK allocation; the independent core remains the return authority. */
function candidates(c: GuardContext): Input[] {
  plain(c); requireGuard(c.networkId === 1, "NETWORK");
  requireGuard(c.registration === "registered" || c.registration === "unregistered", "CONTEXT");
  requireGuard(hex(c.changeAddressHex, 114) && c.changeAddressHex.startsWith("01") && hex(c.stakeKeyHash, 56), "ADDRESS");
  requireGuard(c.changeAddressHex.slice(58) === c.stakeKeyHash, "BINDING");
  plain(c.parameters); plain(c.constructionTip); plain(c.wallet); plain(c.provider);
  requireGuard(typeof c.constructionTip.slot === "bigint" && c.constructionTip.slot >= ZERO && c.constructionTip.slot <= BigInt(Number.MAX_SAFE_INTEGER) - BigInt(600), "VALIDITY");
  for (const q of [c.parameters.minFeeCoefficient, c.parameters.minFeeConstant, c.parameters.stakeDeposit,
    c.parameters.coinsPerUTxOByte, c.parameters.maxTxSize, c.parameters.maxValueSize]) {
    quantity(q); requireGuard(q > ZERO, "PARAMETERS");
  }
  requireGuard(c.parameters.maxTxSize <= BigInt(65536) && c.parameters.maxValueSize <= c.parameters.maxTxSize, "PARAMETERS");
  requireGuard(c.wallet.complete === true && Array.isArray(c.wallet.utxos) && Array.isArray(c.provider.utxos), "CONTEXT");
  const provider = new Map<string, Input>();
  for (const [list, isProvider] of [[c.wallet.utxos, false], [c.provider.utxos, true]] as const) {
    requireGuard(list.length > 0 && list.length <= 2048, "INPUT");
    const seen = new Set<string>();
    for (const i of list) {
      input(i); requireGuard(!seen.has(ref(i)), "INPUT"); seen.add(ref(i));
      if (isProvider) {
        requireGuard((i as Input & { unspent: unknown }).unspent === true, "INPUT"); provider.set(ref(i), i);
      }
    }
  }
  const eligible: Input[] = [];
  for (const i of c.wallet.utxos) {
    const p = provider.get(ref(i));
    if (!p || !sameInput(i, p)) throw new BuildError("CORROBORATION");
    if (i.referenceScript === null) eligible.push(i);
  }
  if (c.currentPoolHash === EASY1_POOL_HASH) throw new BuildError("ALREADY_DELEGATED");
  return eligible.sort((a, b) => {
    const tokens = Number(Object.keys(a.assets).length > 0) - Number(Object.keys(b.assets).length > 0);
    return tokens || (a.lovelace > b.lovelace ? -1 : a.lovelace < b.lovelace ? 1 : ref(a) < ref(b) ? -1 : ref(a) > ref(b) ? 1 : 0);
  });
}
function construct(context: GuardContext): BuiltStakeTransaction {
  const available = candidates(context), p = context.parameters;
  const address = Address.fromHex(context.changeAddressHex), stakeCredential = KeyHash.fromHex(context.stakeKeyHash);
  const poolKeyHash = PoolKeyHash.fromHex(EASY1_POOL_HASH);
  const deposit = context.registration === "registered" ? ZERO : p.stakeDeposit;
  const certificate = context.registration === "registered" ? new Certificate.StakeDelegation({ stakeCredential, poolKeyHash }) :
    new Certificate.StakeRegDelegCert({ stakeCredential, poolKeyHash, coin: deposit });
  const selected: Input[] = [], assets: Record<string, bigint> = {};
  let lovelace = ZERO;
  for (const next of available) {
    selected.push(next); lovelace += next.lovelace; quantity(lovelace);
    for (const [unit, amount] of Object.entries(next.assets)) {
      assets[unit] = (assets[unit] ?? ZERO) + amount; quantity(assets[unit], MAX_ASSET);
    }
    if (Object.keys(assets).length > 2048) throw new BuildError("SINGLE_CHANGE");
    const keys = new Set([context.stakeKeyHash, ...selected.map((i) => i.addressHex.slice(2, 58))]);
    const witnessSize = 2 + (keys.size < 24 ? 1 : keys.size < 256 ? 2 : 3) + 101 * keys.size;
    const inputs = selected.map((i) => new TransactionInput.TransactionInput({ transactionId: TransactionHash.fromHex(i.txId), index: i.index }));
    let fee = p.minFeeConstant;
    for (let iteration = 0; iteration < 8; iteration++) {
      requireGuard(fee <= BigInt(500000), "FEE");
      const change = lovelace - deposit - fee;
      if (change <= ZERO) break;
      const value = Assets.fromRecord({ lovelace: change, ...assets });
      if (BigInt(Assets.toCBORBytes(value).length) > p.maxValueSize) throw new BuildError("SINGLE_CHANGE");
      const output = new TxOut.TransactionOutput({ address, assets: value });
      const body = new TransactionBody.TransactionBody({ inputs, outputs: [output], fee,
        ttl: context.constructionTip.slot + BigInt(600), networkId: 1, certificates: [certificate] });
      const bodyHex = TransactionBody.toCBORHex(body);
      // Official ledger ARRAY3 size excludes isValid; canonical witnesses are untagged.
      const feeSize = bodyHex.length / 2 + witnessSize + 2;
      requireGuard(BigInt(feeSize + 1) <= p.maxTxSize, "SIZE");
      const minimum = p.minFeeConstant + p.minFeeCoefficient * BigInt(feeSize);
      if (minimum > fee) { fee = minimum; continue; }
      requireGuard(fee <= minimum + BigInt(10000), "FEE");
      const minADA = (BigInt(160) + BigInt(TxOut.toCBORBytes(output).length)) * p.coinsPerUTxOByte;
      if (change < minADA) break;
      const unsignedHex = Transaction.toCBORHex(new Transaction.Transaction({ body,
        witnessSet: TransactionWitnessSet.empty(), isValid: true, auxiliaryData: null }));
      const wrapper = array(decode(unsignedHex));
      requireGuard(wrapper.length === 4 && unsignedHex.slice(wrapper[0].start * 2, wrapper[0].end * 2) === bodyHex &&
        wrapper[1].kind === "map" && wrapper[1].value.length === 0 && wrapper[2].kind === "simple" && wrapper[2].value === true &&
        wrapper[3].kind === "simple" && wrapper[3].value === null, "BODY");
      const review = reviewBody(bodyHex, context);
      requireGuard(review.minimumFee === minimum, "FEE");
      return Object.freeze({ unsignedHex, review });
    }
  }
  throw new BuildError("INSUFFICIENT_FUNDS");
}
/** Pure, one-change-output construction from observations authenticated by a later controller. */
export function buildStakeTransaction(context: GuardContext): BuiltStakeTransaction {
  try { return construct(context); }
  catch (error) {
    if (error instanceof GuardError || error instanceof BuildError) throw error;
    // SDK exceptions can contain complete caller payloads. Never forward their detail.
    throw new BuildError("BUILD");
  }
}
