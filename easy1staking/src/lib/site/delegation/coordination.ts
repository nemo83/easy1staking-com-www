// Dormant browser bookkeeping only: tokens do not attest to wallet or chain state.
export const DELEGATION_LOCK_NAME = "easy1staking:delegation";
export const DELEGATION_RECORD_KEY = "easy1staking:delegation-recovery";
export const DELEGATION_POOL_ID = "pool1yr0cv3dtmhcfgqa6yetvmf769ngk89e6tepecmjrmjl2jzcw2lm";

export type RecoveryStage = "prepared" | "submitting" | "submitted" | "unknown";
export interface RecoveryRecord {
  readonly schemaVersion: 1;
  readonly networkId: 1;
  readonly poolId: typeof DELEGATION_POOL_ID;
  readonly txId: string;
  readonly invalidHereafterSlot: string;
  readonly inputRefs: readonly string[];
  readonly createdAt: number;
  readonly stage: RecoveryStage;
}
export interface RecoveryState {
  readonly status: "absent" | "pending" | "unknown" | "invalid" | "unavailable";
  readonly txId: string | null;
  readonly record: RecoveryRecord | null;
  readonly persisted: boolean | null;
}
export type CoordinationCode = "UNAVAILABLE" | "BUSY" | "PENDING" | "LOST" | "RECORD" | "LEASE" | "INTENT" | "RESOLUTION" | "CANCELLED" | "OPERATION";
const messages: Record<CoordinationCode, string> = {
  UNAVAILABLE: "Browser coordination is unavailable. Use your wallet directly.",
  BUSY: "Another delegation operation is active in this browser.",
  PENDING: "A prior operation in this browser is unresolved. Check its status.",
  LOST: "Recovery storage changed or disappeared. Keep the known transaction ID for checking.",
  RECORD: "The recovery record is unsupported or invalid.",
  LEASE: "This delegation operation is no longer active.",
  INTENT: "This intent cannot authorize the requested operation.",
  RESOLUTION: "This status result cannot resolve the recovery record.",
  CANCELLED: "This delegation operation was cancelled.",
  OPERATION: "The delegation operation could not complete.",
};
export class CoordinationError extends Error {
  constructor(readonly code: CoordinationCode) { super(messages[code]); this.name = "CoordinationError"; }
}
function insist(condition: unknown, code: CoordinationCode): asserts condition {
  if (!condition) throw new CoordinationError(code);
}
const recordKeys = ["schemaVersion", "networkId", "poolId", "txId", "invalidHereafterSlot", "inputRefs", "createdAt", "stage"];
const stages: readonly string[] = ["prepared", "submitting", "submitted", "unknown"];
const hexId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
function exactKeys(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  insist(value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(value, key)), "RECORD");
}
function canonicalRecord(value: unknown): RecoveryRecord {
  exactKeys(value, recordKeys);
  insist(value.schemaVersion === 1 && value.networkId === 1 && value.poolId === DELEGATION_POOL_ID, "RECORD");
  insist(hexId(value.txId), "RECORD");
  insist(typeof value.invalidHereafterSlot === "string" && /^(0|[1-9][0-9]{0,15})$/.test(value.invalidHereafterSlot), "RECORD");
  const slot = BigInt(value.invalidHereafterSlot);
  insist(slot >= BigInt(4492800) && slot <= BigInt(Number.MAX_SAFE_INTEGER), "RECORD");
  insist(Array.isArray(value.inputRefs) && value.inputRefs.length >= 1 && value.inputRefs.length <= 2048, "RECORD");
  const refs = value.inputRefs as unknown[];
  insist(Array.from(refs).every(ref => typeof ref === "string" && /^[0-9a-f]{64}#(0|[1-9][0-9]{0,4})$/.test(ref) &&
    Number(ref.slice(65)) <= 65535) && new Set(refs).size === refs.length, "RECORD");
  insist(typeof value.createdAt === "number" && Number.isSafeInteger(value.createdAt) && value.createdAt >= 0 && !Object.is(value.createdAt, -0), "RECORD");
  insist(typeof value.stage === "string" && stages.includes(value.stage), "RECORD");
  return Object.freeze({ schemaVersion: 1, networkId: 1, poolId: DELEGATION_POOL_ID, txId: value.txId,
    invalidHereafterSlot: value.invalidHereafterSlot, inputRefs: Object.freeze([...refs] as string[]),
    createdAt: value.createdAt, stage: value.stage as RecoveryStage });
}
export function serializeRecoveryRecord(value: unknown): string {
  try { return JSON.stringify(canonicalRecord(value)); } catch { throw new CoordinationError("RECORD"); }
}
export function parseRecoveryRecord(raw: unknown): RecoveryRecord {
  try {
    insist(typeof raw === "string" && raw.length <= 150000, "RECORD");
    const record = canonicalRecord(JSON.parse(raw));
    insist(JSON.stringify(record) === raw, "RECORD");
    return record;
  } catch { throw new CoordinationError("RECORD"); }
}

declare const leaseBrand: unique symbol;
declare const intentBrand: unique symbol;
declare const resolutionBrand: unique symbol;
declare const dismissalBrand: unique symbol;
export interface DelegationLease { readonly [leaseBrand]: true }
export interface DelegationIntent { readonly [intentBrand]: true }
export interface DelegationResolution { readonly [resolutionBrand]: true }
/** Single-use W7 manual-dismissal authority: bound to the exact record, status generation and action. */
export interface DismissalAuthority { readonly [dismissalBrand]: true }
/** What a confirmed (or, after expiry, dismissible) status check binds: the exact record, status generation, observed T2 and issuer deadline. */
export interface ResolutionClaim {
  readonly kind: "confirmed" | "dismissible";
  readonly record: string;
  readonly generation: number;
  readonly point: { readonly slot: string; readonly hash: string; readonly height: string };
  readonly deadline: number;
}
export type ResolutionIssuer = (lease: DelegationLease, claim: ResolutionClaim) => DelegationResolution;
export interface IntentDetails {
  readonly txId: string;
  readonly invalidHereafterSlot: string;
  readonly inputRefs: readonly string[];
  readonly createdAt: number;
}
interface LeaseState { active: boolean; mode: "new" | "recovery"; txId: string | null }
interface Candidate { record: RecoveryRecord; attempted: boolean }
interface IntentState { lease: DelegationLease; candidate: Candidate }
interface ResolutionState { lease: DelegationLease; kind: ResolutionClaim["kind"]; record: string; generation: number; point: ResolutionClaim["point"]; deadline: number; consumed: boolean }
interface AuthorityState { record: string; generation: number; action: "dismiss"; consumed: boolean }
export interface DelegationCoordinator {
  getState(): RecoveryState;
  withNewOperation<T>(callback: (lease: DelegationLease) => Promise<T>, options?: { signal?: AbortSignal }): Promise<T>;
  withRecoveryOperation<T>(txId: string, callback: (lease: DelegationLease) => Promise<T>, options?: { signal?: AbortSignal }): Promise<T>;
  prepare(lease: DelegationLease, details: IntentDetails): DelegationIntent;
  recoverUnattempted(lease: DelegationLease): DelegationIntent;
  assertActive(lease: DelegationLease): void;
  assertAttempt(lease: DelegationLease, intent: DelegationIntent): void;
  beginAttempt(lease: DelegationLease, intent: DelegationIntent): RecoveryRecord;
  markOutcome(lease: DelegationLease, intent: DelegationIntent, stage: "submitted" | "unknown"): RecoveryRecord;
  cancelUnattempted(lease: DelegationLease, intent: DelegationIntent): void;
  recoveryRecord(lease: DelegationLease): RecoveryRecord;
  beginStatus(): number;
  endStatus(generation: number): void;
  resolutionIssuer(): ResolutionIssuer;
  resolveConfirmed(lease: DelegationLease, resolution: DelegationResolution): void;
  offerDismissal(lease: DelegationLease, resolution: DelegationResolution): DismissalAuthority;
  resolveDismissed(lease: DelegationLease, authority: DismissalAuthority, resolution: DelegationResolution): void;
  dispose(): void;
}

export function createDelegationCoordinator(): DelegationCoordinator {
  let disposed = false, known: RecoveryRecord | null = null, lost = false, invalid = false, unavailable = false;
  let persisted: boolean | null = null, candidate: Candidate | null = null, statusGeneration = 0, issuerTaken = false;
  const leases = new WeakMap<DelegationLease, LeaseState>(), intents = new WeakMap<DelegationIntent, IntentState>();
  const resolutions = new WeakMap<DelegationResolution, ResolutionState>(), authorities = new WeakMap<DismissalAuthority, AuthorityState>();
  const cancellations = new Set<() => void>();
  function storage(): Storage {
    try { return window.localStorage; } catch { throw new CoordinationError("UNAVAILABLE"); }
  }
  function identity(record: RecoveryRecord): string { return JSON.stringify({ ...record, stage: "prepared" }); }
  function read(): RecoveryRecord | null {
    insist(!invalid, "RECORD");
    let raw: string | null;
    try { raw = storage().getItem(DELEGATION_RECORD_KEY); unavailable = false; }
    catch { unavailable = true; if (known) lost = true; throw new CoordinationError("UNAVAILABLE"); }
    let record: RecoveryRecord | null = null;
    try { if (raw !== null) record = parseRecoveryRecord(raw); invalid = false; }
    catch { invalid = true; if (known) lost = true; throw new CoordinationError(known ? "LOST" : "RECORD"); }
    if (known) {
      const transitions: Record<RecoveryStage, readonly RecoveryStage[]> = {
        prepared: ["prepared", "submitting", "submitted", "unknown"], submitting: ["submitting", "submitted", "unknown"],
        submitted: ["submitted", "unknown"], unknown: ["unknown"],
      };
      if (!record || identity(record) !== identity(known) || !transitions[known.stage].includes(record.stage)) lost = true;
    }
    if (!lost && record) known = record;
    insist(!lost, "LOST");
    return record;
  }
  function getState(): RecoveryState {
    if (!disposed) { try { read(); } catch { /* Expose only neutral validated recovery state. */ } }
    return Object.freeze({ status: lost ? "unknown" : unavailable ? "unavailable" : invalid ? "invalid" : known ? "pending" : "absent",
      txId: known?.txId ?? null, record: known, persisted });
  }
  function onStorage(event: StorageEvent): void {
    if (disposed || (event.key !== DELEGATION_RECORD_KEY && event.key !== null)) return;
    // An event still witnesses a removal/replacement when another tab restores
    // the bytes before this task runs. Validate its payload, then read current state.
    const raw = event.newValue ?? event.oldValue;
    if (raw !== null) {
      try {
        const observed = parseRecoveryRecord(raw);
        if (!known) known = observed;
        else if (identity(observed) !== identity(known)) lost = true;
      } catch { invalid = true; if (known) lost = true; }
    }
    if (known && (event.key === null || event.newValue === null)) lost = true;
    try { read(); } catch { /* Retain the known ID. */ }
  }
  try { window.addEventListener("storage", onStorage); } catch { throw new CoordinationError("UNAVAILABLE"); }
  function active(lease: DelegationLease): LeaseState {
    const state = leases.get(lease);
    insist(!disposed && state?.active, "LEASE");
    return state;
  }
  function recovering(lease: DelegationLease): LeaseState {
    const state = active(lease);
    insist(state.mode === "recovery" && hexId(state.txId), "LEASE");
    return state;
  }
  function matching(lease: DelegationLease, intent: DelegationIntent): Candidate {
    active(lease);
    const state = intents.get(intent);
    insist(state && state.lease === lease && state.candidate === candidate, "INTENT");
    const record = read();
    insist(record && JSON.stringify(record) === JSON.stringify(state.candidate.record), "INTENT");
    return state.candidate;
  }
  function issue(lease: DelegationLease, value: Candidate): DelegationIntent {
    const token = Object.freeze({}) as DelegationIntent;
    intents.set(token, { lease, candidate: value });
    return token;
  }
  function write(record: RecoveryRecord): void {
    const raw = serializeRecoveryRecord(record);
    // Retain identity even when a partial write/readback fails; no attempt is authorized.
    known = record;
    try {
      const store = storage(); store.setItem(DELEGATION_RECORD_KEY, raw);
      const retained = store.getItem(DELEGATION_RECORD_KEY);
      insist(retained === raw && serializeRecoveryRecord(parseRecoveryRecord(retained)) === raw, "UNAVAILABLE");
    } catch { lost = true; unavailable = true; throw new CoordinationError("UNAVAILABLE"); }
  }
  function probeStorage(): void {
    let store: Storage | null = null, key: string | null = null, owned = false;
    try {
      store = storage(); key = DELEGATION_RECORD_KEY + ":probe:" + crypto.randomUUID();
      insist(store.getItem(key) === null, "UNAVAILABLE"); owned = true;
      store.setItem(key, "coordination-probe"); insist(store.getItem(key) === "coordination-probe", "UNAVAILABLE");
      store.removeItem(key); insist(store.getItem(key) === null, "UNAVAILABLE");
    } catch {
      if (owned && store && key) { try { store.removeItem(key); } catch { /* No native details escape. */ } }
      unavailable = true; throw new CoordinationError("UNAVAILABLE");
    }
  }
  async function run<T>(mode: "new" | "recovery", txId: string | null,
    callback: (lease: DelegationLease) => Promise<T>, options?: { signal?: AbortSignal }): Promise<T> {
    insist(!disposed && !options?.signal?.aborted, "CANCELLED");
    let rejectCancellation: (error: CoordinationError) => void = () => {};
    let lease: DelegationLease | null = null;
    const cancellation = new Promise<never>((_, reject) => { rejectCancellation = reject; });
    void cancellation.catch(() => {});
    let cancelled = false;
    let entered = false;
    const cancel = () => {
      cancelled = true;
      if (lease) { const state = leases.get(lease); if (state) state.active = false; }
      rejectCancellation(new CoordinationError("CANCELLED"));
    };
    cancellations.add(cancel); options?.signal?.addEventListener("abort", cancel, { once: true });
    try {
      let locks: LockManager;
      try { locks = navigator.locks; insist(locks && typeof locks.request === "function", "UNAVAILABLE"); }
      catch { throw new CoordinationError("UNAVAILABLE"); }
      return await locks.request(DELEGATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
        insist(lock, "BUSY"); insist(!cancelled && !disposed, "CANCELLED");
        entered = true;
        lease = Object.freeze({}) as DelegationLease;
        const currentLease = lease, state: LeaseState = { active: true, mode, txId };
        leases.set(currentLease, state);
        const work = async () => {
          probeStorage();
          try {
            if (typeof navigator.storage?.persisted === "function") persisted = await navigator.storage.persisted();
          } catch { persisted = null; }
          active(currentLease);
          const record = read();
          if (mode === "new") insist(!record && !known && !lost, "PENDING");
          else insist(hexId(txId) && record && record.txId === txId, "PENDING");
          return await callback(currentLease);
        };
        // The native waiting promise spans the entire caller operation; cancellation
        // revokes authority before releasing it, and observes late promise settlement.
        try { return await Promise.race([work(), cancellation]); }
        finally { state.active = false; }
      });
    } catch (error) {
      let code: CoordinationCode = entered ? "OPERATION" : "UNAVAILABLE";
      try {
        if (error instanceof CoordinationError) {
          const reported = error.code;
          if (typeof reported === "string" && Object.prototype.hasOwnProperty.call(messages, reported)) code = reported;
        }
      } catch { /* Caller-owned errors cannot forward payloads or throwing accessors. */ }
      throw new CoordinationError(code);
    } finally {
      cancellations.delete(cancel); options?.signal?.removeEventListener("abort", cancel);
    }
  }
  return Object.freeze({
    getState,
    withNewOperation: <T>(callback: (lease: DelegationLease) => Promise<T>, options?: { signal?: AbortSignal }) => run("new", null, callback, options),
    withRecoveryOperation: <T>(txId: string, callback: (lease: DelegationLease) => Promise<T>, options?: { signal?: AbortSignal }) => run("recovery", txId, callback, options),
    prepare(lease: DelegationLease, details: IntentDetails): DelegationIntent {
      insist(active(lease).mode === "new", "LEASE");
      const record = read(); insist(!record && !known && !lost, "PENDING");
      try { exactKeys(details, ["txId", "invalidHereafterSlot", "inputRefs", "createdAt"]); }
      catch { throw new CoordinationError("RECORD"); }
      const next = parseRecoveryRecord(serializeRecoveryRecord({ schemaVersion: 1, networkId: 1, poolId: DELEGATION_POOL_ID,
        txId: details.txId, invalidHereafterSlot: details.invalidHereafterSlot, inputRefs: details.inputRefs,
        createdAt: details.createdAt, stage: "prepared" }));
      write(next); candidate = { record: next, attempted: false }; return issue(lease, candidate);
    },
    recoverUnattempted(lease: DelegationLease): DelegationIntent {
      insist(active(lease).mode === "recovery", "LEASE");
      const record = read();
      insist(candidate && !candidate.attempted && record && JSON.stringify(record) === JSON.stringify(candidate.record), "INTENT");
      return issue(lease, candidate);
    },
    assertActive(lease: DelegationLease): void { active(lease); read(); },
    assertAttempt(lease: DelegationLease, intent: DelegationIntent): void {
      const current = matching(lease, intent);
      insist(current.attempted && current.record.stage === "submitting", "INTENT");
    },
    beginAttempt(lease: DelegationLease, intent: DelegationIntent): RecoveryRecord {
      insist(active(lease).mode === "new", "LEASE");
      const current = matching(lease, intent);
      insist(!current.attempted && current.record.stage === "prepared", "INTENT");
      current.attempted = true;
      const next = parseRecoveryRecord(serializeRecoveryRecord({ ...current.record, stage: "submitting" }));
      write(next); current.record = next; return next;
    },
    markOutcome(lease: DelegationLease, intent: DelegationIntent, stage: "submitted" | "unknown"): RecoveryRecord {
      const current = matching(lease, intent);
      insist(current.attempted && current.record.stage === "submitting" && (stage === "submitted" || stage === "unknown"), "INTENT");
      const next = parseRecoveryRecord(serializeRecoveryRecord({ ...current.record, stage }));
      write(next); current.record = next; return next;
    },
    cancelUnattempted(lease: DelegationLease, intent: DelegationIntent): void {
      const current = matching(lease, intent);
      insist(!current.attempted && current.record.stage === "prepared", "INTENT");
      try {
        const store = storage(); store.removeItem(DELEGATION_RECORD_KEY);
        insist(store.getItem(DELEGATION_RECORD_KEY) === null, "UNAVAILABLE");
      } catch { lost = true; unavailable = true; throw new CoordinationError("UNAVAILABLE"); }
      candidate = null; known = null;
    },
    recoveryRecord(lease: DelegationLease): RecoveryRecord {
      const state = recovering(lease), record = read();
      insist(record && record.txId === state.txId, "LOST");
      return record;
    },
    beginStatus(): number { insist(!disposed, "CANCELLED"); return ++statusGeneration; },
    endStatus(generation: number): void { if (generation === statusGeneration) statusGeneration++; },
    /** Handed out once; the recovery verifier takes it at construction, so no other caller can mint a resolution. */
    resolutionIssuer(): ResolutionIssuer {
      insist(!disposed && !issuerTaken, "OPERATION");
      issuerTaken = true;
      return Object.freeze((lease: DelegationLease, claim: ResolutionClaim): DelegationResolution => {
        const state = recovering(lease);
        insist(claim !== null && typeof claim === "object" && (claim.kind === "confirmed" || claim.kind === "dismissible") && claim.generation === statusGeneration &&
          typeof claim.deadline === "number" && Number.isFinite(claim.deadline) && Date.now() < claim.deadline &&
          typeof claim.point?.slot === "string" && typeof claim.point.hash === "string" && typeof claim.point.height === "string", "RESOLUTION");
        const record = read();
        insist(record && record.txId === state.txId && JSON.stringify(record) === claim.record, "RESOLUTION");
        const token = Object.freeze({}) as DelegationResolution;
        resolutions.set(token, { lease, kind: claim.kind, record: claim.record, generation: claim.generation,
          point: Object.freeze({ slot: claim.point.slot, hash: claim.point.hash, height: claim.point.height }), deadline: claim.deadline, consumed: false });
        return token;
      });
    },
    resolveConfirmed(lease: DelegationLease, resolution: DelegationResolution): void {
      const state = recovering(lease);
      const issued = resolution !== null && typeof resolution === "object" ? resolutions.get(resolution) : undefined;
      insist(issued && !issued.consumed && issued.lease === lease && issued.kind === "confirmed" && issued.generation === statusGeneration, "RESOLUTION");
      const record = read();
      insist(record && record.txId === state.txId && JSON.stringify(record) === issued.record, "RESOLUTION");
      insist(Date.now() < issued.deadline, "RESOLUTION"); // Checked immediately before removal.
      issued.consumed = true;
      try {
        const store = storage(); store.removeItem(DELEGATION_RECORD_KEY);
        insist(store.getItem(DELEGATION_RECORD_KEY) === null, "UNAVAILABLE");
      } catch { lost = true; unavailable = true; throw new CoordinationError("UNAVAILABLE"); }
      candidate = null; known = null; statusGeneration++;
    },
    /** Consumes a dismissible resolution of this lease; the authority alone removes nothing. */
    offerDismissal(lease: DelegationLease, resolution: DelegationResolution): DismissalAuthority {
      const state = recovering(lease);
      const offered = resolution !== null && typeof resolution === "object" ? resolutions.get(resolution) : undefined;
      insist(offered && !offered.consumed && offered.lease === lease && offered.kind === "dismissible" && offered.generation === statusGeneration, "RESOLUTION");
      const record = read();
      insist(record && record.txId === state.txId && JSON.stringify(record) === offered.record && Date.now() < offered.deadline, "RESOLUTION");
      offered.consumed = true;
      const token = Object.freeze({}) as DismissalAuthority;
      authorities.set(token, { record: offered.record, generation: offered.generation, action: "dismiss", consumed: false });
      return token;
    },
    /** Every clause is checked synchronously immediately before removal; both tokens are consumed only then. */
    resolveDismissed(lease: DelegationLease, authority: DismissalAuthority, resolution: DelegationResolution): void {
      const state = recovering(lease);
      const granted = authority !== null && typeof authority === "object" ? authorities.get(authority) : undefined;
      insist(granted && !granted.consumed && granted.action === "dismiss", "RESOLUTION");
      insist(granted.generation === statusGeneration, "RESOLUTION"); // Authority generation.
      const minted = resolution !== null && typeof resolution === "object" ? resolutions.get(resolution) : undefined;
      insist(minted && !minted.consumed && minted.kind === "dismissible" && minted.generation === statusGeneration, "RESOLUTION");
      insist(minted.lease === lease, "RESOLUTION"); // Resolution from this same lease.
      const record = read();
      insist(record && record.txId === state.txId && JSON.stringify(record) === minted.record, "RESOLUTION");
      insist(JSON.stringify(record) === granted.record, "RESOLUTION"); // Authority record.
      insist(Date.now() < minted.deadline, "RESOLUTION"); // Resolution deadline.
      granted.consumed = true; minted.consumed = true;
      try {
        const store = storage(); store.removeItem(DELEGATION_RECORD_KEY);
        insist(store.getItem(DELEGATION_RECORD_KEY) === null, "UNAVAILABLE");
      } catch { lost = true; unavailable = true; throw new CoordinationError("UNAVAILABLE"); }
      candidate = null; known = null; statusGeneration++;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true; statusGeneration++;
      window.removeEventListener("storage", onStorage);
      for (const cancel of cancellations) cancel();
    },
  });
}
