import { createBlockfrostRead, MAINNET_SOURCE } from "./blockfrost-reader";
import type { SourceRuntime, Observation } from "./blockfrost-reader";
import { ensure, SourceError, sourceFailure, field, list, text, integer, decimal, hash, canonical } from "./provider-json";
import type { Json, SourceCode } from "./provider-json";
import { bindWallet } from "./wallet-codec";
import type { WalletSessionState, WalletObservation } from "./wallet-session";
import type { GuardContext, Tip, Input } from "./types";
import { addressBech32, addressHex, stakeBech32, poolHash, poolBech32, digest, defensiveInputs, datumContent, referenceHash } from "./source-cbor";
export const EASY1_HASH = "20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9";
export const EASY1_ID = "pool1yr0cv3dtmhcfgqa6yetvmf769ngk89e6tepecmjrmjl2jzcw2lm";
const ZERO_SLOT = BigInt(4492800), ZERO_TIME = BigInt("1596059091000"), MAX_COIN = BigInt("45000000000000000");
export interface SourceIdentity {
  readonly source: typeof MAINNET_SOURCE; readonly networkId: 1; readonly era: "Conway"; readonly protocolMajor: 11;
  readonly parameters: string; readonly eligibility: string; readonly semantics: string;
}
export interface Provenance { readonly observedAt: number; readonly requests: number; readonly currentTip: Tip; readonly identity: SourceIdentity }
export type ChainAssessment = { readonly status: "ready"; readonly context: GuardContext; readonly provenance: Provenance }
  | { readonly status: "already-EASY1"; readonly provenance: Provenance }
  | { readonly status: "refused"; readonly code: SourceCode; readonly message: string };
export interface PriorContext { readonly constructionTip: Tip; readonly currentTip: Tip; readonly identity: SourceIdentity }
export interface AssessmentOptions { readonly signal?: AbortSignal; readonly runtime?: SourceRuntime; readonly prior?: PriorContext }
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value;
}
function fresh(time: number, now: number): void { ensure(Number.isSafeInteger(time) && time >= 0 && time <= now && now - time <= 30000, "STALE"); }
function epoch(slot: bigint): bigint { ensure(slot >= ZERO_SLOT, "COHERENCE"); return BigInt(208) + (slot - ZERO_SLOT) / BigInt(432000); }
function timeAt(slot: bigint): bigint { return ZERO_TIME + (slot - ZERO_SLOT) * BigInt(1000); }
function boolean(value: Json): boolean { ensure(typeof value === "boolean", "RESPONSE"); return value; }
function valueIdentity(input: Input): string { return canonical(input); }
function capture(state: WalletSessionState, now: number): { revision: number; observation: WalletObservation } {
  ensure(state && state.phase === "observed" && state.error === null && Number.isSafeInteger(state.revision) && state.revision >= 0 && state.observation, "WALLET");
  const o = state.observation, b = o.binding;
  const binding = bindWallet(b.networkId, b.changeAddressHex, b.rewardAddresses);
  ensure(canonical(binding) === canonical(b) && o.inputs.complete === true, "WALLET");
  const times = [o.bindingObservedAt, o.rewardsObservedAt, o.inputsObservedAt, o.finalBindingObservedAt];
  times.forEach(t => fresh(t, now)); ensure(times.every((t, i) => i === 0 || t >= times[i - 1]), "WALLET");
  return freeze({ revision: state.revision, observation: { binding, inputs: { complete: true, utxos: defensiveInputs(o.inputs.utxos) }, bindingObservedAt: o.bindingObservedAt,
    rewardsObservedAt: o.rewardsObservedAt, inputsObservedAt: o.inputsObservedAt, finalBindingObservedAt: o.finalBindingObservedAt } });
}
interface Point { slot: bigint; height: bigint; time: bigint; block: string; index: bigint }
interface Event { point: Point; index: bigint; action: "registered" | "deregistered" | "delegated"; pool: string | null }
function compare(a: Event, b: Event): number {
  for (const [x, y] of [[a.point.slot, b.point.slot], [a.point.index, b.point.index], [a.index, b.index]]) if (x !== y) return x < y ? -1 : 1;
  return a.action === b.action ? 0 : a.action === "registered" ? -1 : 1;
}
function tip(read: Observation, now: number): Tip & { readonly height: bigint; readonly time: bigint } {
  const row = read.value, slot = integer(field(row, "slot")), e = integer(field(row, "epoch")), time = integer(field(row, "time"));
  ensure(e === epoch(slot) && time * BigInt(1000) === timeAt(slot), "COHERENCE");
  fresh(Number(time * BigInt(1000)), now); fresh(read.observedAt, now);
  return freeze({ slot, hash: hash(field(row, "hash")), epoch: e, observedAt: read.observedAt, height: integer(field(row, "height")), time });
}
function coreTip(value: Tip): Tip { return freeze({ slot: value.slot, hash: value.hash, epoch: value.epoch, observedAt: value.observedAt }); }
function progress(points: readonly (Tip & { readonly height?: bigint })[]): void {
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const previous = points[i], current = points[j];
    ensure(current.observedAt >= previous.observedAt && current.epoch === previous.epoch, "COHERENCE");
    ensure(current.slot >= previous.slot, "COHERENCE");
    ensure(current.slot === previous.slot ? current.hash === previous.hash : current.hash !== previous.hash, "COHERENCE");
    if (previous.height !== undefined && current.height !== undefined)
      ensure(current.slot === previous.slot ? current.height === previous.height : current.height > previous.height, "COHERENCE");
  }
}
function parameterValues(read: Observation, e: bigint): GuardContext["parameters"] {
  try {
    const p = read.value; ensure(integer(field(p, "epoch")) === e && integer(field(p, "protocol_major_ver")) === BigInt(11) && integer(field(p, "protocol_minor_ver")) === BigInt(0), "PARAMETERS");
    const values = { epoch: e, minFeeCoefficient: integer(field(p, "min_fee_a"), MAX_COIN, BigInt(1)), minFeeConstant: integer(field(p, "min_fee_b"), MAX_COIN, BigInt(1)),
      stakeDeposit: decimal(field(p, "key_deposit"), MAX_COIN, BigInt(1)), coinsPerUTxOByte: decimal(field(p, "coins_per_utxo_size"), MAX_COIN, BigInt(1)),
      maxTxSize: integer(field(p, "max_tx_size"), BigInt(65536), BigInt(1)), maxValueSize: decimal(field(p, "max_val_size"), BigInt(65536), BigInt(1)) };
    ensure(values.maxValueSize <= values.maxTxSize, "PARAMETERS");
    const identity = digest(canonical({ networkId: 1, era: "Conway", protocolMajor: 11, protocolMinor: 0, ...values }));
    return freeze({ ...values, identity, observedAt: read.observedAt });
  } catch { throw new SourceError("PARAMETERS"); }
}
/** Dormant read-only assessment. It never acquires a wallet handle, builds or signs. */
export async function assessChainContext(state: WalletSessionState, projectId: string, options: AssessmentOptions = {}): Promise<ChainAssessment> {
  let source: ReturnType<typeof createBlockfrostRead> | undefined;
  try {
    source = createBlockfrostRead(projectId, options.signal, options.runtime); const read = source;
    const captured = capture(state, read.clock()), wallet = captured.observation, stake = stakeBech32(wallet.binding.stakeKeyHash);
    const prior = options.prior === undefined ? undefined : freeze(structuredClone(options.prior));
    ensure(poolBech32(EASY1_HASH) === EASY1_ID && poolHash(EASY1_ID) === EASY1_HASH, "COHERENCE");
    const first = tip(await read.get("/blocks/latest"), read.clock());
    const firstEpoch = await read.get("/epochs/latest"); ensure(integer(field(firstEpoch.value, "epoch")) === first.epoch, "COHERENCE");
    const accountStart = await read.get("/accounts/" + stake), poolStart = await read.get("/pools/" + EASY1_HASH);
    const registrations = await read.pages("/accounts/" + stake + "/registrations"), delegations = await read.pages("/accounts/" + stake + "/delegations");
    const updates = await read.pages("/pools/" + EASY1_HASH + "/updates"), metadata = await read.get("/pools/" + EASY1_HASH + "/metadata");
    const retired = await read.pages("/pools/retired"), retiring = await read.pages("/pools/retiring");
    const parametersStart = parameterValues(await read.get(`/epochs/${first.epoch}/parameters`), first.epoch);
    const transactions = new Map<string, Promise<{ value: Json; point: Point }>>(), positions = new Map<string, string>(), blocks = new Map<string, string>(), heights = new Map<string, string>();
    function transaction(id: string): Promise<{ value: Json; point: Point }> {
      if (!transactions.has(id)) transactions.set(id, (async () => {
        const value = (await read.get("/txs/" + id)).value; ensure(hash(field(value, "hash")) === id && boolean(field(value, "valid_contract")), "COHERENCE");
        const point: Point = { slot: integer(field(value, "slot")), height: integer(field(value, "block_height")), time: integer(field(value, "block_time")), block: hash(field(value, "block")), index: integer(field(value, "index"), BigInt(65535)) };
        ensure(point.slot <= first.slot && point.height <= first.height && point.time <= first.time && point.slot >= ZERO_SLOT && timeAt(point.slot) === point.time * BigInt(1000), "COHERENCE");
        ensure(point.slot !== first.slot || point.block === first.hash && point.height === first.height, "COHERENCE");
        const blockIdentity = point.block + ":" + point.height + ":" + point.time;
        ensure(!blocks.has(point.slot.toString()) || blocks.get(point.slot.toString()) === blockIdentity, "COHERENCE"); blocks.set(point.slot.toString(), blockIdentity);
        ensure(!heights.has(point.height.toString()) || heights.get(point.height.toString()) === point.slot.toString(), "COHERENCE"); heights.set(point.height.toString(), point.slot.toString());
        const position = point.slot + ":" + point.index; ensure(!positions.has(position) || positions.get(position) === id, "COHERENCE"); positions.set(position, id);
        return { value, point };
      })()); return transactions.get(id)!;
    }
    async function certificates(id: string, endpoint: string, count: string): Promise<{ rows: readonly Json[]; point: Point }> {
      const tx = await transaction(id), rows = list((await read.get(`/txs/${id}/${endpoint}`)).value);
      ensure(BigInt(rows.length) === integer(field(tx.value, count), BigInt(8192)), "COHERENCE");
      const indices = new Set<string>(); for (const row of rows) { const i = integer(field(row, "cert_index"), BigInt(65535)).toString(); ensure(!indices.has(i), "COHERENCE"); indices.add(i); }
      return { rows, point: tx.point };
    }
    const regRows = list(registrations.value), delRows = list(delegations.value), events: Event[] = [];
    const regGroups = new Map<string, Json[]>(), delGroups = new Map<string, Json[]>();
    function histories(rows: readonly Json[], groups: Map<string, Json[]>): void {
      let lastSlot = BigInt(0), lastHeight = BigInt(0);
      for (const row of rows) {
        const id = hash(field(row, "tx_hash")), slot = integer(field(row, "tx_slot")), height = integer(field(row, "block_height")), time = integer(field(row, "block_time"));
        ensure(slot >= lastSlot && height >= lastHeight && slot <= first.slot && height <= first.height && time <= first.time, "COHERENCE"); lastSlot = slot; lastHeight = height;
        if (!groups.has(id)) groups.set(id, []); groups.get(id)!.push(row);
      }
    }
    histories(regRows, regGroups); histories(delRows, delGroups);
    function historicalPoint(row: Json, p: Point): void {
      ensure(integer(field(row, "tx_slot")) === p.slot && integer(field(row, "block_height")) === p.height && integer(field(row, "block_time")) === p.time, "COHERENCE");
    }
    for (const [id, group] of regGroups) {
      const certs = await certificates(id, "stakes", "stake_cert_count"), own = certs.rows.filter(r => text(field(r, "address")) === stake);
      ensure(own.length === group.length, "COHERENCE"); const remaining = [...own];
      for (const row of group) {
        historicalPoint(row, certs.point); const action = text(field(row, "action")); ensure(action === "registered" || action === "deregistered", "COHERENCE");
        const deposit = field(row, "deposit"); if (action === "registered") decimal(deposit); else ensure(deposit === null, "COHERENCE");
        const at = remaining.findIndex(c => boolean(field(c, "registration")) === (action === "registered")); ensure(at !== -1, "COHERENCE");
        const cert = remaining.splice(at, 1)[0]; events.push({ point: certs.point, index: integer(field(cert, "cert_index")), action, pool: null });
      }
    }
    for (const [id, group] of delGroups) {
      const certs = await certificates(id, "delegations", "delegation_count"), own = certs.rows.filter(r => text(field(r, "address")) === stake);
      ensure(own.length === group.length, "COHERENCE"); const remaining = [...own];
      for (const row of group) {
        historicalPoint(row, certs.point); decimal(field(row, "amount")); const pool = poolHash(text(field(row, "pool_id"))), active = integer(field(row, "active_epoch"));
        const at = remaining.findIndex(c => poolHash(text(field(c, "pool_id"))) === pool && integer(field(c, "active_epoch")) === active); ensure(at !== -1, "COHERENCE");
        const cert = remaining.splice(at, 1)[0]; events.push({ point: certs.point, index: integer(field(cert, "cert_index")), action: "delegated", pool });
      }
    }
    events.sort(compare); let registered = false, currentPool: string | null = null;
    for (let i = 0; i < events.length; i++) {
      const event = events[i], previous = events[i - 1];
      if (previous && compare(previous, event) === 0) throw new SourceError("COHERENCE");
      if (event.action === "registered") { ensure(!registered, "COHERENCE"); registered = true; currentPool = null; }
      else if (event.action === "deregistered") { ensure(registered, "COHERENCE"); registered = false; currentPool = null; }
      else { ensure(registered, "COHERENCE"); currentPool = event.pool; }
    }
    function account(value: Json): string {
      ensure(text(field(value, "stake_address")) === stake && boolean(field(value, "registered")) === registered, "COHERENCE");
      const isActive = boolean(field(value, "active")); const pool = field(value, "pool_id"); ensure((pool === null ? null : poolHash(text(pool))) === currentPool, "COHERENCE");
      const active = field(value, "active_epoch"); ensure(active === null || integer(active) <= first.epoch, "COHERENCE");
      ensure(regRows.length === 0 ? active === null : active !== null && integer(active) === epoch(events.filter(e => e.action !== "delegated").slice(-1)[0].point.slot), "COHERENCE");
      return canonical({ registered, pool: currentPool, activeEpoch: active, active: isActive });
    }
    const accountIdentity = account(accountStart.value);
    const poolRows = list(updates.value), poolEvents: (Event & { tx: string; active: bigint })[] = [], poolKeys = new Set<string>();
    for (const row of poolRows) {
      const id = hash(field(row, "tx_hash")), index = integer(field(row, "cert_index"), BigInt(65535)), action = text(field(row, "action"));
      ensure(action === "registered" || action === "deregistered", "COHERENCE"); const key = id + ":" + index; ensure(!poolKeys.has(key), "COHERENCE"); poolKeys.add(key);
      const certs = await certificates(id, action === "registered" ? "pool_updates" : "pool_retires", action === "registered" ? "pool_update_count" : "pool_retire_count");
      const matching = certs.rows.filter(r => integer(field(r, "cert_index")) === index && poolHash(text(field(r, "pool_id"))) === EASY1_HASH); ensure(matching.length === 1, "COHERENCE");
      const active = integer(field(matching[0], action === "registered" ? "active_epoch" : "retiring_epoch"));
      ensure(active >= epoch(certs.point.slot) && active <= epoch(certs.point.slot) + BigInt(100), "COHERENCE");
      poolEvents.push({ point: certs.point, index, action, pool: EASY1_HASH, tx: id, active });
    }
    ensure(poolEvents.length > 0 && poolEvents.every((e, i) => i === 0 || compare(poolEvents[i - 1], e) < 0), "COHERENCE");
    function poolInfo(value: Json): string {
      ensure(text(field(value, "pool_id")) === EASY1_ID && hash(field(value, "hex"), 28) === EASY1_HASH, "COHERENCE");
      for (const [key, action] of [["registration", "registered"], ["retirement", "deregistered"]] as const) {
        const ids = list(field(value, key)).map(v => hash(v)).sort(); ensure(canonical(ids) === canonical(poolEvents.filter(e => e.action === action).map(e => e.tx).sort()), "COHERENCE");
      }
      return canonical({ registration: list(field(value, "registration")), retirement: list(field(value, "retirement")) });
    }
    const poolIdentity = poolInfo(poolStart.value), latest = poolEvents[poolEvents.length - 1];
    ensure(text(field(metadata.value, "pool_id")) === EASY1_ID && hash(field(metadata.value, "hex"), 28) === EASY1_HASH && text(field(metadata.value, "ticker")) === "EASY1", "COHERENCE");
    ensure(!Object.prototype.hasOwnProperty.call(metadata.value, "error"), "COHERENCE");
    function listed(value: Json): boolean {
      const seen = new Set<string>(); let found = false;
      for (const row of list(value)) { const p = poolHash(text(field(row, "pool_id"))), e = integer(field(row, "epoch")); const key = p + ":" + e; ensure(!seen.has(key), "COHERENCE"); seen.add(key); if (p === EASY1_HASH) found = true; }
      return found;
    }
    const retiredListed = listed(retired.value), retiringListed = listed(retiring.value);
    ensure(latest.action === "registered" && !retiredListed && !retiringListed, "INELIGIBLE");
    ensure(poolEvents.some(e => e.action === "registered" && e.active <= first.epoch), "INELIGIBLE");
    const eligibility = digest(canonical({ pool: EASY1_HASH, action: latest.action, tx: latest.tx, cert: latest.index, active: latest.active }));
    const providerInputs: (Input & { readonly unspent: true })[] = [], addresses = [...new Set(wallet.inputs.utxos.map(i => i.addressHex))]; let inputObservedAt = read.clock(), fundingA = false;
    for (const address of addresses) {
      const membership = await read.pages("/addresses/" + addressBech32(address) + "/utxos"); inputObservedAt = Math.min(inputObservedAt, membership.observedAt);
      const rows = list(membership.value), byRef = new Map<string, Json>();
      for (const row of rows) {
        ensure(addressHex(text(field(row, "address"))) === address, "INPUT"); const key = hash(field(row, "tx_hash")) + ":" + integer(field(row, "output_index"), BigInt(65535));
        ensure(!byRef.has(key), "COHERENCE"); byRef.set(key, row); hash(field(row, "block"));
      }
      for (const input of wallet.inputs.utxos.filter(i => i.addressHex === address)) {
        const row = byRef.get(input.txId + ":" + input.index); ensure(row, "INPUT"); const tx = await transaction(input.txId);
        ensure(hash(field(row, "block")) === tx.point.block, "COHERENCE");
        const outputs = (await read.get(`/txs/${input.txId}/utxos`)).value; ensure(hash(field(outputs, "hash")) === input.txId, "COHERENCE");
        const matching = list(field(outputs, "outputs")).filter(v => integer(field(v, "output_index"), BigInt(65535)) === input.index); ensure(matching.length === 1, "INPUT");
        const output = matching[0]; ensure(boolean(field(output, "collateral")) === false, "INPUT");
        const consumed = Object.prototype.hasOwnProperty.call(output, "consumed_by_tx") ? field(output, "consumed_by_tx") : null; ensure(consumed === null, "INPUT");
        for (const sourceRow of [row, output]) {
          ensure(addressHex(text(field(sourceRow, "address"))) === input.addressHex, "INPUT");
          const assets: Record<string, bigint> = {}; let coin: bigint | undefined; const units = new Set<string>();
          for (const item of list(field(sourceRow, "amount"))) {
            const unit = text(field(item, "unit")); ensure(!units.has(unit), "INPUT"); units.add(unit);
            if (unit === "lovelace") coin = decimal(field(item, "quantity"));
            else { ensure(/^[0-9a-f]{56}(?:[0-9a-f]{2}){0,32}$/.test(unit), "INPUT"); assets[unit] = decimal(field(item, "quantity"), BigInt("9223372036854775807"), BigInt(1)); }
          }
          ensure(coin !== undefined && coin === input.lovelace && canonical(assets) === canonical(input.assets), "INPUT");
          const dataHash = field(sourceRow, "data_hash"), inline = field(sourceRow, "inline_datum"), scriptHash = field(sourceRow, "reference_script_hash");
          if (input.datum === null) ensure(dataHash === null && inline === null, "INPUT");
          else {
            const expected = datumContent(input.datum);
            ensure(inline === expected.inline && (dataHash === null ? expected.inline !== null : hash(dataHash) === expected.hash), "INPUT");
          }
          ensure(input.referenceScript === null ? scriptHash === null : hash(scriptHash, 28) === referenceHash(input.referenceScript), "INPUT");
        }
        providerInputs.push(freeze({ ...input, unspent: true }));
        if (input.addressHex.slice(58) === wallet.binding.stakeKeyHash && input.lovelace > BigInt(0)) fundingA = true;
      }
    }
    ensure(registered || regRows.length > 0 || fundingA, "COHERENCE");
    const accountEnd = await read.get("/accounts/" + stake), poolEnd = await read.get("/pools/" + EASY1_HASH);
    ensure(account(accountEnd.value) === accountIdentity && poolInfo(poolEnd.value) === poolIdentity, "COHERENCE");
    const parametersEnd = parameterValues(await read.get(`/epochs/${first.epoch}/parameters`), first.epoch); ensure(parametersEnd.identity === parametersStart.identity, "COHERENCE");
    const lastEpoch = await read.get("/epochs/latest"); ensure(integer(field(lastEpoch.value, "epoch")) === first.epoch, "COHERENCE");
    const last = tip(await read.get("/blocks/latest"), read.clock());
    const now = read.clock(); read.check();
    for (const time of [wallet.bindingObservedAt, wallet.rewardsObservedAt, wallet.inputsObservedAt, wallet.finalBindingObservedAt, first.observedAt, registrations.observedAt, delegations.observedAt,
      updates.observedAt, metadata.observedAt, retired.observedAt, retiring.observedAt, parametersStart.observedAt, inputObservedAt, accountStart.observedAt, poolStart.observedAt]) fresh(time, now);
    const semantics = digest(canonical({ networkId: 1, revision: captured.revision, binding: wallet.binding, registration: registered, pool: currentPool,
      parameters: parametersStart.identity, eligibility, inputs: wallet.inputs.utxos.map(valueIdentity).sort() }));
    const identity: SourceIdentity = freeze({ source: MAINNET_SOURCE, networkId: 1, era: "Conway", protocolMajor: 11, parameters: parametersStart.identity, eligibility, semantics });
    if (prior) {
      for (const t of [prior.constructionTip, prior.currentTip]) ensure(typeof t.slot === "bigint" && typeof t.epoch === "bigint" && t.epoch === epoch(t.slot) && /^[0-9a-f]{64}$/.test(t.hash) && Number.isSafeInteger(t.observedAt) && t.observedAt >= 0 && t.observedAt <= now, "COHERENCE");
      ensure(canonical(prior.identity) === canonical(identity), "COHERENCE");
      ensure(prior.constructionTip.epoch === first.epoch, "COHERENCE");
    }
    progress(prior ? [coreTip(prior.constructionTip), coreTip(prior.currentTip), first, last] : [first, last]);
    const constructionTip = prior ? coreTip(prior.constructionTip) : coreTip(first), currentTip = coreTip(last);
    const provenance: Provenance = freeze({ observedAt: first.observedAt, requests: read.requests, currentTip, identity });
    if (currentPool === EASY1_HASH) return freeze({ status: "already-EASY1", provenance });
    ensure(wallet.inputs.utxos.length > 0 && wallet.inputs.utxos.some(i => i.referenceScript === null && i.lovelace > BigInt(0)), "NO_FUNDS");
    const context: GuardContext = freeze({ networkId: 1, revision: captured.revision, changeAddressHex: wallet.binding.changeAddressHex, stakeKeyHash: wallet.binding.stakeKeyHash,
      bindingObservedAt: wallet.bindingObservedAt, registration: registered ? "registered" : "unregistered", currentPoolHash: currentPool,
      registrationObservedAt: Math.min(accountStart.observedAt, registrations.observedAt, delegations.observedAt), constructionTip, currentTip,
      slotConfig: { zeroTime: ZERO_TIME, zeroSlot: ZERO_SLOT, slotLength: 1000 }, parameters: parametersStart,
      wallet: { complete: true, observedAt: wallet.inputsObservedAt, utxos: wallet.inputs.utxos }, provider: { observedAt: inputObservedAt, utxos: providerInputs }, now });
    return freeze({ status: "ready", context, provenance });
  } catch (error) {
    const failure = sourceFailure(error, "RESPONSE"); return freeze({ status: "refused", code: failure.code, message: failure.message });
  } finally { source?.close(); }
}
