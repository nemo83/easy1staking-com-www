import { createBlockfrostRead } from "./blockfrost-reader";
import type { Observation, SourceRuntime } from "./blockfrost-reader";
import { ensure, SourceError, field, list, text, integer, decimal, hash } from "./provider-json";
import type { Json } from "./provider-json";
import { array, byteString, decode, fields, integer as cborInteger } from "./cbor";
import { bodyId } from "./crypto";
import { stakeBech32, poolHash } from "./source-cbor";
import { EASY1_HASH, EASY1_ID } from "./chain-context";
import { CoordinationError } from "./coordination";
import type { DelegationCoordinator, DelegationLease, DelegationResolution, RecoveryRecord } from "./coordination";

// Read-only status checking for one recovery record. It never touches a wallet, builds, signs or submits.
const ZERO_SLOT = BigInt(4492800), ZERO_TIME = BigInt("1596059091000"), THOUSAND = BigInt(1000), ZERO = BigInt(0), ONE = BigInt(1);
export type StatusReason = "CONFIRMED" | "NOT_FOUND" | "NEWER_THAN_TIP" | "INDEX_LAG" | "TX_IDENTITY" | "TX_CONTRACT" | "TX_VALIDITY" | "TX_COUNTS" |
  "BODY_ENCODING" | "BODY_ID" | "BODY_INPUTS" | "BODY_TTL" | "CERTIFICATES" | "CREDENTIAL" | "DEPOSIT" | "CERTIFICATE_ROWS" | "BLOCK_IDENTITY" |
  "POINT_FIELDS" | "POINT_RELATION" | "HISTORY" | "LATER_EVENT" | "ACCOUNT" | "TIP" | "PROVIDER" | "LIMIT" | "TIMEOUT" | "CANCELLED";
export type AccountState = "EASY1" | "other-pool" | "deregistered";
export type StatusOutcome =
  | { readonly status: "confirmed"; readonly reason: "CONFIRMED"; readonly txId: string; readonly blockHeight: string; readonly confirmations: string;
      readonly credential: string; readonly stakeAddress: string; readonly account: AccountState; readonly resolution: DelegationResolution }
  | { readonly status: "not-found" | "pending" | "inconsistent" | "unavailable"; readonly reason: StatusReason; readonly txId: string };
export interface LiveTip { readonly slot: bigint; readonly hash: string; readonly epoch: bigint; readonly observedAt: number; readonly height: bigint; readonly time: bigint }
export interface HistoricalPoint {
  readonly slot: bigint; readonly height: bigint; readonly time: bigint; readonly hash: string;
  /** Inclusion block only: its reported confirmations and the T1 height observed before it was read. */
  readonly confirmations?: bigint; readonly floor?: bigint;
}
class Verdict extends Error {
  constructor(readonly status: "pending" | "inconsistent" | "unavailable", readonly reason: StatusReason) { super(reason); this.name = "Verdict"; }
}
function contradict(condition: unknown, reason: StatusReason): asserts condition { if (!condition) throw new Verdict("inconsistent", reason); }
function lag(condition: unknown): asserts condition { if (!condition) throw new Verdict("pending", "INDEX_LAG"); }
function epoch(slot: bigint): bigint { ensure(slot >= ZERO_SLOT, "COHERENCE"); return BigInt(208) + (slot - ZERO_SLOT) / BigInt(432000); }
function timeAt(slot: bigint): bigint { return ZERO_TIME + (slot - ZERO_SLOT) * THOUSAND; }
function boolean(value: Json): boolean { ensure(typeof value === "boolean", "RESPONSE"); return value; }
function fresh(time: number, now: number): void { ensure(Number.isSafeInteger(time) && time >= 0 && time <= now && now - time <= 30000, "STALE"); }
/** Mirrors chain-context's live tip check: freshness, slot/epoch/time coherence. */
function liveTip(read: Observation, now: number): LiveTip {
  const row = read.value, slot = integer(field(row, "slot")), e = integer(field(row, "epoch")), time = integer(field(row, "time"));
  ensure(e === epoch(slot) && time * THOUSAND === timeAt(slot), "COHERENCE");
  fresh(Number(time * THOUSAND), now); fresh(read.observedAt, now);
  return Object.freeze({ slot, hash: hash(field(row, "hash")), epoch: e, observedAt: read.observedAt, height: integer(field(row, "height")), time });
}
/** Mirrors chain-context's live progress check, unchanged; it applies only to live tips. */
function progress(points: readonly LiveTip[]): void {
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const previous = points[i], current = points[j];
    ensure(current.observedAt >= previous.observedAt && current.epoch === previous.epoch, "COHERENCE");
    ensure(current.slot >= previous.slot, "COHERENCE");
    ensure(current.slot === previous.slot ? current.hash === previous.hash : current.hash !== previous.hash, "COHERENCE");
    ensure(current.slot === previous.slot ? current.height === previous.height : current.height > previous.height, "COHERENCE");
  }
}
/** A historical point may be old or from a prior epoch: no freshness or same-epoch rule. It owns every relation against T2. */
export function historicalPoint(point: HistoricalPoint, tip: LiveTip): void {
  contradict(typeof point.slot === "bigint" && typeof point.height === "bigint" && typeof point.time === "bigint" && /^[0-9a-f]{64}$/.test(point.hash) &&
    point.slot >= ZERO_SLOT && point.height >= ZERO && timeAt(point.slot) === point.time * THOUSAND &&
    (point.confirmations === undefined || typeof point.confirmations === "bigint" && typeof point.floor === "bigint" && point.confirmations >= ZERO), "POINT_FIELDS");
  const relation = (): boolean => {
    return point.height <= tip.height && point.slot <= tip.slot &&
      (point.height !== tip.height || point.hash === tip.hash && point.slot === tip.slot && point.time === tip.time) &&
      (point.slot !== tip.slot || point.hash === tip.hash && point.height === tip.height && point.time === tip.time) &&
      (point.slot >= tip.slot || point.height < tip.height) &&
      (point.confirmations === undefined || point.confirmations <= tip.height - point.height && point.confirmations >= point.floor! - point.height);
  };
  contradict(relation(), "POINT_RELATION");
}
interface Event { readonly point: HistoricalPoint; readonly index: bigint; readonly cert: bigint; readonly action: "registered" | "deregistered" | "delegated"; readonly pool: string | null; readonly original: boolean }
function compare(a: Event, b: Event): number {
  for (const [x, y] of [[a.point.slot, b.point.slot], [a.index, b.index], [a.cert, b.cert]]) if (x !== y) return x < y ? -1 : 1;
  return a.action === b.action ? 0 : a.action === "registered" ? -1 : 1;
}
function guarded<T>(reason: StatusReason, read: () => T): T {
  try { return read(); } catch (error) { if (error instanceof Verdict) throw error; throw new Verdict("inconsistent", reason); }
}
export interface StatusRequest { readonly generation: number; readonly deadline: number | null; readonly signal?: AbortSignal }
/** The verifier owns the coordinator's single resolution issuer: only a fully agreeing check obtains a confirmed Resolution. */
export function createRecoveryVerifier(projectId: string, coordinator: DelegationCoordinator, runtime?: SourceRuntime) {
  const issue = coordinator.resolutionIssuer();
  async function check(lease: DelegationLease, request: StatusRequest): Promise<StatusOutcome> {
    const record: RecoveryRecord = coordinator.recoveryRecord(lease), txId = record.txId;
    let source: ReturnType<typeof createBlockfrostRead> | undefined;
    try {
      source = createBlockfrostRead(projectId, request.signal, runtime); const read = source, started = read.clock();
      const after = async (path: string): Promise<Json> => {
        try { return (await read.get(path)).value; } catch (error) { if (error instanceof SourceError && error.code === "NOT_FOUND") throw new Verdict("pending", "INDEX_LAG"); throw error; }
      };
      const history = async (path: string): Promise<readonly Json[]> => {
        try { return list((await read.pages(path)).value); } catch (error) { if (error instanceof SourceError && error.code === "NOT_FOUND") throw new Verdict("pending", "INDEX_LAG"); throw error; }
      };
      // T1.
      let t1: LiveTip;
      try { t1 = liveTip(await read.get("/blocks/latest"), read.clock()); } catch (error) { throw error instanceof SourceError && (error.code === "STALE" || error.code === "COHERENCE") ? new Verdict("unavailable", "TIP") : error; }
      // Transaction content.
      let content: Json;
      try { content = (await read.get("/txs/" + txId)).value; }
      catch (error) { if (error instanceof SourceError && error.code === "NOT_FOUND") return Object.freeze({ status: "not-found", reason: "NOT_FOUND", txId }); throw error; }
      contradict(hash(field(content, "hash")) === txId, "TX_IDENTITY");
      contradict(boolean(field(content, "valid_contract")) === true, "TX_CONTRACT");
      const ttl = BigInt(record.invalidHereafterSlot), upper = field(content, "invalid_hereafter");
      contradict(upper !== null && decimal(upper, BigInt(Number.MAX_SAFE_INTEGER)) === ttl, "TX_VALIDITY");
      const point: HistoricalPoint = Object.freeze({ slot: integer(field(content, "slot")), height: integer(field(content, "block_height")), time: integer(field(content, "block_time")), hash: hash(field(content, "block")) });
      const txIndex = integer(field(content, "index"), BigInt(65535));
      contradict(point.slot >= ZERO_SLOT && timeAt(point.slot) === point.time * THOUSAND, "POINT_FIELDS");
      contradict(point.slot < ttl, "TX_VALIDITY");
      const count = (name: string) => integer(field(content, name), BigInt(65535));
      const stakeCerts = count("stake_cert_count");
      contradict(count("delegation_count") === ONE && (stakeCerts === ZERO || stakeCerts === ONE) && count("withdrawal_count") === ZERO && count("pool_update_count") === ZERO &&
        count("pool_retire_count") === ZERO && count("asset_mint_or_burn_count") === ZERO && count("redeemer_count") === ZERO && count("mir_cert_count") === ZERO, "TX_COUNTS");
      if (point.height > t1.height || point.slot > t1.slot) throw new Verdict("pending", "NEWER_THAN_TIP");
      const deposit = decimal(field(content, "deposit"));
      // Body: the exact on-chain bytes bind the record and are the only source of credential A.
      const signedHex = text(field(await after(`/txs/${txId}/cbor`), "cbor"));
      const signed = guarded("BODY_ENCODING", () => {
        ensure(/^(?:[0-9a-f]{2})+$/.test(signedHex), "RESPONSE"); const tx = array(decode(signedHex));
        ensure(tx.length === 4 && tx[0].kind === "map" && tx[1].kind === "map" && tx[2].kind === "simple" && tx[2].value === true && tx[3].kind === "simple" && tx[3].value === null, "RESPONSE");
        return tx;
      });
      const exactBody = signedHex.slice(signed[0].start * 2, signed[0].end * 2);
      contradict(bodyId(exactBody) === txId, "BODY_ID");
      const body = guarded("BODY_ENCODING", () => fields(signed[0], [0, 1, 2, 3, 4, 8, 14, 15]));
      const inputs = guarded("BODY_INPUTS", () => array(body.get(0)!, true).map(node => { const pair = array(node); ensure(pair.length === 2, "RESPONSE"); return byteString(pair[0], 32) + "#" + cborInteger(pair[1]).toString(); }));
      contradict(inputs.length === record.inputRefs.length && new Set(inputs).size === inputs.length && [...inputs].sort().join() === [...record.inputRefs].sort().join(), "BODY_INPUTS");
      contradict(guarded("BODY_TTL", () => cborInteger(body.get(3)!)) === ttl, "BODY_TTL");
      const certificates = guarded("CERTIFICATES", () => array(body.get(4)!, true).map(node => array(node)));
      const tags = guarded("CERTIFICATES", () => certificates.map(cert => cborInteger(cert[0]).toString()).join());
      contradict(tags === "2" || tags === "7,2" || tags === "11", "CERTIFICATES");
      const credentials = guarded("CREDENTIAL", () => certificates.map(cert => { const c = array(cert[1]); ensure(c.length === 2 && cborInteger(c[0]) === ZERO, "RESPONSE"); return byteString(c[1], 28); }));
      contradict(credentials.every(c => c === credentials[0]), "CREDENTIAL");
      const credential = credentials[0], stake = stakeBech32(credential), registration = tags !== "2";
      let certDeposit = ZERO;
      for (const cert of certificates) {
        const tag = guarded("CERTIFICATES", () => cborInteger(cert[0]));
        contradict(cert.length === (tag === BigInt(11) ? 4 : 3), "CERTIFICATES");
        if (tag !== BigInt(7)) contradict(guarded("CERTIFICATES", () => byteString(cert[2], 28)) === EASY1_HASH, "CERTIFICATES");
        if (tag !== BigInt(2)) certDeposit = guarded("DEPOSIT", () => cborInteger(cert[tag === BigInt(7) ? 2 : 3]));
      }
      contradict(registration ? certDeposit > ZERO && certDeposit === deposit : deposit === ZERO, "DEPOSIT");
      contradict(registration ? stakeCerts === ONE : stakeCerts === ZERO, "TX_COUNTS");
      const registrationIndex = ZERO, delegationIndex = tags === "7,2" ? ONE : ZERO;
      // Certificate rows implied by the body.
      const delegationRows = list(await after(`/txs/${txId}/delegations`)); lag(delegationRows.length > 0);
      contradict(delegationRows.length === 1 && integer(field(delegationRows[0], "cert_index"), BigInt(65535)) === delegationIndex &&
        text(field(delegationRows[0], "address")) === stake && text(field(delegationRows[0], "pool_id")) === EASY1_ID, "CERTIFICATE_ROWS");
      integer(field(delegationRows[0], "active_epoch"));
      if (registration) {
        const stakeRows = list(await after(`/txs/${txId}/stakes`)); lag(stakeRows.length > 0);
        contradict(stakeRows.length === 1 && integer(field(stakeRows[0], "cert_index"), BigInt(65535)) === registrationIndex &&
          text(field(stakeRows[0], "address")) === stake && boolean(field(stakeRows[0], "registration")) === true, "CERTIFICATE_ROWS");
      }
      // Inclusion block.
      const block = await after("/blocks/" + point.hash);
      contradict(hash(field(block, "hash")) === point.hash && integer(field(block, "height")) === point.height && integer(field(block, "slot")) === point.slot &&
        integer(field(block, "time")) === point.time, "BLOCK_IDENTITY");
      const inclusion: HistoricalPoint = Object.freeze({ ...point, confirmations: integer(field(block, "confirmations")), floor: t1.height });
      // Account view and complete ascending histories.
      const account = await after("/accounts/" + stake);
      const delegations = await history("/accounts/" + stake + "/delegations"), registrations = await history("/accounts/" + stake + "/registrations");
      const rowPoint = (row: Json) => ({ tx: hash(field(row, "tx_hash")), slot: integer(field(row, "tx_slot")), height: integer(field(row, "block_height")), time: integer(field(row, "block_time")) });
      for (const rows of [delegations, registrations]) {
        let lastSlot = ZERO, lastHeight = ZERO;
        for (const row of rows) { const p = rowPoint(row); contradict(p.slot >= lastSlot && p.height >= lastHeight, "HISTORY"); lastSlot = p.slot; lastHeight = p.height; }
      }
      const samePoint = (row: Json, p: HistoricalPoint) => { const r = rowPoint(row); return r.slot === p.slot && r.height === p.height && r.time === p.time; };
      const ownDelegations = delegations.filter(row => rowPoint(row).tx === txId), ownRegistrations = registrations.filter(row => rowPoint(row).tx === txId);
      lag(ownDelegations.length > 0);
      contradict(ownDelegations.length === 1 && text(field(ownDelegations[0], "pool_id")) === EASY1_ID && samePoint(ownDelegations[0], point), "HISTORY");
      decimal(field(ownDelegations[0], "amount")); integer(field(ownDelegations[0], "active_epoch"));
      if (registration) {
        lag(ownRegistrations.length > 0);
        contradict(ownRegistrations.length === 1 && text(field(ownRegistrations[0], "action")) === "registered" && samePoint(ownRegistrations[0], point) &&
          field(ownRegistrations[0], "deposit") !== null && decimal(field(ownRegistrations[0], "deposit")) === certDeposit, "HISTORY");
      } else contradict(ownRegistrations.length === 0, "HISTORY");
      // Later events: every row after the original (and any other row in its block) is reconstructed from its own transaction.
      const events: Event[] = [];
      if (registration) events.push({ point, index: txIndex, cert: registrationIndex, action: "registered", pool: null, original: true });
      events.push({ point, index: txIndex, cert: delegationIndex, action: "delegated", pool: EASY1_HASH, original: true });
      const later = (rows: readonly Json[]) => rows.filter(row => { const r = rowPoint(row); return r.tx !== txId && r.slot >= point.slot; });
      const laterDelegations = later(delegations), laterRegistrations = later(registrations);
      const laterIds = [...new Set([...laterDelegations, ...laterRegistrations].map(row => rowPoint(row).tx))];
      if (laterIds.length > 16) throw new Verdict("unavailable", "LIMIT");
      const points: HistoricalPoint[] = [];
      for (const id of laterIds) {
        const value = await after("/txs/" + id);
        contradict(hash(field(value, "hash")) === id && boolean(field(value, "valid_contract")) === true, "LATER_EVENT");
        const p: HistoricalPoint = Object.freeze({ slot: integer(field(value, "slot")), height: integer(field(value, "block_height")), time: integer(field(value, "block_time")), hash: hash(field(value, "block")) });
        const index = integer(field(value, "index"), BigInt(65535)); points.push(p);
        contradict(p.slot !== point.slot || p.hash === point.hash && p.height === point.height && index !== txIndex, "LATER_EVENT");
        const groups: [readonly Json[], "delegations" | "stakes", string][] = [[laterDelegations.filter(r => rowPoint(r).tx === id), "delegations", "delegation_count"], [laterRegistrations.filter(r => rowPoint(r).tx === id), "stakes", "stake_cert_count"]];
        for (const [group, endpoint, total] of groups) {
          if (group.length === 0) continue;
          for (const row of group) contradict(samePoint(row, p), "LATER_EVENT");
          const rows = list(await after(`/txs/${id}/${endpoint}`)); lag(rows.length > 0);
          contradict(BigInt(rows.length) === integer(field(value, total), BigInt(8192)), "LATER_EVENT");
          const seen = new Set<string>(); for (const row of rows) { const c = integer(field(row, "cert_index"), BigInt(65535)).toString(); contradict(!seen.has(c), "LATER_EVENT"); seen.add(c); }
          const own = rows.filter(row => text(field(row, "address")) === stake), remaining = [...own];
          contradict(own.length === group.length, "LATER_EVENT");
          for (const row of group) {
            if (endpoint === "delegations") {
              const pool = poolHash(text(field(row, "pool_id"))), active = integer(field(row, "active_epoch")); decimal(field(row, "amount"));
              const at = remaining.findIndex(c => poolHash(text(field(c, "pool_id"))) === pool && integer(field(c, "active_epoch")) === active); contradict(at !== -1, "LATER_EVENT");
              events.push({ point: p, index, cert: integer(field(remaining.splice(at, 1)[0], "cert_index")), action: "delegated", pool, original: false });
            } else {
              const action = text(field(row, "action")); contradict(action === "registered" || action === "deregistered", "LATER_EVENT");
              if (action === "registered") decimal(field(row, "deposit")); else contradict(field(row, "deposit") === null, "LATER_EVENT");
              const at = remaining.findIndex(c => boolean(field(c, "registration")) === (action === "registered")); contradict(at !== -1, "LATER_EVENT");
              events.push({ point: p, index, cert: integer(field(remaining.splice(at, 1)[0], "cert_index")), action, pool: null, original: false });
            }
          }
        }
      }
      events.sort(compare);
      for (let i = 1; i < events.length; i++) contradict(compare(events[i - 1], events[i]) !== 0, "LATER_EVENT");
      // The original leaves A registered and delegated to EASY1; only reconstructed later certificates may change that.
      let registered = true, pool: string | null = EASY1_HASH;
      for (const event of events.slice(events.findIndex(e => e.original && e.action === "delegated") + 1)) {
        if (event.action === "registered") { contradict(!registered, "LATER_EVENT"); registered = true; pool = null; }
        else if (event.action === "deregistered") { contradict(registered, "LATER_EVENT"); registered = false; pool = null; }
        else { contradict(registered, "LATER_EVENT"); pool = event.pool; }
      }
      contradict(text(field(account, "stake_address")) === stake, "ACCOUNT");
      const accountRegistered = boolean(field(account, "registered")), accountPool = field(account, "pool_id") === null ? null : poolHash(text(field(account, "pool_id")));
      contradict(accountRegistered === registered && accountPool === pool, "ACCOUNT");
      // T2 closes the envelope; live tips keep the existing checks, historical points use their own.
      let t2: LiveTip;
      try { t2 = liveTip(await read.get("/blocks/latest"), read.clock()); progress([t1, t2]); }
      catch (error) { throw error instanceof SourceError && (error.code === "STALE" || error.code === "COHERENCE") ? new Verdict("unavailable", "TIP") : error; }
      historicalPoint(inclusion, t2);
      for (const p of points) historicalPoint(p, t2);
      read.check();
      const deadline = Math.min(started + 30000, request.deadline ?? Number.POSITIVE_INFINITY);
      const resolution = issue(lease, Object.freeze({ kind: "confirmed", record: JSON.stringify(record), generation: request.generation,
        point: Object.freeze({ slot: t2.slot.toString(), hash: t2.hash, height: t2.height.toString() }), deadline }));
      return Object.freeze({ status: "confirmed", reason: "CONFIRMED", txId, blockHeight: point.height.toString(), confirmations: inclusion.confirmations!.toString(),
        credential, stakeAddress: stake, account: accountPool === EASY1_HASH ? "EASY1" : accountPool !== null ? "other-pool" : "deregistered", resolution });
    } catch (error) {
      if (error instanceof CoordinationError) throw error;
      if (error instanceof Verdict) return Object.freeze({ status: error.status, reason: error.reason, txId });
      const code = error instanceof SourceError ? error.code : null;
      return Object.freeze({ status: "unavailable", reason: code === "TIMEOUT" ? "TIMEOUT" : code === "CANCELLED" ? "CANCELLED" : code === "LIMIT" ? "LIMIT" : "PROVIDER", txId });
    } finally { source?.close(); }
  }
  return Object.freeze({ check });
}
