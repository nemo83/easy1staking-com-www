import { createWalletSession, WalletSignatureError } from "./wallet-session";
import { createDelegationCoordinator, CoordinationError, DELEGATION_POOL_ID } from "./coordination";
import type { DelegationLease, DelegationIntent, DismissalAuthority, RecoveryRecord, RecoveryState } from "./coordination";
import { assessChainContext } from "./chain-context";
import type { ChainAssessment } from "./chain-context";
import { MAINNET_SOURCE } from "./blockfrost-reader";
import { assembleSignedTransaction, validateBeforeSigning, verifySignedTransaction } from "./guard";
import { createRecoveryVerifier } from "./recovery-verifier";
import type { AccountState, StatusOutcome } from "./recovery-verifier";
import { GuardError } from "./types";
import type { AcceptedTransaction, Review } from "./types";
import { DISMISSAL_COPY, RETRY_COPY, SUBMIT_COPY, failureCode, failureMessage } from "./messages";
import { REPORT_BODY_LIMIT, reportedValidationError } from "./submit-reply";
import type { FailureKind, StopReason } from "./messages";

const clock = Date.now, invoke = Reflect.apply;
type Ready = Extract<ChainAssessment, { status: "ready" }>;
// The builder (and the SDK) is only ever loaded with a dynamic import; this is a type, never a value import.
type BuilderModule = typeof import("./builder");
export interface DelegationReview {
  readonly account: string;
  readonly poolId: string;
  readonly fee: string;
  readonly deposit: string;
  readonly expiresAt: number;
}
/** Historical chain fact for the original credential A, never attributed to a currently connected wallet. */
export interface DelegationConfirmation {
  readonly txId: string;
  readonly message: string;
  readonly blockHeight: string;
  readonly confirmations: string;
  readonly credential: string;
  readonly account: AccountState;
}
/** The W7 dismissal offer for an expired, unseen record; offered only by a deliberate check, opened and confirmed only by explicit actions. */
export interface DelegationDismissal {
  readonly stage: "offered" | "open" | "confirming";
  readonly txId: string;
  readonly spentElsewhere: boolean;
}
/** A record the visitor dismissed after checking its ID themselves; never a chain confirmation. Kept for the page lifetime only. */
export interface DelegationDismissed {
  readonly txId: string;
  readonly message: string;
}
/** Machine code of a W7 deliberate retry's ending; never rendered. */
export type RetryReason = "SENT" | "UNKNOWN" | "STATUS" | "EASY1" | "EXPIRED" | "STOPPED" | "BUSY" | "CHANGED";
export interface DelegationView {
  readonly phase: "disconnected" | "connecting" | "assessing" | "ready" | "building" | "review" | "signing" | "checking" | "submitting" | "submitted" | "unknown" | "already-EASY1" | "refused" |
    "confirmed" | "check-later" | "inconsistent" | "changed" | "other-pending" | "expired-unseen" | "dismissed";
  readonly message: string;
  readonly walletId: string | null;
  readonly account: string | null;
  readonly review: DelegationReview | null;
  readonly txId: string | null;
  readonly recovery: RecoveryState;
  readonly walletBrowseHref: string | null;
  readonly statusRunning: boolean;
  readonly statusUntil: number | null;
  readonly canCheckStatus: boolean;
  /** Machine outcome and reason code of the last completed status check, for example "inconsistent:BODY_ID". */
  readonly statusReason: string | null;
  readonly confirmation: DelegationConfirmation | null;
  /** A frozen object whose identity changes only with its stage, or null. */
  readonly dismissal: DelegationDismissal | null;
  /** Shown only while its ID is the active one. */
  readonly dismissed: DelegationDismissed | null;
  /** Machine kind:code of the last failure message, for example "wallet:REFUSED" or "stop:cancel-idle". Never rendered. */
  readonly failureReason: string | null;
  /** Set by Disconnect while a result or a cancelled operation stays on screen; cleared by the next Connect. */
  readonly walletDisconnected: boolean;
  /** True only while this tab may deliberately send its retained signed transaction again (W7). */
  readonly canRetry: boolean;
  /** The last retry's ending, cleared when the next retry starts. Never rendered. */
  readonly retryReason: RetryReason | null;
  /** True only while the status line is Blockfrost's reported validation error for the active ID: a provider report, never chain evidence. */
  readonly reported: boolean;
}
/** A flow veto; a source refusal carries only its owned code out of ready(). */
class FlowFailure extends Error { constructor(readonly sourceCode: unknown = null) { super(); } }
/** Blockfrost reported a validation error for a first attempt's bytes (submit-reply.ts); thrown only by transmit's first-attempt 400 path. */
class ValidationReported extends Error {}
interface Operation {
  readonly abort: AbortController;
  readonly revision: number;
  approval: { view: DelegationReview; decide: (approved: boolean) => void } | null;
  attempted: boolean;
  txId: string | null;
  dispatchedAt: number | null;
  /** The first stop reason latched on this operation; a later automatic cancel never replaces it. */
  stop: StopReason | null;
}
/** Status work has its own cancellation and generation authority, separate from cancel(). */
interface StatusWork {
  readonly abort: AbortController;
  readonly generation: number;
  readonly txId: string;
  readonly deadline: number | null;
  expired: boolean;
  resolved: Extract<StatusOutcome, { status: "confirmed" }> | null;
  /** The dismissal authority a deliberate check obtained under its lease; it never leaves the controller. */
  offered: { readonly authority: DismissalAuthority; readonly spentElsewhere: boolean } | null;
  /** The confirm recheck of a dismissal offer, run with the offer's generation. */
  readonly confirming: boolean;
}
/** A live dismissal offer: its authority, its open generation and the single confirm attempt it allows. */
interface Offer {
  readonly txId: string;
  readonly generation: number;
  readonly authority: DismissalAuthority;
  used: boolean;
  work: StatusWork | null;
}
/** The signed transaction of an unknown first attempt in this tab, with the reviews it was checked against. Page memory only: never stored, logged or shown. */
interface Retained {
  readonly txId: string;
  readonly issued: Review;
  readonly original: Ready;
  readonly last: Ready;
  readonly signed: AcceptedTransaction;
  readonly bytes: Uint8Array;
  readonly record: RecoveryRecord;
  readonly revision: number;
}
type RetryResult = { readonly reason: RetryReason; readonly kind?: FailureKind; readonly code?: unknown; readonly confirmed?: Extract<StatusOutcome, { status: "confirmed" }> };
type Unseen = Extract<StatusOutcome, { readonly spentElsewhere: boolean }>;
type StatusStep = { readonly kind: "confirmed"; readonly outcome: Extract<StatusOutcome, { status: "confirmed" }> } |
  { readonly kind: "continue" | "busy" | "inconsistent" | "changed" | "offered" | "spent" | "seen" };
const OTHER_PENDING = "Another delegation from this browser is pending. Keep its transaction ID and check its status.";
const CHANGED = "This operation's saved status changed in another tab of this browser. Keep the transaction ID and check it in your wallet or a chain explorer.";
// Transaction-result phases that an idle Disconnect leaves exactly as they are.
const RESULT_PHASES: readonly DelegationView["phase"][] = ["submitted", "unknown", "confirmed", "check-later", "inconsistent", "changed", "other-pending", "expired-unseen", "dismissed"];
const APOLOGY = "Sorry, we couldn't confirm your delegation yet. Confirmation usually takes about 20 seconds but can take longer. Please check again here in a few minutes, or check later in your wallet.";
/** The page receives display data and deliberate actions; handles, reviews and bytes stay private. */
export function createDelegationController(projectId: string) {
  const post = window.fetch, owner = createWalletSession(id => {
    try { return (window as unknown as { cardano?: Record<string, unknown> }).cardano?.[id]; } catch { return null; }
  }), coordinator = createDelegationCoordinator(), verifier = createRecoveryVerifier(projectId, coordinator);
  const listeners = new Set<() => void>();
  let disposed = false, serial = 0, operation: Operation | null = null, coordinationReady = false;
  // The confirmed result is held apart from the wallet/action phase; it is shown only while its ID is the active one.
  let status: StatusWork | null = null, resolved: DelegationConfirmation | null = null, statusReason: string | null = null;
  let phase: DelegationView["phase"] = "disconnected", message = "Choose a wallet to connect.", review: DelegationReview | null = null;
  let txId: string | null = null, failureReason: string | null = null, walletDisconnected = false, connecting: number | null = null, walletCalls = 0;
  // W7 manual dismissal: at most one live offer; the dismissed result is held apart from the wallet/action phase like the confirmed one.
  let offer: Offer | null = null, dismissal: DelegationDismissal | null = null, dismissed: DelegationDismissed | null = null;
  // Page-lifetime latches, never stored: an ID once spent by its own ID, or once positively witnessed, is never offered for dismissal here.
  const spentIds = new Set<string>(), witnessedIds = new Set<string>();
  // Page-lifetime latch, never stored: IDs whose first attempt drew a Blockfrost validation-error report; any later attempt clears it.
  const reportedIds = new Set<string>();
  // Page-lifetime latch, never stored: IDs a deliberate check found expired and unseen. Conservative page policy, not a proof of chain finality:
  // a resend after this page observed the expiry would end EXPIRED without a POST, so it is not offered.
  const expiredIds = new Set<string>();
  // W7 deliberate retry: the retained bytes (dropped on every invalidating event) and the last retry's ending.
  let retained: Retained | null = null, retryReason: RetryReason | null = null;
  const fail = (): never => { throw new FlowFailure(); };
  function recovery(): RecoveryState { return coordinator.getState(); }
  /** Counts a wallet call this page started (connect, an operation's recheck, a signature) until it settles; background refreshes are not counted. */
  function tracked<T>(call: Promise<T>): Promise<T> {
    let open = true; walletCalls++;
    const settle = () => { if (open) { open = false; walletCalls--; } };
    call.then(settle, settle); return call;
  }
  function walletCallOpen(): boolean { return walletCalls > 0; }
  /** Display text from an owned code only; the machine reason is kept beside it and never rendered. */
  function failure(kind: FailureKind, code: unknown): string {
    const known = failureCode(kind, code);
    failureReason = known === null ? null : (kind === "source-stop" ? "source" : kind) + ":" + known;
    return failureMessage(kind, code);
  }
  function stopped(op: Operation): string { return failure("stop", op.stop); }
  /** Owned error classes only, by instanceof; `.code` is read inside try/catch and `.message` never. */
  function classify(error: unknown, builder: BuilderModule | null): string {
    let kind: FailureKind | null = null, code: unknown;
    try {
      if (error instanceof FlowFailure) { if (error.sourceCode !== null) { kind = "source-stop"; code = error.sourceCode; } }
      else if (error instanceof WalletSignatureError) { kind = "signature"; code = error.code; }
      else if (error instanceof GuardError) { kind = "guard"; code = error.code; }
      else if (builder && error instanceof builder.BuildError) { kind = "build"; code = error.code; }
    } catch { kind = null; }
    return kind === null ? failure("stop", null) : failure(kind, code);
  }
  function expire(op: Operation): never { if (op.stop === null) op.stop = "expired"; return fail(); }
  function view(): DelegationView {
    const state = owner.getState(), prior = recovery();
    // The active ID is the newest operation known to this page: its own attempt, then the recovery record (pending, or kept after it changed), then the retained confirmation.
    const active = (operation?.attempted ? operation.txId : null) ?? prior.txId ?? txId;
    const origin = window.location.origin;
    const browse = coordinationReady && !disposed && phase === "disconnected" && !operation && state.walletId === null && prior.status === "absent" &&
      (origin === "https://easy1staking.com" || origin === "https://preview.easy1staking.com");
    return Object.freeze({ phase, message, walletId: state.walletId, account: state.observation?.binding.stakeKeyHash ?? null,
      review, txId: active, recovery: prior,
      walletBrowseHref: browse ? "web+cardano://browse/v1?uri=" + encodeURIComponent(origin + "/pool") : null,
      statusRunning: status !== null, statusUntil: status?.deadline ?? null, confirmation: resolved !== null && resolved.txId === active ? resolved : null, statusReason,
      dismissal, dismissed: dismissed !== null && dismissed.txId === active ? dismissed : null,
      canCheckStatus: !disposed && !status && !operation && prior.status === "pending" && prior.record !== null, failureReason, walletDisconnected,
      canRetry: retryable(), retryReason, reported: message === SUBMIT_COPY.reported });
  }
  function emit(): void { if (!disposed) for (const listener of listeners) { try { listener(); } catch { /* Display only. */ } } }
  function show(next: DelegationView["phase"], text: string): void { phase = next; message = text; emit(); }
  function current(op: Operation): void {
    if (disposed || operation !== op || op.abort.signal.aborted || owner.getState().revision !== op.revision) fail();
  }
  /** Stops any connect or operation in flight. The reason is latched on the operation; the first one wins. */
  function halt(reason: StopReason): void {
    serial++;
    const op = operation;
    if (op) { if (op.stop === null) op.stop = reason; op.abort.abort(); op.approval?.decide(false); }
    review = null;
    if (op?.attempted) { txId = op.txId; show("unknown", "Submission outcome is unknown. Keep this transaction ID and check from this browser."); }
    else show(owner.getState().walletId ? "refused" : "disconnected", op ? stopped(op) : failure("stop", reason));
  }
  // "Wallet call open" is decided at the trigger, before anything is aborted.
  function cancel(): void { halt(walletCallOpen() ? "cancel-open" : "cancel-idle"); }
  owner.subscribe(() => {
    const state = owner.getState();
    if (retained && state.revision !== retained.revision) retained = null;
    if (operation && state.revision !== operation.revision) halt("changed");
    else if (!operation && state.phase === "failed") show("refused", "The wallet changed or became unavailable. Reconnect to assess again.");
    else emit();
  });
  owner.attachBrowser(window, document);
  const onStorage = () => {
    // Another tab's pending record for a different ID supersedes this page's last ID, and any confirmation it holds.
    const prior = recovery();
    if (retained && (prior.status !== "pending" || prior.txId !== retained.txId)) retained = null;
    // A dismissal offer is withdrawn once its record is no longer pending under its ID; a same-ID pending update keeps it (Confirm checks the exact record).
    if (!disposed && offer && (prior.status !== "pending" || prior.txId !== offer.txId)) { withdraw(); show("changed", CHANGED); return; }
    if (!disposed && !operation && txId !== null && phase !== "other-pending" && prior.status === "pending" && prior.txId !== txId) { txId = prior.txId; show("other-pending", OTHER_PENDING); }
    // Once shown, the other tab's ID is this page's ID: its removal or replacement shows the changed guidance and never restores an earlier confirmation.
    else if (!disposed && phase === "other-pending" && prior.status !== "pending") show("changed", CHANGED);
    else emit();
  };
  window.addEventListener("storage", onStorage);
  void coordinator.withNewOperation(async lease => { coordinator.assertActive(lease); }).then(() => {
    coordinationReady = true; emit();
  }, () => { coordinationReady = false; emit(); });
  function observed(op?: Operation): ReturnType<typeof owner.getState> {
    if (op) current(op);
    const state = owner.getState();
    if (state.phase !== "observed" || !owner.hasCurrentHandle() || !state.observation) fail();
    return state;
  }
  async function source(op?: Operation, prior?: Ready): Promise<ChainAssessment> {
    const state = observed(op);
    const result = await assessChainContext(state, projectId, { signal: op?.abort.signal,
      prior: prior ? { constructionTip: prior.context.constructionTip, currentTip: prior.context.currentTip, identity: prior.provenance.identity } : undefined });
    if (op) current(op);
    if (owner.getState().revision !== state.revision || owner.getState().observation !== state.observation) fail();
    return result;
  }
  function ready(result: ChainAssessment): Ready {
    if (result.status === "already-EASY1") { show("already-EASY1", "This account already delegates to EASY1. No transaction is needed."); fail(); }
    if (result.status === "ready") return result;
    throw new FlowFailure(result.status === "refused" ? result.code : null);
  }
  async function connect(id: string): Promise<void> {
    if (disposed || operation) return;
    const token = ++serial; review = null; failureReason = null; walletDisconnected = false; connecting = token;
    show("connecting", "Confirm the connection in your chosen wallet.");
    try {
      await tracked(owner.connect(id)); if (disposed || serial !== token) return;
      observed(); show("assessing", "Checking current account, inputs and EASY1 eligibility.");
      const result = await source(); if (disposed || serial !== token) return;
      if (result.status === "already-EASY1") show("already-EASY1", "This account already delegates to EASY1. No transaction is needed.");
      else if (result.status === "ready") show("ready", "Current account and EASY1 eligibility checked. Build a stake-only review when ready.");
      else show("refused", failure("source", result.code));
    } catch {
      if (disposed || serial !== token) return;
      let code: unknown = null;
      try { code = owner.getState().error; } catch { code = null; }
      show("refused", failure("wallet", code));
    }
    finally { if (connecting === token) connecting = null; }
  }
  async function fresh(op: Operation, previous?: Ready): Promise<Ready> {
    await tracked(owner.recheck()); current(op);
    return ready(await source(op, previous));
  }
  function finalBarrier(op: Operation, authorize: () => void, result: Ready, original: Ready,
    issued: Review, signed: AcceptedTransaction, bytes: Uint8Array, deadlineAt: number): number {
    authorize();
    current(op);
    const state = observed(op), c = result.context, time = clock();
    if (time >= deadlineAt || time < deadlineAt - 30000) expire(op); // authentic-reply-deadline
    if (result.provenance.identity.source !== MAINNET_SOURCE || result.provenance.identity.networkId !== 1 ||
      result.provenance.identity.semantics !== original.provenance.identity.semantics ||
      result.provenance.identity.eligibility !== original.provenance.identity.eligibility || c.revision !== state.revision ||
      c.changeAddressHex !== state.observation!.binding.changeAddressHex) fail();
    for (const at of [result.provenance.observedAt, c.bindingObservedAt, c.registrationObservedAt, c.parameters.observedAt,
      c.wallet.observedAt, c.provider.observedAt, c.currentTip.observedAt, state.observation!.bindingObservedAt,
      state.observation!.rewardsObservedAt, state.observation!.inputsObservedAt, state.observation!.finalBindingObservedAt]) if (at > time || time - at > 30000) fail();
    const wallSlot = c.slotConfig.zeroSlot + BigInt(Math.floor((time - Number(c.slotConfig.zeroTime)) / c.slotConfig.slotLength));
    if (issued.invalidHereafter !== original.context.constructionTip.slot + BigInt(600)) fail();
    if (issued.invalidHereafter - c.currentTip.slot < BigInt(120) || issued.invalidHereafter - wallSlot < BigInt(120)) expire(op);
    if (signed.txId !== issued.txId || !signed.signedHex.startsWith("84" + issued.bodyHex) ||
      bytes.length * 2 !== signed.signedHex.length || signed.signedHex !== Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")) fail();
    current(op); // No display/provider callbacks or property lookup follows this barrier.
    return time;
  }
  /** The single outward submission, shared by the first attempt and the deliberate retry: the captured fetch, a 60 s deadline over the reply
   * headers and every body read, and an authentic-reply check. The barrier runs immediately before the POST; this resolves only on an authentic reply. */
  async function transmit(op: Operation, id: string, bytes: Uint8Array, barrier: () => number, classifyFirstAttempt400 = false): Promise<void> {
    const transport = new AbortController();
    const options: RequestInit = { method: "POST", headers: { project_id: projectId, "content-type": "application/cbor", accept: "application/json" },
      body: bytes, credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer", signal: transport.signal };
    const abort = () => transport.abort(); op.abort.signal.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const expired = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { transport.abort(); reject(new FlowFailure()); }, 60000);
        transport.signal.addEventListener("abort", () => reject(new FlowFailure()), { once: true });
      });
      // A veto may precede the first race; cleanup can still abort this promise.
      void expired.catch(() => {});
      op.dispatchedAt = barrier();
      op.txId = id; op.attempted = true;
      const responsePromise = invoke(post, window, [MAINNET_SOURCE + "/tx/submit", options]) as Promise<Response>;
      reportedIds.delete(id); // A newer attempt supersedes an earlier report.
      const response = await Promise.race([responsePromise, expired]);
      current(op);
      // W8, first attempt only: a 400 is read, bounded, only to classify it (submit-reply.ts); its body is never rendered, stored or logged.
      if (classifyFirstAttempt400 && response.status === 400) {
        const reader = response.body?.getReader(); if (!reader) fail();
        const parts: Uint8Array[] = []; let size = 0;
        while (true) {
          const part = await Promise.race([reader!.read(), expired]); current(op);
          if (part.done) break;
          size += part.value.length;
          if (size > REPORT_BODY_LIMIT) { void reader!.cancel().catch(() => {}); fail(); }
          parts.push(part.value);
        }
        const body = new Uint8Array(size); let at = 0;
        for (const chunk of parts) { body.set(chunk, at); at += chunk.length; }
        if (reportedValidationError(response.status, response.redirected, response.headers.get("content-type"), body)) throw new ValidationReported();
        fail();
      }
      if (response.status !== 200 || response.redirected || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type") ?? "")) fail();
      // Bound even an adversarial/malformed response body; no response payload reaches the page.
      const reader = response.body?.getReader(); if (!reader) fail();
      let text = "";
      while (true) {
        const part = await Promise.race([reader!.read(), expired]); current(op);
        if (part.done) break;
        if (text.length + part.value.length > 256) { void reader!.cancel().catch(() => {}); fail(); }
        text += new TextDecoder("utf-8", { fatal: true }).decode(part.value);
      }
      if (!/^"[0-9a-f]{64}"$/.test(text) || text.slice(1, -1) !== id) fail();
    } finally { if (timer !== undefined) clearTimeout(timer); op.abort.signal.removeEventListener("abort", abort); transport.abort(); }
  }
  async function submit(op: Operation, lease: DelegationLease, issued: Review, result: Ready, original: Ready,
    signed: AcceptedTransaction, deadlineAt: number): Promise<void> {
    const bytes = new Uint8Array(signed.signedHex.match(/../g)!.map(b => parseInt(b, 16)));
    let replied = false;
    const intent = coordinator.prepare(lease, { txId: issued.txId, invalidHereafterSlot: issued.invalidHereafter.toString(),
      inputRefs: issued.inputRefs, createdAt: clock() });
    try {
      show("submitting", "Sending the reviewed transaction once. Submission does not mean confirmation.");
      coordinator.beginAttempt(lease, intent);
      await transmit(op, issued.txId, bytes, () => finalBarrier(op, () => coordinator.assertAttempt(lease, intent), result, original, issued, signed, bytes, deadlineAt), true);
      replied = true;
      coordinator.markOutcome(lease, intent, "submitted");
      txId = issued.txId; show("submitted", "Submitted to Blockfrost. Chain confirmation is still pending. Keep the ID for independent checking.");
    } catch (error) {
      if (op.attempted) {
        let written: RecoveryRecord | null = null;
        try { written = coordinator.markOutcome(lease, intent, "unknown"); } catch { /* The private ID survives lost storage or lease. */ }
        // W8: a first-attempt validation error that Blockfrost reported is shown as that report; record, bytes and resend stay exactly as for an unknown outcome.
        const reported = error instanceof ValidationReported && written !== null && !disposed && !op.abort.signal.aborted && owner.getState().revision === op.revision;
        if (reported) reportedIds.add(issued.txId);
        // W7: only an unknown outcome this tab recorded keeps a private copy of the exact bytes for a deliberate retry.
        if (!replied && written !== null && !disposed && owner.getState().revision === op.revision)
          retained = { txId: issued.txId, issued, original, last: result, signed, bytes: new Uint8Array(bytes), record: written, revision: op.revision };
        txId = issued.txId; show("unknown", reported ? SUBMIT_COPY.reported : "Submission outcome is unknown. Keep this transaction ID; do not build or send another delegation.");
      } else {
        // Only this process can prove that no outward call happened. Preserve any uncertain record.
        try { coordinator.cancelUnattempted(lease, intent); } catch { /* A conservative retained intent blocks another operation. */ }
        throw new FlowFailure();
      }
    }
  }
  async function prepare(): Promise<void> {
    if (disposed || operation || phase !== "ready") return;
    const op: Operation = { abort: new AbortController(), revision: owner.getState().revision, approval: null, attempted: false, txId: null, dispatchedAt: null, stop: null };
    operation = op; review = null; failureReason = null;
    try {
      await coordinator.withNewOperation(async lease => {
        let builder: BuilderModule | null = null;
        try {
          current(op); show("building", "Checking fresh information and building the exact stake-only review.");
          const initial = await fresh(op);
          builder = await import("./builder"); current(op); coordinator.assertActive(lease);
          const built = builder.buildStakeTransaction({ ...initial.context, now: clock() });
          const issued = built.review;
          const expiresAt = Number(initial.context.slotConfig.zeroTime + (issued.invalidHereafter - initial.context.slotConfig.zeroSlot) * BigInt(1000));
          const display = Object.freeze({ account: issued.stakeKeyHash, poolId: DELEGATION_POOL_ID, fee: issued.fee.toString(), deposit: issued.deposit.toString(), expiresAt });
          const approved = new Promise<boolean>(decide => { op.approval = { view: display, decide }; });
          review = display; show("review", "Review the account, EASY1 target, exact fee, separate deposit and expiry before approving.");
          if (!await approved) fail(); current(op); op.approval = null; review = null;
          const presign = await fresh(op, initial); current(op); coordinator.assertActive(lease);
          validateBeforeSigning(issued, { ...presign.context, now: clock() });
          show("signing", "Approve this stake-only transaction in your wallet. Your voting delegation stays unchanged.");
          const signature = await tracked(owner.requestSignature(issued, presign.context, { signal: op.abort.signal }));
          current(op); const receipt = owner.signatureReceipt(signature);
          const postTimer = setTimeout(() => { if (!op.attempted) { if (op.stop === null) op.stop = "expired"; op.abort.abort(); } }, Math.max(0, receipt.deadlineAt - clock()));
          try {
            show("checking", "Verifying signatures and fresh account, input and pool observations before sending.");
            const after = ready(await source(op, presign));
            const signed = await assembleSignedTransaction(signature.witnessHex, issued, { ...after.context, now: clock() });
            current(op);
            await submit(op, lease, issued, after, initial, signed, receipt.deadlineAt);
          } finally { clearTimeout(postTimer); }
        } catch (error) {
          // Precedence: an attempt keeps its unknown text, then the latched stop reason, then the owned code, then the fallback.
          if (op.attempted) { txId = op.txId; show("unknown", "Submission outcome is unknown. Keep the transaction ID and check in this browser."); }
          else if (!["already-EASY1"].includes(phase)) show("refused", op.stop !== null ? stopped(op) : classify(error, builder));
        }
      }, { signal: op.abort.signal });
    } catch (error) {
      if (op.attempted) { txId = op.txId; show("unknown", "Submission outcome is unknown. Keep the transaction ID and check in this browser."); }
      else if (!["already-EASY1"].includes(phase)) {
        let code: unknown = null;
        try { if (error instanceof CoordinationError) code = error.code; } catch { code = null; }
        show("refused", op.stop !== null ? stopped(op) : failure("coordination", code));
      }
    } finally { if (operation === op) operation = null; review = null; emit(); }
    // The new-operation lock is released: poll for at most three minutes after dispatch.
    if (op.attempted && op.txId !== null && op.dispatchedAt !== null) startStatus(op.txId, op.dispatchedAt + 180000);
  }
  function live(work: StatusWork): boolean { return !disposed && status === work; }
  /** The not-found, busy or budget ending of status work: a page-latched report keeps its text unless the ID was since seen or spent. */
  function pendingEnding(id: string): void {
    show("check-later", reportedIds.has(id) && !witnessedIds.has(id) && !spentIds.has(id) ? SUBMIT_COPY.reported : APOLOGY);
  }
  function startStatus(id: string, deadline: number | null): void {
    if (disposed || status || operation) return;
    const prior = recovery(); if (prior.status !== "pending" || prior.txId !== id) return;
    // The automatic budget already ended (for example a tab suspended past dispatch + 180 s): apologise now, without a check.
    if (deadline !== null && clock() >= deadline) { txId = id; pendingEnding(id); return; }
    let generation: number; try { generation = coordinator.beginStatus(); } catch { return; }
    const work: StatusWork = { abort: new AbortController(), generation, txId: id, deadline, expired: false, resolved: null, offered: null, confirming: false };
    status = work; emit();
    void runStatus(work);
  }
  function latch(result: StatusOutcome): void {
    if (result.witnessed) witnessedIds.add(result.txId);
    if (result.status === "inconsistent" && result.reason === "SPENT_BY_ID") spentIds.add(result.txId);
    if (result.status === "not-found" && result.reason === "EXPIRED_UNSEEN") expiredIds.add(result.txId);
  }
  function dismissible(result: StatusOutcome): result is Unseen {
    return result.status === "not-found" && result.reason === "EXPIRED_UNSEEN" && !spentIds.has(result.txId) && !witnessedIds.has(result.txId);
  }
  /** One bounded read session under the recovery lock; it never enables or calls the wallet, builds, signs or posts. */
  async function statusCheck(work: StatusWork): Promise<StatusStep> {
    let outcome: StatusOutcome;
    try {
      outcome = await coordinator.withRecoveryOperation(work.txId, async lease => {
        // Only the deliberate check (and the confirm recheck) asks for the W7 eligibility reads; the automatic poll never does.
        const result = await verifier.check(lease, { generation: work.generation, deadline: work.deadline, signal: work.abort.signal, dismissal: work.deadline === null || work.confirming });
        latch(result);
        if (live(work)) statusReason = result.status + ":" + result.reason;
        if (result.status === "confirmed" && live(work)) { coordinator.resolveConfirmed(lease, result.resolution); work.resolved = result; }
        else if (dismissible(result) && work.deadline === null && live(work)) work.offered = { authority: coordinator.offerDismissal(lease, result.resolution), spentElsewhere: result.spentElsewhere };
        return result;
      }, { signal: work.abort.signal });
    } catch (error) {
      if (work.resolved) return { kind: "confirmed", outcome: work.resolved };
      if (work.offered) return { kind: "offered" };
      const code = error instanceof CoordinationError ? error.code : "OPERATION";
      return { kind: code === "BUSY" ? "busy" : code === "LOST" || code === "PENDING" || code === "RECORD" ? "changed" : "continue" };
    }
    if (work.resolved) return { kind: "confirmed", outcome: work.resolved };
    if (work.offered) return { kind: "offered" };
    // A latched ID: a later expired-unseen answer makes no offer, and a spend by its own ID is never cleared.
    if (outcome.status === "inconsistent" && outcome.reason === "SPENT_BY_ID" || outcome.status === "not-found" && outcome.reason === "EXPIRED_UNSEEN")
      return { kind: spentIds.has(work.txId) ? "spent" : witnessedIds.has(work.txId) ? "seen" : "continue" };
    return { kind: outcome.status === "inconsistent" ? "inconsistent" : "continue" };
  }
  async function runStatus(work: StatusWork): Promise<void> {
    let step: StatusStep = { kind: "continue" }, timer: ReturnType<typeof setTimeout> | undefined;
    // The automatic budget expires at its absolute deadline: abort the in-flight check and revoke its resolution.
    if (work.deadline !== null) timer = setTimeout(() => { work.expired = true; work.abort.abort(); coordinator.endStatus(work.generation); }, Math.max(0, work.deadline - clock()));
    try {
      if (work.deadline === null) step = await statusCheck(work);
      else while (live(work) && !work.expired && clock() < work.deadline) {
        const started = clock();
        step = await statusCheck(work);
        if (step.kind !== "continue" && step.kind !== "busy") break;
        const wait = Math.min(started + 10000, work.deadline) - clock();
        if (wait > 0) await new Promise<void>(resolve => {
          const pause = setTimeout(resolve, wait);
          work.abort.signal.addEventListener("abort", () => { clearTimeout(pause); resolve(); }, { once: true });
        });
      }
    } finally { if (timer !== undefined) clearTimeout(timer); }
    if (!live(work)) return;
    // A live offer keeps its generation open (no endStatus) until it is used or withdrawn.
    status = null; if (step.kind !== "offered") coordinator.endStatus(work.generation); txId = work.txId;
    if (step.kind === "offered" && work.offered) {
      offer = { txId: work.txId, generation: work.generation, authority: work.offered.authority, used: false, work: null };
      dismissal = Object.freeze<DelegationDismissal>({ stage: "offered", txId: work.txId, spentElsewhere: work.offered.spentElsewhere });
      show("expired-unseen", failureMessage("recovery", "expired-unseen"));
    } else if (step.kind === "confirmed") confirmedResult(work.txId, step.outcome);
    else if (step.kind === "spent") show("inconsistent", failureMessage("recovery", "spent-by-id"));
    else if (step.kind === "seen") show("check-later", failureMessage("recovery", "seen-unverified"));
    else if (step.kind === "inconsistent") show("inconsistent", "We found this transaction but couldn't verify it consistently. Nothing was cleared. Check again later, or check it in your wallet or a chain explorer.");
    else if (step.kind === "changed") show("changed", "This operation's saved status changed in another tab of this browser. Keep the transaction ID and check it in your wallet or a chain explorer.");
    else pendingEnding(work.txId);
  }
  function confirmedResult(id: string, o: Extract<StatusOutcome, { status: "confirmed" }>): void {
    if (retained?.txId === id) retained = null;
    const text = `Your delegation transaction was confirmed on chain in block ${o.blockHeight} (${o.confirmations} confirmation${o.confirmations === "1" ? "" : "s"}).`;
    resolved = Object.freeze({ txId: id, message: text, blockHeight: o.blockHeight, confirmations: o.confirmations, credential: o.credential, account: o.account });
    show("confirmed", text);
  }
  /** One deliberate bounded check, also after a reload; there is no automatic poll on reload. */
  async function checkStatus(): Promise<void> {
    const prior = recovery();
    if (prior.status === "pending" && prior.txId) { if (!disposed && !status && !operation) withdraw(); startStatus(prior.txId, null); }
  }
  /** Drops a live offer's authority, abandons its confirm recheck and ends its generation. The record is never touched. */
  function withdraw(): void {
    const o = offer; if (!o) return;
    offer = null; dismissal = null;
    if (o.work && status === o.work) { status = null; o.work.abort.abort(); }
    coordinator.endStatus(o.generation);
  }
  function openDismissal(view: DelegationDismissal): void {
    if (disposed || !offer || view !== dismissal || view.stage !== "offered") return;
    dismissal = Object.freeze<DelegationDismissal>({ ...view, stage: "open" }); emit();
  }
  /** The keep action, also during the confirm recheck, whose late result then has no effect. */
  function closeDismissal(view: DelegationDismissal): void {
    if (disposed || !offer || view !== dismissal) return;
    withdraw(); statusReason = "dismiss:KEPT"; show("check-later", failureMessage("recovery", "dismiss-kept"));
  }
  /** The typed attestation plus a distinct Confirm: one recheck under a new lease; only a fresh, eligible resolution for the same record removes it.
   * It never calls the wallet, builds, signs or posts. */
  async function confirmDismissal(view: DelegationDismissal, attestation: unknown): Promise<void> {
    const o = offer;
    if (disposed || !o || view !== dismissal || view.stage !== "open" || o.used || typeof attestation !== "string" || attestation !== DISMISSAL_COPY.attestationPhrase) return;
    o.used = true; dismissal = Object.freeze<DelegationDismissal>({ ...view, stage: "confirming" });
    const work: StatusWork = { abort: new AbortController(), generation: o.generation, txId: o.txId, deadline: null, expired: false, resolved: null, offered: null, confirming: true };
    o.work = work; status = work; emit();
    let removed = false, code: unknown = null;
    try {
      await coordinator.withRecoveryOperation(work.txId, async lease => {
        const result = await verifier.check(lease, { generation: work.generation, deadline: null, signal: work.abort.signal, dismissal: true });
        latch(result);
        if (!live(work)) return;
        statusReason = result.status + ":" + result.reason;
        if (result.status === "confirmed") { coordinator.resolveConfirmed(lease, result.resolution); work.resolved = result; }
        else if (dismissible(result)) { coordinator.resolveDismissed(lease, o.authority, result.resolution); removed = true; }
      }, { signal: work.abort.signal });
    } catch (error) { code = error instanceof CoordinationError ? error.code : "OPERATION"; }
    if (!live(work)) return;
    // The end of any confirm attempt withdraws the offer.
    status = null; offer = null; dismissal = null; coordinator.endStatus(work.generation); txId = work.txId;
    if (work.resolved) { statusReason = "confirmed:CONFIRMED"; confirmedResult(work.txId, work.resolved); }
    else if (removed) {
      if (retained?.txId === work.txId) retained = null;
      const text = failureMessage("recovery", "dismissed");
      statusReason = "dismissed:USER"; dismissed = Object.freeze({ txId: work.txId, message: text }); show("dismissed", text);
    } else if (code === "LOST" || code === "PENDING" || code === "RECORD") { statusReason = "dismiss:" + code; show("changed", CHANGED); }
    else if (code !== null) { statusReason = "dismiss:" + String(code); show("check-later", failureMessage("recovery", "dismiss-kept")); }
    else if (spentIds.has(work.txId)) show("inconsistent", failureMessage("recovery", "spent-by-id"));
    else if (witnessedIds.has(work.txId)) show("check-later", failureMessage("recovery", "seen-unverified"));
    else show("check-later", failureMessage("recovery", "dismiss-kept"));
  }
  /** The one W7 retry predicate, shared by the view's offer and retry(). */
  function retryable(): boolean {
    if (disposed || retained === null || operation !== null || status !== null || offer !== null || (phase !== "unknown" && phase !== "check-later")) return false;
    const prior = recovery(), state = owner.getState();
    return prior.status === "pending" && prior.txId === retained.txId && state.phase === "observed" && state.revision === retained.revision &&
      !spentIds.has(retained.txId) && !witnessedIds.has(retained.txId) && !expiredIds.has(retained.txId);
  }
  /** The retry's authority: an active lease whose stored record is exactly the one this page last wrote. */
  function authority(lease: DelegationLease, kept: Retained): void {
    coordinator.assertActive(lease);
    if (JSON.stringify(coordinator.recoveryRecord(lease)) !== JSON.stringify(kept.record)) throw new CoordinationError("RECORD");
  }
  /** Any retry error as an owned ending: after the attempt always UNKNOWN; then BUSY, a changed record, a latched stop, the owned code. */
  function retryEnding(op: Operation, error: unknown): RetryResult {
    if (op.attempted) return { reason: "UNKNOWN" };
    let kind: FailureKind = "stop", code: unknown = null;
    try {
      const reported = error instanceof CoordinationError ? error.code : null;
      if (reported === "BUSY") return { reason: "BUSY", kind: "coordination", code: reported };
      if (reported === "LOST" || reported === "PENDING" || reported === "RECORD") return { reason: "CHANGED" };
      if (op.stop !== null) return { reason: "STOPPED", kind: "stop", code: op.stop };
      if (reported !== null && reported !== "CANCELLED") { kind = "coordination"; code = reported; }
      else if (error instanceof GuardError) { kind = "guard"; code = error.code; }
      else if (error instanceof FlowFailure && error.sourceCode !== null) { kind = "source"; code = error.sourceCode; }
    } catch { kind = "stop"; code = null; }
    return { reason: "STOPPED", kind, code };
  }
  /** One presentation step after a retry settles. A stop that halt() latched keeps halt's phase and text. */
  function present(op: Operation, kept: Retained, result: RetryResult, reconciled: string | null): void {
    if (reconciled !== null) statusReason = reconciled;
    retryReason = result.reason; txId = kept.txId;
    const halted = op.stop === "cancel-open" || op.stop === "cancel-idle" || op.stop === "changed";
    if (result.reason === "SENT") { retained = null; show("submitted", "Submitted to Blockfrost. Chain confirmation is still pending. Keep the ID for independent checking."); }
    else if (result.reason === "UNKNOWN") { if (halted) emit(); else show("unknown", "Submission outcome is unknown. Keep this transaction ID; do not build or send another delegation."); }
    else if (result.reason === "STATUS" && result.confirmed) confirmedResult(kept.txId, result.confirmed);
    else if (result.reason === "STATUS") { if (spentIds.has(kept.txId) || witnessedIds.has(kept.txId)) retained = null; show("check-later", RETRY_COPY.unresolved); }
    else if (result.reason === "EASY1") { retained = null; show("check-later", RETRY_COPY.easy1); }
    else if (result.reason === "EXPIRED") { retained = null; show("check-later", RETRY_COPY.expired); }
    else if (result.reason === "BUSY") show("check-later", failure("coordination", "BUSY"));
    else if (result.reason === "CHANGED") { retained = null; show("changed", CHANGED); }
    else if (halted) emit();
    else { failure(result.kind ?? "stop", result.code ?? null); show("check-later", RETRY_COPY.stopped); }
  }
  /** W7 deliberate retry: the identical signed bytes for the same ID, once per click, under the origin lock and against the exact record
   * this page wrote. It never rebuilds, re-signs, writes the record or runs automatically. */
  async function retry(): Promise<void> {
    if (!retryable()) return;
    const kept = retained!;
    const clickAt = clock(), retryDeadline = clickAt + 30000;
    const op: Operation = { abort: new AbortController(), revision: kept.revision, approval: null, attempted: false, txId: null, dispatchedAt: null, stop: null };
    operation = op; retryReason = null; failureReason = null;
    show("checking", RETRY_COPY.checking);
    // A fresh budget from this click; it never cuts an attempt already dispatched.
    const timer = setTimeout(() => { if (op.attempted) return; if (op.stop === null) op.stop = "expired"; op.abort.abort(); }, Math.max(0, retryDeadline - clock()));
    let generation: number | null = null, reconciled: string | null = null, result: RetryResult;
    try {
      const g = generation = coordinator.beginStatus();
      result = await coordinator.withRecoveryOperation(kept.txId, async (lease): Promise<RetryResult> => {
        try {
          authority(lease, kept);
          const found = await verifier.check(lease, { generation: g, deadline: retryDeadline, signal: op.abort.signal, dismissal: false });
          latch(found); current(op);
          reconciled = found.status + ":" + found.reason;
          if (found.status === "confirmed") { coordinator.resolveConfirmed(lease, found.resolution); return { reason: "STATUS", confirmed: found }; }
          if (found.status !== "not-found" || found.reason !== "NOT_FOUND") return { reason: "STATUS" };
          await tracked(owner.recheck()); current(op);
          const unbound = await source(op);
          if (unbound.status === "already-EASY1") return { reason: "EASY1" };
          if (unbound.status !== "ready") return { reason: "STOPPED", kind: "source", code: unbound.status === "refused" ? unbound.code : null };
          const after = await source(op, kept.last);
          if (after.status !== "ready") return { reason: "STOPPED", kind: "source", code: after.status === "refused" ? after.code : null };
          if (kept.issued.invalidHereafter - after.context.currentTip.slot < BigInt(120)) return { reason: "EXPIRED" };
          const verified = await verifySignedTransaction(kept.signed.signedHex, kept.issued, { ...after.context, now: clock() }); current(op);
          show("submitting", RETRY_COPY.sending);
          await transmit(op, kept.txId, kept.bytes, () => { authority(lease, kept); return finalBarrier(op, () => authority(lease, kept), after, kept.original, kept.issued, verified, kept.bytes, retryDeadline); });
          return { reason: "SENT" };
        } catch (error) { return retryEnding(op, error); }
      }, { signal: op.abort.signal });
    } catch (error) { result = retryEnding(op, error); }
    finally { clearTimeout(timer); if (operation === op) operation = null; if (generation !== null) coordinator.endStatus(generation); }
    if (!disposed) present(op, kept, result, reconciled);
    if (op.attempted && op.dispatchedAt !== null) startStatus(kept.txId, op.dispatchedAt + 180000);
  }
  function approve(display: DelegationReview): void {
    const op = operation;
    if (!op || phase !== "review" || op.approval?.view !== display || review !== display || op.abort.signal.aborted) return;
    const decision = op.approval; op.approval = null; phase = "checking"; decision.decide(true);
  }
  function disconnect(): void {
    retained = null;
    // A connect or operation in flight is cancelled as by Cancel here; an idle transaction result keeps its phase and message.
    const inFlight = operation !== null || connecting !== null, kept = inFlight || RESULT_PHASES.includes(phase);
    if (inFlight) cancel(); else { serial++; review = null; }
    owner.disconnect(); review = null;
    if (kept) { walletDisconnected = true; emit(); } else { walletDisconnected = false; show("disconnected", "Choose a wallet to connect."); }
  }
  function dispose(): void {
    if (disposed) return; cancel(); disposed = true; retained = null; withdraw(); status?.abort.abort(); status = null;
    window.removeEventListener("storage", onStorage); owner.dispose(); coordinator.dispose(); listeners.clear();
  }
  return Object.freeze({ getView: view, connect, prepare, approve, cancel, disconnect, dispose, checkStatus, openDismissal, closeDismissal, confirmDismissal, retry,
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; } });
}
