import { array, arrayHeader, byteString, Cbor, decode, fields, integer } from "./cbor";
import { bodyId, keyHash, verifyEd25519 } from "./crypto";
import { AcceptedTransaction, GuardContext, Input, requireGuard, Review, Value } from "./types";

export const EASY1_POOL_HASH = "20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9";
const ZERO = BigInt(0), MAX_COIN = BigInt("45000000000000000"), MAX_ASSET = BigInt("9223372036854775807");
interface ReviewState { fingerprint: string; acceptedSlot: bigint; acceptedHash: string; revoked: boolean }
const reviews = new WeakMap<Review, ReviewState>();
function object(value: unknown): asserts value is Record<string, unknown> {
  requireGuard(value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype, "CONTEXT");
}
function shape(value: unknown, keys: string[]): void {
  object(value);
  requireGuard(Object.keys(value).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(value, k)), "CONTEXT");
}
function isHex(value: unknown, size?: number): value is string {
  return typeof value === "string" && /^[0-9a-f]*$/.test(value) && value.length % 2 === 0 && (size === undefined || value.length === size * 2);
}
function quantity(value: unknown, max = MAX_COIN): asserts value is bigint {
  requireGuard(typeof value === "bigint" && value >= ZERO && value <= max, "VALUE");
}
function clock(value: unknown): asserts value is number {
  requireGuard(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, "CONTEXT");
}
function fresh(observed: number, now: number): void {
  clock(observed); requireGuard(observed <= now && now - observed <= 30000, "STALE");
}
function address(value: unknown): asserts value is string {
  requireGuard(isHex(value, 57) && value.startsWith("01"), "ADDRESS");
}
function validateValue(value: Value): void {
  quantity(value.lovelace); object(value.assets);
  requireGuard(Object.keys(value.assets).length <= 2048, "VALUE");
  for (const [unit, amount] of Object.entries(value.assets)) {
    requireGuard(isHex(unit) && unit.length >= 56 && unit.length <= 120, "VALUE");
    quantity(amount, MAX_ASSET); requireGuard(amount > ZERO, "VALUE");
  }
}
function validateInput(input: Input, provider: boolean): void {
  shape(input, ["txId", "index", "addressHex", "lovelace", "assets", "datum", "referenceScript", ...(provider ? ["unspent"] : [])]);
  requireGuard(isHex(input.txId, 32), "INPUT"); quantity(input.index, BigInt(65535));
  address(input.addressHex); validateValue(input);
  requireGuard(input.datum === null || (isHex(input.datum) && input.datum.length > 0), "INPUT");
  requireGuard(input.referenceScript === null || (isHex(input.referenceScript) && input.referenceScript.length > 0), "INPUT");
  if (provider) requireGuard((input as Input & { unspent: unknown }).unspent === true, "INPUT");
}
const ref = (i: Pick<Input, "txId" | "index">) => `${i.txId}#${i.index}`;
function valueIdentity(value: Value): string {
  return `${value.lovelace}|${Object.entries(value.assets).sort(([a], [b]) => a.localeCompare(b)).map(([u, q]) => `${u}:${q}`).join(",")}`;
}
function inputIdentity(input: Input): string {
  return `${ref(input)}|${input.addressHex}|${valueIdentity(input)}|${input.datum}|${input.referenceScript}`;
}
function validateContext(c: GuardContext, initial: boolean): void {
  shape(c, ["networkId", "revision", "changeAddressHex", "stakeKeyHash", "bindingObservedAt", "registration", "currentPoolHash", "registrationObservedAt", "constructionTip", "currentTip", "slotConfig", "parameters", "wallet", "provider", "now"]);
  requireGuard(c.networkId === 1, "NETWORK");
  requireGuard(Number.isSafeInteger(c.revision) && c.revision >= 0, "REVISION");
  clock(c.now); fresh(c.bindingObservedAt, c.now); fresh(c.registrationObservedAt, c.now);
  address(c.changeAddressHex);
  requireGuard(isHex(c.stakeKeyHash, 28) && c.changeAddressHex.slice(58) === c.stakeKeyHash, "BINDING");
  requireGuard(c.registration === "registered" || c.registration === "unregistered", "CONTEXT");
  requireGuard(c.currentPoolHash === null || isHex(c.currentPoolHash, 28), "CONTEXT");
  requireGuard((c.registration !== "unregistered" || c.currentPoolHash === null) && c.currentPoolHash !== EASY1_POOL_HASH, "BINDING");
  shape(c.slotConfig, ["zeroTime", "zeroSlot", "slotLength"]);
  requireGuard(c.slotConfig.zeroTime === BigInt("1596059091000") && c.slotConfig.zeroSlot === BigInt(4492800) && c.slotConfig.slotLength === 1000, "VALIDITY");
  for (const tip of [c.constructionTip, c.currentTip]) {
    shape(tip, ["slot", "hash", "epoch", "observedAt"]);
    quantity(tip.slot, BigInt(Number.MAX_SAFE_INTEGER)); quantity(tip.epoch, BigInt(Number.MAX_SAFE_INTEGER));
    requireGuard(isHex(tip.hash, 32) && tip.slot >= c.slotConfig.zeroSlot, "CONTEXT"); clock(tip.observedAt);
    requireGuard(tip.epoch === BigInt(208) + (tip.slot - c.slotConfig.zeroSlot) / BigInt(432000), "CONTEXT");
  }
  fresh(c.currentTip.observedAt, c.now);
  if (initial) fresh(c.constructionTip.observedAt, c.now);
  requireGuard(c.currentTip.slot >= c.constructionTip.slot && c.currentTip.observedAt >= c.constructionTip.observedAt && (c.currentTip.slot !== c.constructionTip.slot || c.currentTip.hash === c.constructionTip.hash), "VALIDITY");
  const slotTime = c.slotConfig.zeroTime + (c.currentTip.slot - c.slotConfig.zeroSlot) * BigInt(1000);
  requireGuard(slotTime <= BigInt(c.now) && BigInt(c.now) - slotTime <= BigInt(30000), "STALE");
  const p = c.parameters;
  shape(p, ["identity", "epoch", "observedAt", "minFeeCoefficient", "minFeeConstant", "stakeDeposit", "coinsPerUTxOByte", "maxTxSize", "maxValueSize"]);
  requireGuard(isHex(p.identity, 32) && p.epoch === c.currentTip.epoch && p.epoch === c.constructionTip.epoch, "PARAMETERS");
  fresh(p.observedAt, c.now);
  for (const q of [p.minFeeCoefficient, p.minFeeConstant, p.stakeDeposit, p.coinsPerUTxOByte, p.maxTxSize, p.maxValueSize]) {
    requireGuard(typeof q === "bigint" && q > ZERO && q <= MAX_COIN, "PARAMETERS");
  }
  requireGuard(p.maxTxSize <= BigInt(65536) && p.maxValueSize <= p.maxTxSize, "PARAMETERS");
  shape(c.wallet, ["complete", "observedAt", "utxos"]); shape(c.provider, ["observedAt", "utxos"]);
  requireGuard(c.wallet.complete === true && Array.isArray(c.wallet.utxos) && Array.isArray(c.provider.utxos), "CONTEXT");
  fresh(c.wallet.observedAt, c.now); fresh(c.provider.observedAt, c.now);
  for (const [list, provider] of [[c.wallet.utxos, false], [c.provider.utxos, true]] as const) {
    requireGuard(list.length > 0 && list.length <= 2048, "INPUT");
    const seen = new Set<string>();
    for (const input of list) { validateInput(input, provider); requireGuard(!seen.has(ref(input)), "INPUT"); seen.add(ref(input)); }
  }
}
function fingerprint(c: GuardContext, selected: readonly Input[]): string {
  const p = c.parameters, tip = c.constructionTip;
  return [c.networkId, c.revision, c.changeAddressHex, c.stakeKeyHash, c.registration, c.currentPoolHash,
    tip.slot, tip.hash, tip.epoch, p.identity, p.epoch, p.minFeeCoefficient, p.minFeeConstant, p.stakeDeposit,
    p.coinsPerUTxOByte, p.maxTxSize, p.maxValueSize, ...selected.map(inputIdentity).sort()].join(";");
}
function required(map: Map<number, Cbor>, key: number): Cbor { const value = map.get(key); requireGuard(value, "BODY"); return value; }
function natural(node: Cbor, max = MAX_COIN): bigint { const n = integer(node); quantity(n, max); return n; }
function setMembers(node: Cbor): readonly Cbor[] {
  const members = array(node, true), seen = new Set<string>();
  // Parser validates duplicate map keys; set duplicates are checked semantically below.
  for (const item of members) {
    const identity = JSON.stringify(item, (k, v) => k === "start" || k === "end" ? undefined : typeof v === "bigint" ? v.toString() : v);
    requireGuard(!seen.has(identity), "CBOR"); seen.add(identity);
  }
  return members;
}
function parseValue(node: Cbor): Value {
  let lovelace: bigint; const assets: Record<string, bigint> = {};
  if (node.kind === "int") lovelace = natural(node);
  else {
    const pair = array(node); requireGuard(pair.length === 2, "VALUE"); lovelace = natural(pair[0]);
    requireGuard(pair[1].kind === "map" && pair[1].value.length > 0, "VALUE");
    for (const [policy, names] of pair[1].value) {
      const p = byteString(policy, 28); requireGuard(names.kind === "map" && names.value.length > 0, "VALUE");
      for (const [name, amount] of names.value) {
        const n = byteString(name); requireGuard(n.length <= 64, "VALUE");
        const q = natural(amount, MAX_ASSET); requireGuard(q > ZERO, "VALUE"); assets[p + n] = q;
      }
    }
  }
  return { lovelace, assets };
}
function sum(values: readonly Value[]): Value {
  let lovelace = ZERO; const assets: Record<string, bigint> = {};
  for (const value of values) {
    lovelace += value.lovelace; requireGuard(lovelace <= MAX_COIN, "VALUE");
    for (const [unit, amount] of Object.entries(value.assets)) { assets[unit] = (assets[unit] ?? ZERO) + amount; requireGuard(assets[unit] <= MAX_ASSET, "VALUE"); }
  }
  return { lovelace, assets };
}
function feeCheck(fee: bigint, feeSize: number, c: GuardContext): bigint {
  const minimum = c.parameters.minFeeConstant + c.parameters.minFeeCoefficient * BigInt(feeSize);
  requireGuard(fee >= minimum && fee <= minimum + BigInt(10000) && fee <= BigInt(500000), "FEE");
  return minimum;
}
function inspectBody(bodyHex: string, c: GuardContext, remaining: number, witnessSize?: number) {
  const body = decode(bodyHex), map = fields(body, [0, 1, 2, 3, 4, 8, 14, 15]);
  requireGuard(integer(required(map, 15)) === BigInt(1), "NETWORK");
  const upper = natural(required(map, 3), BigInt(Number.MAX_SAFE_INTEGER));
  requireGuard(upper === c.constructionTip.slot + BigInt(600) && upper - c.currentTip.slot >= BigInt(remaining), "VALIDITY");
  if (map.has(8)) {
    const lower = natural(required(map, 8), BigInt(Number.MAX_SAFE_INTEGER));
    requireGuard(lower <= c.constructionTip.slot && lower <= c.currentTip.slot && lower < upper, "VALIDITY");
  }
  const certs = setMembers(required(map, 4)).map((cert) => array(cert));
  const tags = certs.map((cert) => { requireGuard(cert.length > 0, "CERTIFICATE"); return integer(cert[0]); });
  const registered = c.registration === "registered";
  requireGuard(registered ? tags.length === 1 && tags[0] === BigInt(2) : (tags.length === 1 && tags[0] === BigInt(11)) || (tags.length === 2 && tags[0] === BigInt(7) && tags[1] === BigInt(2)), "CERTIFICATE");
  for (const cert of certs) {
    const tag = integer(cert[0]), credential = cert[1] && array(cert[1]);
    requireGuard(credential && credential.length === 2 && integer(credential[0]) === ZERO && byteString(credential[1], 28) === c.stakeKeyHash, "CERTIFICATE");
    requireGuard(cert.length === (tag === BigInt(11) ? 4 : 3), "CERTIFICATE");
    if (tag !== BigInt(7)) requireGuard(byteString(cert[2], 28) === EASY1_POOL_HASH, "CERTIFICATE");
    if (tag !== BigInt(2)) requireGuard(natural(cert[tag === BigInt(7) ? 2 : 3]) === c.parameters.stakeDeposit, "CERTIFICATE");
  }
  const selected: Input[] = [], seen = new Set<string>();
  for (const node of setMembers(required(map, 0))) {
    const pair = array(node); requireGuard(pair.length === 2, "INPUT");
    const id = byteString(pair[0], 32), index = natural(pair[1], BigInt(65535)), reference = `${id}#${index}`;
    requireGuard(!seen.has(reference), "INPUT"); seen.add(reference);
    const wallet = c.wallet.utxos.find((i) => ref(i) === reference), provider = c.provider.utxos.find((i) => ref(i) === reference);
    requireGuard(wallet && provider && provider.unspent === true && inputIdentity(wallet) === inputIdentity(provider) && wallet.referenceScript === null, "INPUT");
    selected.push(wallet);
  }
  requireGuard(selected.length > 0, "INPUT");
  const outputs: Value[] = [];
  for (const node of array(required(map, 1))) {
    let addr: Cbor, value: Cbor;
    if (node.kind === "map") {
      const out = fields(node, [0, 1]); requireGuard(out.size === 2, "BODY"); addr = required(out, 0); value = required(out, 1);
    } else { const pair = array(node); requireGuard(pair.length === 2, "BODY"); [addr, value] = pair; }
    const outputAddress = byteString(addr, 57);
    requireGuard(outputAddress === c.changeAddressHex, "ADDRESS");
    const decoded = parseValue(value);
    requireGuard(BigInt(value.end - value.start) <= c.parameters.maxValueSize, "SIZE");
    requireGuard(decoded.lovelace >= (BigInt(160) + BigInt(node.end - node.start)) * c.parameters.coinsPerUTxOByte, "MIN_ADA");
    outputs.push(decoded);
  }
  requireGuard(outputs.length > 0, "BODY");
  const inputSum = sum(selected), outputSum = sum(outputs), deposit = registered ? ZERO : c.parameters.stakeDeposit;
  const fee = natural(required(map, 2));
  requireGuard(inputSum.lovelace === outputSum.lovelace + fee + deposit, "ADA");
  requireGuard(valueIdentity({ lovelace: ZERO, assets: inputSum.assets }) === valueIdentity({ lovelace: ZERO, assets: outputSum.assets }), "ASSETS");
  const keys = [...new Set([c.stakeKeyHash, ...selected.map((i) => i.addressHex.slice(2, 58))])].sort();
  if (map.has(14)) {
    const signers = setMembers(required(map, 14)).map((node) => byteString(node, 28));
    requireGuard(new Set(signers).size === signers.length && signers.every((s) => keys.includes(s)), "SIGNER");
  }
  // ARRAY3 [original body, witnesses, null] is the official ledger fee-size encoding.
  const plannedWitnessSize = 2 + arrayHeader(keys.length).length / 2 + keys.length * 101;
  const ws = witnessSize ?? plannedWitnessSize;
  const feeSize = 1 + bodyHex.length / 2 + ws + 1;
  requireGuard(BigInt(feeSize) <= c.parameters.maxTxSize && BigInt(feeSize + 1) <= c.parameters.maxTxSize, "SIZE");
  return { fee, deposit, upper, keys, selected, minimumFee: feeCheck(fee, feeSize, c) };
}
export function reviewBody(bodyHex: string, context: GuardContext): Review {
  validateContext(context, true);
  const checked = inspectBody(bodyHex, context, 180);
  const review: Review = Object.freeze({ bodyHex, txId: bodyId(bodyHex), targetPoolHash: EASY1_POOL_HASH, stakeKeyHash: context.stakeKeyHash,
    fee: checked.fee, deposit: checked.deposit, invalidHereafter: checked.upper, minimumFee: checked.minimumFee,
    inputRefs: Object.freeze(checked.selected.map(ref)), expectedKeyHashes: Object.freeze([...checked.keys]) });
  reviews.set(review, { fingerprint: fingerprint(context, checked.selected), acceptedSlot: context.currentTip.slot, acceptedHash: context.currentTip.hash, revoked: false });
  return review;
}
function enforceAcceptedTip(issued: ReviewState, tip: GuardContext["currentTip"] | undefined): void {
  if (tip && typeof tip.slot === "bigint" && isHex(tip.hash, 32) &&
    (tip.slot < issued.acceptedSlot || (tip.slot === issued.acceptedSlot && tip.hash !== issued.acceptedHash))) issued.revoked = true;
  requireGuard(!issued.revoked, "VALIDITY");
}
function recheck(review: Review, context: GuardContext, remaining: number, witnessSize?: number, accept = true) {
  requireGuard(review !== null && typeof review === "object" && reviews.has(review), "REVIEW");
  const issued = reviews.get(review)!;
  enforceAcceptedTip(issued, context?.currentTip);
  validateContext(context, false);
  const checked = inspectBody(review.bodyHex, context, remaining, witnessSize);
  requireGuard(fingerprint(context, checked.selected) === issued.fingerprint, "BINDING");
  // Retain primitives only after all synchronous checks; a failed signature must
  // not advance this envelope. The post-crypto recheck compares the latest state.
  if (accept) { issued.acceptedSlot = context.currentTip.slot; issued.acceptedHash = context.currentTip.hash; }
  return checked;
}
/** Call again with freshly acquired context immediately before opening wallet approval. */
export function validateBeforeSigning(review: Review, context: GuardContext): void { recheck(review, context, 180); }
function witnesses(node: Cbor): readonly { vkey: string; signature: string; hash: string }[] {
  const map = fields(node, [0], "WITNESS"); requireGuard(map.size === 1 && map.has(0), "WITNESS");
  return array(map.get(0)!, true).map((w) => {
    const pair = array(w); requireGuard(pair.length === 2, "WITNESS");
    const vkey = byteString(pair[0], 32), signature = byteString(pair[1], 64);
    return { vkey, signature, hash: keyHash(vkey) };
  });
}
function validateWitnessSet(node: Cbor, review: Review): ReturnType<typeof witnesses> {
  const found = witnesses(node), hashes = found.map((w) => w.hash).sort();
  requireGuard(hashes.length === review.expectedKeyHashes.length && hashes.every((h, i) => h === review.expectedKeyHashes[i]), "WITNESS");
  return found;
}
async function checkWitnesses(node: Cbor, review: Review): Promise<ReturnType<typeof witnesses>> {
  const found = validateWitnessSet(node, review);
  for (const w of found) requireGuard(await verifyEd25519(w.vkey, w.signature, review.txId), "SIGNATURE");
  return found;
}
export async function verifySignedTransaction(signedHex: string, review: Review, context: GuardContext): Promise<AcceptedTransaction> {
  requireGuard(review !== null && typeof review === "object" && reviews.has(review), "REVIEW");
  const tx = array(decode(signedHex));
  requireGuard(tx.length === 4 && tx[2].kind === "simple" && tx[2].value === true && tx[3].kind === "simple" && tx[3].value === null, "BODY");
  const exactBody = signedHex.slice(tx[0].start * 2, tx[0].end * 2);
  requireGuard(exactBody === review.bodyHex && bodyId(exactBody) === review.txId, "REVIEW");
  validateWitnessSet(tx[1], review);
  const checked = recheck(review, context, 120, tx[1].end - tx[1].start, false);
  await checkWitnesses(tx[1], review);
  recheck(review, context, 120, tx[1].end - tx[1].start);
  return Object.freeze({ signedHex, txId: review.txId, fee: checked.fee, minimumFee: checked.minimumFee });
}
/** Accepts a CIP-30 witness-set CBOR; only its container is normalized, never the body. */
export async function assembleSignedTransaction(witnessHex: string, review: Review, context: GuardContext): Promise<AcceptedTransaction> {
  recheck(review, context, 120, undefined, false);
  const found = await checkWitnesses(decode(witnessHex), review);
  const canonical = "a100" + arrayHeader(found.length) + [...found].sort((a, b) => a.hash.localeCompare(b.hash))
    .map((w) => "825820" + w.vkey + "5840" + w.signature).join("");
  return verifySignedTransaction("84" + review.bodyHex + canonical + "f5f6", review, context);
}
