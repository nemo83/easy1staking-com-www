import { baseAddress, bindWallet, decodeWalletInputs, WalletCodecError } from "./wallet-codec";
import type { WalletBinding, WalletInputSnapshot } from "./wallet-codec";
import { validateBeforeSigning } from "./guard";
import type { GuardContext, Input, Review } from "./types";

const invoke = Reflect.apply, NativePromise = Promise, nativeThen = Promise.prototype.then;

export interface ReadOnlyWallet {
  getNetworkId(): Promise<unknown>;
  getChangeAddress(): Promise<unknown>;
  getRewardAddresses(): Promise<unknown>;
  getUtxos(): Promise<unknown>;
}
export interface WalletProvider { enable(): Promise<unknown> }
export interface WalletObservation {
  readonly binding: WalletBinding;
  readonly inputs: WalletInputSnapshot;
  /** Start times conservatively bound the age of every returned observation. */
  readonly bindingObservedAt: number;
  readonly rewardsObservedAt: number;
  readonly inputsObservedAt: number;
  readonly finalBindingObservedAt: number;
}
export type SessionError = "UNAVAILABLE" | "REFUSED" | "TIMEOUT" | "UNSUPPORTED" | "CHANGED";
export interface WalletSessionState {
  readonly phase: "disconnected" | "acquiring" | "observed" | "failed" | "disposed";
  readonly walletId: string | null;
  readonly revision: number;
  readonly acquisitionGeneration: number;
  readonly handleGeneration: number;
  readonly observation: WalletObservation | null;
  readonly error: SessionError | null;
}
export interface SessionRuntime {
  readonly now?: () => number;
  readonly stepTimeoutMs?: number;
  readonly signatureTimeoutMs?: number;
  readonly setTimeout?: typeof globalThis.setTimeout;
  readonly clearTimeout?: typeof globalThis.clearTimeout;
}
class SessionFailure extends Error { constructor(readonly code: SessionError) { super(code); } }
function semantic(observation: WalletObservation): string {
  return JSON.stringify(observation, (key, value) => key.endsWith("ObservedAt") ? undefined : typeof value === "bigint" ? value.toString() : value);
}
export type SignatureCode = "BUSY" | "CHANGED" | "UNSUPPORTED" | "REVIEW" | "REFUSED" | "DECLINED" | "TIMEOUT" | "ABORTED" | "WITNESS";
const signatureMessages: Record<SignatureCode, string> = {
  BUSY: "A wallet signature request is still in progress.", CHANGED: "The wallet context changed. Review again.",
  UNSUPPORTED: "This wallet cannot provide a guarded signature.", REVIEW: "A current issued transaction review is required.",
  REFUSED: "The wallet signature request failed.", DECLINED: "The wallet signature request was declined.",
  TIMEOUT: "The wallet signature window expired. Review again.", ABORTED: "The signature request was cancelled here.",
  WITNESS: "The wallet returned an unsupported witness response.",
};
export class WalletSignatureError extends Error {
  constructor(readonly code: SignatureCode) { super(signatureMessages[code]); this.name = "WalletSignatureError"; Object.freeze(this); }
}
export interface WalletSignature {
  /** Untrusted until the controller's fresh context and actual witness guard accept it. */
  readonly witnessHex: string;
  readonly revision: number;
  readonly handleGeneration: number;
}
interface SignatureJob {
  readonly revision: number;
  readonly fingerprint: string;
  failure: SignatureCode | null;
  started: boolean;
  rpcSettled: boolean;
  finished: boolean;
  stop: (code: SignatureCode) => void;
}
function inputIdentity(inputs: readonly Input[]): string {
  return JSON.stringify(inputs.slice().sort((a, b) => a.txId.localeCompare(b.txId) || (a.index < b.index ? -1 : a.index > b.index ? 1 : 0)).map(i => [i.txId, i.index, i.addressHex, i.lovelace,
    Object.keys(i.assets).sort().map(unit => [unit, i.assets[unit]]), i.datum, i.referenceScript]),
  (_key, value) => typeof value === "bigint" ? { integer: value.toString() } : value);
}
/** Dormant single wallet owner. Only explicit requestSignature can ask for approval. */
export function createWalletSession(resolveProvider: (walletId: string) => unknown, runtime: SessionRuntime = {}) {
  const now = runtime.now ?? Date.now, schedule = runtime.setTimeout ?? globalThis.setTimeout, cancel = runtime.clearTimeout ?? globalThis.clearTimeout;
  const timeout = runtime.stepTimeoutMs ?? 10000;
  const signatureTimeout = runtime.signatureTimeoutMs;
  if (signatureTimeout !== undefined && (!Number.isSafeInteger(signatureTimeout) || signatureTimeout < 1 || signatureTimeout > 600000)) throw new WalletSignatureError("UNSUPPORTED");
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 10000) throw new Error("Unsupported wallet read deadline.");
  let state: WalletSessionState = Object.freeze({ phase: "disconnected", walletId: null, revision: 0, acquisitionGeneration: 0, handleGeneration: 0, observation: null, error: null });
  let handle: ReadOnlyWallet | null = null, previousSemantic: string | null = null, generation = 0, running = false, pending = false;
  let completion: Promise<void> | null = null, complete: (() => void) | null = null, cancelStep: (() => void) | null = null;
  let detach: (() => void) | null = null;
  let signature: SignatureJob | null = null;
  const listeners = new Set<() => void>();
  const receipts = new WeakMap<WalletSignature, { receivedAt: number; deadlineAt: number; fingerprint: string }>();
  function update(patch: Partial<WalletSessionState>): void {
    state = Object.freeze({ ...state, ...patch });
    if (signature && signature.revision !== state.revision) signature.stop("CHANGED");
    for (const listener of listeners) { try { listener(); } catch { /* Observers grant no authority. */ } }
  }
  function invalidate(): void { generation++; handle = null; cancelStep?.(); }
  function timestamp(): number {
    const time = now(); if (!Number.isSafeInteger(time) || time < 0) throw new SessionFailure("UNSUPPORTED"); return time;
  }
  async function step<T>(action: () => Promise<T>, token: number): Promise<T> {
    if (token !== generation) throw new SessionFailure("CHANGED");
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = schedule(() => finish(undefined, new SessionFailure("TIMEOUT")), timeout);
      function finish(value?: T, error?: unknown): void {
        if (settled) return; settled = true; cancelStep = null;
        try { cancel(timer); } catch { error = new SessionFailure("UNSUPPORTED"); }
        if (error) reject(error); else resolve(value as T);
      }
      cancelStep = () => finish(undefined, new SessionFailure("CHANGED"));
      Promise.resolve().then(() => {
        if (token !== generation) throw new SessionFailure("CHANGED");
        return action();
      }).then(value => finish(value), () => finish(undefined, new SessionFailure("REFUSED")));
    });
  }
  async function acquire(walletId: string, token: number): Promise<void> {
    update({ phase: "acquiring", observation: null, error: null, acquisitionGeneration: token }); handle = null;
    try {
      const provider = resolveProvider(walletId) as WalletProvider | null;
      if (!provider || typeof provider.enable !== "function") throw new SessionFailure("UNAVAILABLE");
      const api = await step(() => provider.enable(), token) as ReadOnlyWallet;
      if (!api || !["getNetworkId", "getChangeAddress", "getRewardAddresses", "getUtxos"].every(method => typeof (api as unknown as Record<string, unknown>)[method] === "function")) throw new SessionFailure("UNSUPPORTED");
      const bindingObservedAt = timestamp();
      const network = await step(() => api.getNetworkId(), token), change = baseAddress(await step(() => api.getChangeAddress(), token));
      const rewardsObservedAt = timestamp(), rewards = await step(() => api.getRewardAddresses(), token);
      const binding = bindWallet(network, change, rewards);
      const inputsObservedAt = timestamp(), inputs = decodeWalletInputs(await step(() => api.getUtxos(), token));
      const finalBindingObservedAt = timestamp();
      const finalNetwork = await step(() => api.getNetworkId(), token), finalChange = baseAddress(await step(() => api.getChangeAddress(), token));
      if (finalNetwork !== network || finalChange !== change) throw new SessionFailure("CHANGED");
      const observation: WalletObservation = Object.freeze({ binding, inputs, bindingObservedAt, rewardsObservedAt, inputsObservedAt, finalBindingObservedAt });
      if (token !== generation) return;
      const fingerprint = semantic(observation);
      if (previousSemantic !== null && previousSemantic !== fingerprint) update({ revision: state.revision + 1 });
      previousSemantic = fingerprint; handle = api;
      update({ phase: "observed", observation, error: null, handleGeneration: state.handleGeneration + 1 });
    } catch (error) {
      if (token !== generation) return;
      handle = null; previousSemantic = null;
      update({ phase: "failed", observation: null, error: error instanceof SessionFailure ? error.code : error instanceof WalletCodecError ? "UNSUPPORTED" : "REFUSED", revision: state.revision + 1 });
    }
  }
  function request(): Promise<void> {
    if (state.phase === "disposed" || state.walletId === null) return Promise.resolve();
    if (!pending) { pending = true; invalidate(); update({ phase: "acquiring", observation: null, error: null }); }
    if (!completion) completion = new Promise(resolve => { complete = resolve; });
    if (!running) {
      running = true;
      void Promise.resolve().then(async () => {
        try {
          while (pending && state.phase !== "disposed" && state.walletId !== null) {
            pending = false;
            await acquire(state.walletId, generation);
          }
        } finally {
          running = false; const done = complete; complete = null; completion = null; done?.();
        }
      });
    }
    return completion;
  }
  function disconnect(): void {
    if (state.phase === "disposed") return;
    invalidate(); pending = false; previousSemantic = null;
    update({ phase: "disconnected", walletId: null, observation: null, error: null, revision: state.revision + 1, acquisitionGeneration: generation });
  }
  function connect(walletId: string): Promise<void> {
    if (state.phase === "disposed") return Promise.resolve();
    if (typeof walletId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(walletId)) throw new Error("Choose a supported wallet provider.");
    invalidate(); pending = false; previousSemantic = null;
    update({ walletId, observation: null, error: null, revision: state.revision + 1 });
    return request();
  }
  async function requestSignature(review: Review, context: GuardContext, options: { readonly signal?: AbortSignal } = {}): Promise<WalletSignature> {
    if (signature) throw new WalletSignatureError("BUSY");
    if (state.phase !== "observed" || !handle || !state.observation) throw new WalletSignatureError("CHANGED");
    let rejectStopped: (error: WalletSignatureError) => void = () => {};
    const stopped = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
    // Cancellation can precede the first raced operation; always observe this promise.
    void stopped.catch(() => {});
    const job: SignatureJob = { revision: state.revision, fingerprint: semantic(state.observation), failure: null,
      started: false, rpcSettled: false, finished: false, stop(code) {
        if (job.failure) return;
        job.failure = code; rejectStopped(new WalletSignatureError(code));
      } };
    signature = job;
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined, signal: AbortSignal | undefined;
    let listening = false, expiresAt = 0, responseDeadline = 0, receivedAt = 0;
    const abort = () => job.stop("ABORTED");
    function release(): void { if (job.finished && (!job.started || job.rpcSettled) && signature === job) signature = null; }
    function current(): void {
      if (job.failure) throw new WalletSignatureError(job.failure);
      if (state.phase !== "observed" || !handle || !state.observation || state.revision !== job.revision ||
        semantic(state.observation) !== job.fingerprint) throw new WalletSignatureError("CHANGED");
    }
    function binding(fresh = true): void {
      current();
      const observation = state.observation!;
      if (context.revision !== job.revision || context.networkId !== observation.binding.networkId ||
        context.changeAddressHex !== observation.binding.changeAddressHex || context.stakeKeyHash !== observation.binding.stakeKeyHash ||
        context.wallet.complete !== true || inputIdentity(context.wallet.utxos) !== inputIdentity(observation.inputs.utxos)) throw new WalletSignatureError("CHANGED");
      const time = timestamp();
      for (const observed of [observation.bindingObservedAt, observation.rewardsObservedAt, observation.inputsObservedAt, observation.finalBindingObservedAt]) {
        if (fresh && (observed > time || time - observed > 30000)) throw new WalletSignatureError("CHANGED");
      }
    }
    function clock(): number {
      const time = timestamp();
      if ((expiresAt && time >= expiresAt) || (responseDeadline && time >= responseDeadline)) throw new WalletSignatureError("TIMEOUT");
      return time;
    }
    function cleanup(): void {
      if (timer !== undefined) { const owned = timer; timer = undefined; cancel(owned); }
      if (listening) { listening = false; signal!.removeEventListener("abort", abort); }
    }
    try {
      signal = options.signal;
      if (signal) {
        if (signal.aborted) throw new WalletSignatureError("ABORTED");
        listening = true; signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) job.stop("ABORTED");
      }
      binding(false);
      await Promise.race([request(), stopped]);
      binding();
      const api = handle!;
      const sign = (api as ReadOnlyWallet & { signTx?: unknown }).signTx;
      if (typeof sign !== "function") throw new WalletSignatureError("UNSUPPORTED");
      // The real guard authenticates the opaque review and original body, including 180 remaining slots.
      try { validateBeforeSigning(review, { ...context, now: clock() }); }
      catch { throw new WalletSignatureError("REVIEW"); }
      const absoluteExpiry = context.slotConfig.zeroTime + (review.invalidHereafter - context.slotConfig.zeroSlot) * BigInt(context.slotConfig.slotLength);
      if (absoluteExpiry > BigInt(Number.MAX_SAFE_INTEGER)) throw new WalletSignatureError("REVIEW");
      expiresAt = Number(absoluteExpiry);
      const remaining = expiresAt - clock();
      const wait = Math.min(remaining, 600000, signatureTimeout ?? 600000);
      responseDeadline = expiresAt - remaining + wait;
      // The response timer also bounds the fresh post-approval observations.
      timer = schedule(() => job.stop("TIMEOUT"), wait);
      const unsignedHex = "84" + review.bodyHex + "a0f5f6";
      binding(); clock();
      try { validateBeforeSigning(review, { ...context, now: clock() }); }
      catch { throw new WalletSignatureError("REVIEW"); }
      current();
      if (handle !== api) throw new WalletSignatureError("CHANGED");
      // No await between the final checks and the current handle's receiver-bound call.
      const signingGeneration = state.handleGeneration;
      job.started = true;
      let reply: unknown;
      function rejected(error: unknown): WalletSignatureError {
        let code: unknown;
        try { code = error !== null && typeof error === "object" ? (error as { code?: unknown }).code : undefined; } catch { /* Untrusted accessor. */ }
        return new WalletSignatureError(code === 2 ? "DECLINED" : "REFUSED");
      }
      try { reply = invoke(sign, api, [unsignedHex, false]); }
      catch (error) { job.rpcSettled = true; throw rejected(error); }
      // Observe the original native promise; neither its own then nor the species result has authority.
      const settled = new NativePromise<unknown>((resolve, reject) => {
        function fulfilled(value: unknown): void {
          job.rpcSettled = true; release();
          // Timestamp the authentic original native fulfillment before reacquiring the wallet.
          try {
            receivedAt = timestamp();
            responseDeadline = Math.min(responseDeadline, receivedAt + 30000);
            if (!job.finished && !job.failure) {
              if (timer !== undefined) cancel(timer);
              timer = schedule(() => job.stop("TIMEOUT"), Math.max(0, responseDeadline - receivedAt));
            }
          } catch { reject(new WalletSignatureError("UNSUPPORTED")); return; }
          // Never assimilate a wallet-controlled object into the application-owned bridge.
          if (typeof value === "string") resolve(value);
          else reject(new WalletSignatureError("WITNESS"));
        }
        function failed(error: unknown): void { job.rpcSettled = true; release(); reject(rejected(error)); }
        if (reply !== null && (typeof reply === "object" || typeof reply === "function")) {
          try { invoke(nativeThen, reply, [fulfilled, failed]); }
          // Attachment failure cannot prove that an extension RPC has settled. Keep its reservation.
          catch { reject(new WalletSignatureError("UNSUPPORTED")); }
        } else fulfilled(reply);
      });
      const witnesses = await Promise.race([settled, stopped]);
      if (job.failure) throw new WalletSignatureError(job.failure);
      clock();
      if (typeof witnesses !== "string" || witnesses.length > 131072 || witnesses.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(witnesses)) throw new WalletSignatureError("WITNESS");
      await Promise.race([request(), stopped]);
      binding(); clock();
      // Only now may untrusted witnesses leave the owner. Provider and final guard checks are still owed.
      cleanup(); current(); clock();
      const result = Object.freeze({ witnessHex: witnesses.toLowerCase(), revision: job.revision, handleGeneration: signingGeneration });
      receipts.set(result, { receivedAt, deadlineAt: responseDeadline, fingerprint: job.fingerprint });
      return result;
    } catch (error) {
      let code: SignatureCode = "REFUSED";
      // New errors are immutable, but never trust a foreign same-class message or payload.
      if (job.failure) code = job.failure;
      else {
        try {
          if (error instanceof WalletSignatureError) {
            const candidate: unknown = error.code;
            if (typeof candidate === "string" && Object.prototype.hasOwnProperty.call(signatureMessages, candidate)) code = candidate as SignatureCode;
          }
        } catch { /* Untrusted accessors and prototype traps. */ }
      }
      try { cleanup(); } catch { code = "UNSUPPORTED"; }
      throw new WalletSignatureError(code);
    } finally { job.finished = true; release(); }
  }
  function attachBrowser(windowObject: Window, documentObject: Document): () => void {
    detach?.();
    if (state.phase === "disposed") return () => {};
    const refresh = () => { if (documentObject.visibilityState === "visible") void request(); };
    windowObject.addEventListener("focus", refresh);
    documentObject.addEventListener("visibilitychange", refresh);
    const timer = windowObject.setInterval(refresh, 30000);
    let attached = true;
    const cleanup = () => {
      if (!attached) return; attached = false;
      windowObject.removeEventListener("focus", refresh); documentObject.removeEventListener("visibilitychange", refresh); windowObject.clearInterval(timer);
      if (detach === cleanup) detach = null;
    };
    detach = cleanup; return cleanup;
  }
  function dispose(): void {
    if (state.phase === "disposed") return;
    detach?.(); disconnect(); update({ phase: "disposed" }); listeners.clear();
  }
  return Object.freeze({ connect, disconnect, recheck: request, requestSignature, attachBrowser, dispose, getState: () => state,
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; },
    signatureReceipt(result: WalletSignature): Readonly<{ receivedAt: number; deadlineAt: number }> {
      const receipt = receipts.get(result);
      if (!receipt || state.phase !== "observed" || state.revision !== result.revision || !state.observation ||
        semantic(state.observation) !== receipt.fingerprint || timestamp() >= receipt.deadlineAt) throw new WalletSignatureError("CHANGED");
      return Object.freeze({ receivedAt: receipt.receivedAt, deadlineAt: receipt.deadlineAt });
    },
    hasCurrentHandle: () => handle !== null && state.phase === "observed" });
}
