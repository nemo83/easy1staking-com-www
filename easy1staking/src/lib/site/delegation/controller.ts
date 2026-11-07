import { createWalletSession } from "./wallet-session";
import { createDelegationCoordinator, CoordinationError, DELEGATION_POOL_ID } from "./coordination";
import type { DelegationLease, DelegationIntent, RecoveryState } from "./coordination";
import { assessChainContext } from "./chain-context";
import type { ChainAssessment } from "./chain-context";
import { MAINNET_SOURCE } from "./blockfrost-reader";
import { assembleSignedTransaction, validateBeforeSigning } from "./guard";
import { createRecoveryVerifier } from "./recovery-verifier";
import type { AccountState, StatusOutcome } from "./recovery-verifier";
import type { AcceptedTransaction, Review } from "./types";

const clock = Date.now, invoke = Reflect.apply;
type Ready = Extract<ChainAssessment, { status: "ready" }>;
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
export interface DelegationView {
  readonly phase: "disconnected" | "connecting" | "assessing" | "ready" | "building" | "review" | "signing" | "checking" | "submitting" | "submitted" | "unknown" | "already-EASY1" | "refused" |
    "confirmed" | "check-later" | "inconsistent" | "changed" | "other-pending";
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
}
class FlowFailure extends Error {}
interface Operation {
  readonly abort: AbortController;
  readonly revision: number;
  approval: { view: DelegationReview; decide: (approved: boolean) => void } | null;
  attempted: boolean;
  txId: string | null;
  dispatchedAt: number | null;
}
/** Status work has its own cancellation and generation authority, separate from cancel(). */
interface StatusWork {
  readonly abort: AbortController;
  readonly generation: number;
  readonly txId: string;
  readonly deadline: number | null;
  expired: boolean;
  resolved: Extract<StatusOutcome, { status: "confirmed" }> | null;
}
type StatusStep = { readonly kind: "confirmed"; readonly outcome: Extract<StatusOutcome, { status: "confirmed" }> } | { readonly kind: "continue" | "busy" | "inconsistent" | "changed" };
const OTHER_PENDING = "Another delegation from this browser is pending. Keep its transaction ID and check its status.";
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
  let txId: string | null = null;
  const fail = (): never => { throw new FlowFailure(); };
  function recovery(): RecoveryState { return coordinator.getState(); }
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
      canCheckStatus: !disposed && !status && !operation && prior.status === "pending" && prior.record !== null });
  }
  function emit(): void { if (!disposed) for (const listener of listeners) { try { listener(); } catch { /* Display only. */ } } }
  function show(next: DelegationView["phase"], text: string): void { phase = next; message = text; emit(); }
  function current(op: Operation): void {
    if (disposed || operation !== op || op.abort.signal.aborted || owner.getState().revision !== op.revision) fail();
  }
  function cancel(): void {
    serial++;
    const op = operation;
    if (op) { op.abort.abort(); op.approval?.decide(false); }
    review = null;
    if (op?.attempted) { txId = op.txId; show("unknown", "Submission outcome is unknown. Keep this transaction ID and check from this browser."); }
    else show(owner.getState().walletId ? "refused" : "disconnected", "Cancelled here. Any open wallet request may still finish; its late reply cannot submit.");
  }
  owner.subscribe(() => {
    const state = owner.getState();
    if (operation && state.revision !== operation.revision) cancel();
    else if (!operation && state.phase === "failed") show("refused", "The wallet changed or became unavailable. Reconnect to assess again.");
    else emit();
  });
  owner.attachBrowser(window, document);
  const onStorage = () => {
    // Another tab's pending record for a different ID supersedes this page's last ID, and any confirmation it holds.
    const prior = recovery();
    if (!disposed && !operation && txId !== null && phase !== "other-pending" && prior.status === "pending" && prior.txId !== txId) show("other-pending", OTHER_PENDING);
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
    throw new FlowFailure();
  }
  async function connect(id: string): Promise<void> {
    if (disposed || operation) return;
    const token = ++serial; review = null;
    show("connecting", "Confirm the connection in your chosen wallet.");
    try {
      await owner.connect(id); if (disposed || serial !== token) return;
      observed(); show("assessing", "Checking current account, inputs and EASY1 eligibility.");
      const result = await source(); if (disposed || serial !== token) return;
      if (result.status === "already-EASY1") show("already-EASY1", "This account already delegates to EASY1. No transaction is needed.");
      else if (result.status === "ready") show("ready", "Current account and EASY1 eligibility checked. Build a stake-only review when ready.");
      else show("refused", "Current chain information could not be verified. Use your wallet directly or reconnect later.");
    } catch { if (!disposed && serial === token) show("refused", "The wallet or current chain information could not be verified. Only mainnet key accounts are supported."); }
  }
  async function fresh(op: Operation, previous?: Ready): Promise<Ready> {
    await owner.recheck(); current(op);
    return ready(await source(op, previous));
  }
  function finalBarrier(op: Operation, lease: DelegationLease, intent: DelegationIntent, result: Ready, original: Ready,
    issued: Review, signed: AcceptedTransaction, bytes: Uint8Array, deadlineAt: number): number {
    coordinator.assertAttempt(lease, intent);
    current(op);
    const state = observed(op), c = result.context, time = clock();
    if (time >= deadlineAt || time < deadlineAt - 30000) fail(); // authentic-reply-deadline
    if (result.provenance.identity.source !== MAINNET_SOURCE || result.provenance.identity.networkId !== 1 ||
      result.provenance.identity.semantics !== original.provenance.identity.semantics ||
      result.provenance.identity.eligibility !== original.provenance.identity.eligibility || c.revision !== state.revision ||
      c.changeAddressHex !== state.observation!.binding.changeAddressHex) fail();
    for (const at of [result.provenance.observedAt, c.bindingObservedAt, c.registrationObservedAt, c.parameters.observedAt,
      c.wallet.observedAt, c.provider.observedAt, c.currentTip.observedAt, state.observation!.bindingObservedAt,
      state.observation!.rewardsObservedAt, state.observation!.inputsObservedAt, state.observation!.finalBindingObservedAt]) if (at > time || time - at > 30000) fail();
    const wallSlot = c.slotConfig.zeroSlot + BigInt(Math.floor((time - Number(c.slotConfig.zeroTime)) / c.slotConfig.slotLength));
    if (issued.invalidHereafter !== original.context.constructionTip.slot + BigInt(600) ||
      issued.invalidHereafter - c.currentTip.slot < BigInt(120) || issued.invalidHereafter - wallSlot < BigInt(120)) fail();
    if (signed.txId !== issued.txId || !signed.signedHex.startsWith("84" + issued.bodyHex) ||
      bytes.length * 2 !== signed.signedHex.length || signed.signedHex !== Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")) fail();
    current(op); // No display/provider callbacks or property lookup follows this barrier.
    return time;
  }
  async function submit(op: Operation, lease: DelegationLease, issued: Review, result: Ready, original: Ready,
    signed: AcceptedTransaction, deadlineAt: number): Promise<void> {
    const bytes = new Uint8Array(signed.signedHex.match(/../g)!.map(b => parseInt(b, 16)));
    const transport = new AbortController();
    const options: RequestInit = { method: "POST", headers: { project_id: projectId, "content-type": "application/cbor", accept: "application/json" },
      body: bytes, credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer", signal: transport.signal };
    const abort = () => transport.abort(); op.abort.signal.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined, attempted = false;
    const intent = coordinator.prepare(lease, { txId: issued.txId, invalidHereafterSlot: issued.invalidHereafter.toString(),
      inputRefs: issued.inputRefs, createdAt: clock() });
    try {
      show("submitting", "Sending the reviewed transaction once. Submission does not mean confirmation.");
      coordinator.beginAttempt(lease, intent);
      const expired = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { transport.abort(); reject(new FlowFailure()); }, 60000);
        transport.signal.addEventListener("abort", () => reject(new FlowFailure()), { once: true });
      });
      // A veto may precede the first race; cleanup can still abort this promise.
      void expired.catch(() => {});
      op.dispatchedAt = finalBarrier(op, lease, intent, result, original, issued, signed, bytes, deadlineAt);
      op.txId = issued.txId; op.attempted = true; attempted = true;
      const responsePromise = invoke(post, window, [MAINNET_SOURCE + "/tx/submit", options]) as Promise<Response>;
      const response = await Promise.race([responsePromise, expired]);
      current(op);
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
      if (!/^"[0-9a-f]{64}"$/.test(text) || text.slice(1, -1) !== issued.txId) fail();
      coordinator.markOutcome(lease, intent, "submitted");
      txId = issued.txId; show("submitted", "Submitted to Blockfrost. Chain confirmation is still pending. Keep the ID for independent checking.");
    } catch {
      if (attempted) {
        try { coordinator.markOutcome(lease, intent, "unknown"); } catch { /* The private ID survives lost storage or lease. */ }
        txId = issued.txId; show("unknown", "Submission outcome is unknown. Keep this transaction ID; do not build or send another delegation.");
      } else {
        // Only this process can prove that no outward call happened. Preserve any uncertain record.
        try { coordinator.cancelUnattempted(lease, intent); } catch { /* A conservative retained intent blocks another operation. */ }
        throw new FlowFailure();
      }
    } finally { if (timer !== undefined) clearTimeout(timer); op.abort.signal.removeEventListener("abort", abort); transport.abort(); }
  }
  async function prepare(): Promise<void> {
    if (disposed || operation || phase !== "ready") return;
    const op: Operation = { abort: new AbortController(), revision: owner.getState().revision, approval: null, attempted: false, txId: null, dispatchedAt: null };
    operation = op; review = null;
    try {
      await coordinator.withNewOperation(async lease => {
        try {
          current(op); show("building", "Checking fresh information and building the exact stake-only review.");
          const initial = await fresh(op);
          const builder = await import("./builder"); current(op); coordinator.assertActive(lease);
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
          const signature = await owner.requestSignature(issued, presign.context, { signal: op.abort.signal });
          current(op); const receipt = owner.signatureReceipt(signature);
          const postTimer = setTimeout(() => { if (!op.attempted) op.abort.abort(); }, Math.max(0, receipt.deadlineAt - clock()));
          try {
            show("checking", "Verifying signatures and fresh account, input and pool observations before sending.");
            const after = ready(await source(op, presign));
            const signed = await assembleSignedTransaction(signature.witnessHex, issued, { ...after.context, now: clock() });
            current(op);
            await submit(op, lease, issued, after, initial, signed, receipt.deadlineAt);
          } finally { clearTimeout(postTimer); }
        } catch {
          if (op.attempted) { txId = op.txId; show("unknown", "Submission outcome is unknown. Keep the transaction ID and check in this browser."); }
          else if (!["already-EASY1"].includes(phase)) show("refused", "Delegation stopped before sending. Information changed, approval was cancelled, or a safety check failed. Reconnect to assess again.");
        }
      }, { signal: op.abort.signal });
    } catch (error) {
      if (op.attempted) { txId = op.txId; show("unknown", "Submission outcome is unknown. Keep the transaction ID and check in this browser."); }
      else if (!["already-EASY1"].includes(phase)) show("refused", error instanceof CoordinationError && error.code === "BUSY" ? "Another delegation operation is active in this browser." :
        error instanceof CoordinationError && error.code === "CANCELLED" ? "Delegation stopped before sending. The operation was cancelled or the wallet changed. Reconnect to assess again." :
        "Browser coordination or the operation is unavailable. Check any prior operation from its originating browser.");
    } finally { if (operation === op) operation = null; review = null; emit(); }
    // The new-operation lock is released: poll for at most three minutes after dispatch.
    if (op.attempted && op.txId !== null && op.dispatchedAt !== null) startStatus(op.txId, op.dispatchedAt + 180000);
  }
  function live(work: StatusWork): boolean { return !disposed && status === work; }
  function startStatus(id: string, deadline: number | null): void {
    if (disposed || status || operation) return;
    const prior = recovery(); if (prior.status !== "pending" || prior.txId !== id) return;
    // The automatic budget already ended (for example a tab suspended past dispatch + 180 s): apologise now, without a check.
    if (deadline !== null && clock() >= deadline) { txId = id; show("check-later", APOLOGY); return; }
    let generation: number; try { generation = coordinator.beginStatus(); } catch { return; }
    const work: StatusWork = { abort: new AbortController(), generation, txId: id, deadline, expired: false, resolved: null };
    status = work; emit();
    void runStatus(work);
  }
  /** One bounded read session under the recovery lock; it never enables or calls the wallet, builds, signs or posts. */
  async function statusCheck(work: StatusWork): Promise<StatusStep> {
    let outcome: StatusOutcome;
    try {
      outcome = await coordinator.withRecoveryOperation(work.txId, async lease => {
        const result = await verifier.check(lease, { generation: work.generation, deadline: work.deadline, signal: work.abort.signal });
        if (live(work)) statusReason = result.status + ":" + result.reason;
        if (result.status === "confirmed" && live(work)) { coordinator.resolveConfirmed(lease, result.resolution); work.resolved = result; }
        return result;
      }, { signal: work.abort.signal });
    } catch (error) {
      if (work.resolved) return { kind: "confirmed", outcome: work.resolved };
      const code = error instanceof CoordinationError ? error.code : "OPERATION";
      return { kind: code === "BUSY" ? "busy" : code === "LOST" || code === "PENDING" || code === "RECORD" ? "changed" : "continue" };
    }
    if (work.resolved) return { kind: "confirmed", outcome: work.resolved };
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
    status = null; coordinator.endStatus(work.generation); txId = work.txId;
    if (step.kind === "confirmed") {
      const o = step.outcome, text = `Your delegation transaction was confirmed on chain in block ${o.blockHeight} (${o.confirmations} confirmation${o.confirmations === "1" ? "" : "s"}).`;
      resolved = Object.freeze({ txId: work.txId, message: text, blockHeight: o.blockHeight, confirmations: o.confirmations, credential: o.credential, account: o.account });
      show("confirmed", text);
    } else if (step.kind === "inconsistent") show("inconsistent", "We found this transaction but couldn't verify it consistently. Nothing was cleared. Check again later, or check it in your wallet or a chain explorer.");
    else if (step.kind === "changed") show("changed", "This operation's saved status changed in another tab of this browser. Keep the transaction ID and check it in your wallet or a chain explorer.");
    else show("check-later", APOLOGY);
  }
  /** One deliberate bounded check, also after a reload; there is no automatic poll on reload. */
  async function checkStatus(): Promise<void> {
    const prior = recovery();
    if (prior.status === "pending" && prior.txId) startStatus(prior.txId, null);
  }
  function approve(display: DelegationReview): void {
    const op = operation;
    if (!op || phase !== "review" || op.approval?.view !== display || review !== display || op.abort.signal.aborted) return;
    const decision = op.approval; op.approval = null; phase = "checking"; decision.decide(true);
  }
  function disconnect(): void { cancel(); owner.disconnect(); review = null; if (!txId) show("disconnected", "Choose a wallet to connect."); }
  function dispose(): void {
    if (disposed) return; cancel(); disposed = true; status?.abort.abort(); status = null;
    window.removeEventListener("storage", onStorage); owner.dispose(); coordinator.dispose(); listeners.clear();
  }
  return Object.freeze({ getView: view, connect, prepare, approve, cancel, disconnect, dispose, checkStatus,
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; } });
}
