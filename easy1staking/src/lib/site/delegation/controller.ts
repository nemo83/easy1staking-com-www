import { createWalletSession } from "./wallet-session";
import { createDelegationCoordinator, CoordinationError, DELEGATION_POOL_ID } from "./coordination";
import type { DelegationLease, DelegationIntent, RecoveryState } from "./coordination";
import { assessChainContext } from "./chain-context";
import type { ChainAssessment } from "./chain-context";
import { MAINNET_SOURCE } from "./blockfrost-reader";
import { assembleSignedTransaction, validateBeforeSigning } from "./guard";
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
export interface DelegationView {
  readonly phase: "disconnected" | "connecting" | "assessing" | "ready" | "building" | "review" | "signing" | "checking" | "submitting" | "submitted" | "unknown" | "already-EASY1" | "refused";
  readonly message: string;
  readonly walletId: string | null;
  readonly account: string | null;
  readonly review: DelegationReview | null;
  readonly txId: string | null;
  readonly recovery: RecoveryState;
  readonly walletBrowseHref: string | null;
}
class FlowFailure extends Error {}
interface Operation {
  readonly abort: AbortController;
  readonly revision: number;
  approval: { view: DelegationReview; decide: (approved: boolean) => void } | null;
  attempted: boolean;
  txId: string | null;
}
/** The page receives display data and deliberate actions; handles, reviews and bytes stay private. */
export function createDelegationController(projectId: string) {
  const post = window.fetch, owner = createWalletSession(id => {
    try { return (window as unknown as { cardano?: Record<string, unknown> }).cardano?.[id]; } catch { return null; }
  }), coordinator = createDelegationCoordinator();
  const listeners = new Set<() => void>();
  let disposed = false, serial = 0, operation: Operation | null = null, coordinationReady = false;
  let phase: DelegationView["phase"] = "disconnected", message = "Choose a wallet to connect.", review: DelegationReview | null = null;
  let txId: string | null = null;
  const fail = (): never => { throw new FlowFailure(); };
  function recovery(): RecoveryState { return coordinator.getState(); }
  function view(): DelegationView {
    const state = owner.getState(), prior = recovery();
    const origin = window.location.origin;
    const browse = coordinationReady && !disposed && phase === "disconnected" && !operation && state.walletId === null && prior.status === "absent" &&
      (origin === "https://easy1staking.com" || origin === "https://preview.easy1staking.com");
    return Object.freeze({ phase, message, walletId: state.walletId, account: state.observation?.binding.stakeKeyHash ?? null,
      review, txId: txId ?? prior.txId, recovery: prior,
      walletBrowseHref: browse ? "web+cardano://browse/v1?uri=" + encodeURIComponent(origin + "/pool") : null });
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
  const onStorage = () => emit();
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
    issued: Review, signed: AcceptedTransaction, bytes: Uint8Array, deadlineAt: number): void {
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
      finalBarrier(op, lease, intent, result, original, issued, signed, bytes, deadlineAt);
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
    const op: Operation = { abort: new AbortController(), revision: owner.getState().revision, approval: null, attempted: false, txId: null };
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
  }
  function approve(display: DelegationReview): void {
    const op = operation;
    if (!op || phase !== "review" || op.approval?.view !== display || review !== display || op.abort.signal.aborted) return;
    const decision = op.approval; op.approval = null; phase = "checking"; decision.decide(true);
  }
  function disconnect(): void { cancel(); owner.disconnect(); review = null; if (!txId) show("disconnected", "Choose a wallet to connect."); }
  function dispose(): void { if (disposed) return; cancel(); disposed = true; window.removeEventListener("storage", onStorage); owner.dispose(); coordinator.dispose(); listeners.clear(); }
  return Object.freeze({ getView: view, connect, prepare, approve, cancel, disconnect, dispose,
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; } });
}
