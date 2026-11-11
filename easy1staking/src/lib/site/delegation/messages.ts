import type { SessionError, SignatureCode } from "./wallet-session";
import type { SourceCode } from "./provider-json";
import type { GuardCode } from "./types";
import type { BuildCode } from "./builder";
import type { CoordinationCode } from "./coordination";

/** Plain W8 status text chosen only from owned error codes; no foreign message, header or payload is ever rendered. */
export type StopReason = "cancel-open" | "cancel-idle" | "changed" | "expired";
export type FailureKind = "wallet" | "source" | "source-stop" | "signature" | "guard" | "build" | "stop" | "coordination" | "recovery";
/** W7 manual-dismissal status texts, shown only by the deliberate check and the dismissal paths. */
export type RecoveryText = "expired-unseen" | "spent-by-id" | "seen-unverified" | "dismissed" | "dismiss-kept";
const CONNECT_FALLBACK = "The wallet or current chain information could not be verified. Only mainnet key accounts are supported.";
const SOURCE_FALLBACK = "Current chain information could not be verified. Use your wallet directly or reconnect later.";
const STOP_FALLBACK = "Delegation stopped before sending. Information changed or a safety check failed. Reconnect to build a new review.";
const PROVIDER_CONFIG = "This page's chain data service is not set up correctly, so delegation is unavailable here. Use your wallet directly.";
const PROVIDER_DOWN = "Chain data is unavailable right now. Try again in a few minutes, or use your wallet directly.";
const POOL = "EASY1 cannot accept new delegations right now: the pool is retiring, retired or not yet active. Nothing was built. Check back later.";
const NO_FUNDS = "This wallet has no ADA available for a delegation. Add ADA to this account, then connect again.";
const DECLINED = "Delegation stopped before sending. You declined the signature in your wallet. Reconnect to build a new review.";
const SIGN_FAILED = "Delegation stopped before sending. The wallet could not sign this transaction. Reconnect to build a new review, or use your wallet directly.";
const EXPIRED = "Delegation stopped before sending. The review expired before the transaction could be sent. Reconnect to build a new review.";
const CHANGED = "Delegation stopped before sending. Your wallet's account, network or funds changed. Reconnect to build a new review.";
const FUNDS = "Delegation stopped before sending. This wallet does not have enough ADA for the fee, any registration deposit and the minimum change. Add ADA, then reconnect.";
const FEE = "Delegation stopped before sending. The fee was higher than this page allows. Reconnect to build a new review.";
const BUILD = "Delegation stopped before sending. The transaction could not be built or checked safely. Reconnect to build a new review, or use your wallet directly.";
const WITNESS = "Delegation stopped before sending. The wallet's signature did not match the reviewed transaction. Reconnect to build a new review.";
const POOL_STOP = "Delegation stopped before sending. EASY1 cannot accept new delegations right now. Check back later.";
const PROVIDER_CONFIG_STOP = "Delegation stopped before sending. This page's chain data service is not set up correctly. Use your wallet directly.";
const PROVIDER_DOWN_STOP = "Delegation stopped before sending. Chain data became unavailable. Try again in a few minutes.";
const COORDINATION = "Browser coordination or the operation is unavailable. Check any prior operation from its originating browser.";
const DISMISS_KEPT = "The record was kept in this browser. To dismiss it, check status again, or check the ID in your wallet or a chain explorer.";
const wallet: Record<SessionError, string> = {
  UNAVAILABLE: "The selected wallet is not available in this browser. Open this page in your wallet's browser or enable its extension, then choose it again.",
  REFUSED: "The wallet did not allow the connection or refused a request. Approve the request in your wallet, then connect again.",
  TIMEOUT: "The wallet did not answer in time. Unlock it, then connect again.",
  UNSUPPORTED: "This wallet account cannot be used here. Switch the wallet to Cardano mainnet and choose an ordinary key-based account, then connect again.",
  CHANGED: "The wallet changed while connecting. Connect again.",
};
const source: Record<SourceCode, string> = {
  CONFIGURATION: PROVIDER_CONFIG, AUTHORIZATION: PROVIDER_CONFIG, TRANSPORT: PROVIDER_DOWN, QUOTA: PROVIDER_DOWN, TIMEOUT: PROVIDER_DOWN,
  INELIGIBLE: POOL, NO_FUNDS: NO_FUNDS, NOT_FOUND: SOURCE_FALLBACK, RESPONSE: SOURCE_FALLBACK, JSON: SOURCE_FALLBACK, LIMIT: SOURCE_FALLBACK,
  CANCELLED: SOURCE_FALLBACK, WALLET: SOURCE_FALLBACK, STALE: SOURCE_FALLBACK, COHERENCE: SOURCE_FALLBACK, PARAMETERS: SOURCE_FALLBACK, INPUT: SOURCE_FALLBACK,
};
const sourceStop: Record<SourceCode, string> = {
  CONFIGURATION: PROVIDER_CONFIG_STOP, AUTHORIZATION: PROVIDER_CONFIG_STOP, TRANSPORT: PROVIDER_DOWN_STOP, QUOTA: PROVIDER_DOWN_STOP, TIMEOUT: PROVIDER_DOWN_STOP,
  INELIGIBLE: POOL_STOP, NO_FUNDS: FUNDS, NOT_FOUND: STOP_FALLBACK, RESPONSE: STOP_FALLBACK, JSON: STOP_FALLBACK, LIMIT: STOP_FALLBACK,
  CANCELLED: STOP_FALLBACK, WALLET: STOP_FALLBACK, STALE: STOP_FALLBACK, COHERENCE: STOP_FALLBACK, PARAMETERS: STOP_FALLBACK, INPUT: STOP_FALLBACK,
};
const signature: Record<SignatureCode, string> = {
  DECLINED: DECLINED, REFUSED: SIGN_FAILED, UNSUPPORTED: SIGN_FAILED, BUSY: SIGN_FAILED, TIMEOUT: EXPIRED, CHANGED: CHANGED, WITNESS: WITNESS,
  REVIEW: STOP_FALLBACK, ABORTED: STOP_FALLBACK,
};
const guard: Record<GuardCode, string> = {
  VALIDITY: EXPIRED, REVISION: CHANGED, BINDING: CHANGED, NETWORK: CHANGED, FEE: FEE,
  CBOR: BUILD, BODY: BUILD, CERTIFICATE: BUILD, ADDRESS: BUILD, VALUE: BUILD, ASSETS: BUILD, ADA: BUILD, MIN_ADA: BUILD, SIZE: BUILD, SIGNER: BUILD,
  WITNESS: WITNESS, SIGNATURE: WITNESS, CRYPTO: WITNESS, CONTEXT: STOP_FALLBACK, STALE: STOP_FALLBACK, PARAMETERS: STOP_FALLBACK, INPUT: STOP_FALLBACK, REVIEW: STOP_FALLBACK,
};
const build: Record<BuildCode, string> = {
  ALREADY_DELEGATED: "This account already delegates to EASY1. No transaction is needed.", INSUFFICIENT_FUNDS: FUNDS,
  BUILD: BUILD, CORROBORATION: BUILD, SINGLE_CHANGE: BUILD,
};
const stop: Record<StopReason, string> = {
  "cancel-open": "Cancelled here. Any open wallet request may still finish; its late reply cannot submit.", "cancel-idle": "Cancelled here. Nothing was sent.",
  changed: CHANGED, expired: EXPIRED,
};
const coordination: Record<CoordinationCode, string> = {
  BUSY: "Another delegation operation is active in this browser.", CANCELLED: STOP_FALLBACK, UNAVAILABLE: COORDINATION, PENDING: COORDINATION, LOST: COORDINATION,
  RECORD: COORDINATION, LEASE: COORDINATION, INTENT: COORDINATION, RESOLUTION: COORDINATION, OPERATION: COORDINATION,
};
const recovery: Record<RecoveryText, string> = {
  "expired-unseen": "This transaction has expired and was not found on chain when checked. That does not prove it was never included. After you check its ID in your wallet or a chain explorer, you can dismiss this record.",
  "spent-by-id": "This transaction was not found, but one of its inputs is recorded as spent by this same transaction ID, so it may be on chain. Nothing was cleared. Check it in your wallet or a chain explorer.",
  "seen-unverified": "An earlier chain-data response reported this transaction, but verification is still unresolved. Nothing was cleared. Check again later, or check it in your wallet or a chain explorer.",
  dismissed: "You dismissed this record after checking the transaction ID yourself. This page did not confirm it. Keep the ID; a new delegation needs a new review and your approval.",
  "dismiss-kept": DISMISS_KEPT,
};
const tables: Readonly<Record<FailureKind, Readonly<Record<string, string>>>> = Object.freeze({ wallet: Object.freeze(wallet), source: Object.freeze(source),
  "source-stop": Object.freeze(sourceStop), signature: Object.freeze(signature), guard: Object.freeze(guard), build: Object.freeze(build), stop: Object.freeze(stop),
  coordination: Object.freeze(coordination), recovery: Object.freeze(recovery) });
const fallbacks: Readonly<Record<FailureKind, string>> = Object.freeze({ wallet: CONNECT_FALLBACK, source: SOURCE_FALLBACK, "source-stop": STOP_FALLBACK,
  signature: STOP_FALLBACK, guard: STOP_FALLBACK, build: STOP_FALLBACK, stop: STOP_FALLBACK, coordination: COORDINATION, recovery: DISMISS_KEPT });
/** W7 manual-dismissal copy for the panel: the offer, the disclosure and attestation dialog, the dismissed region and the prior-operation notice. */
export const DISMISSAL_COPY = Object.freeze({
  disclosure: "Dismiss clears the pending record in this browser. Save the transaction ID for later checks. The transaction may already have confirmed, or it may confirm later after a rollback. A new delegation requires your approval and may incur another fee and a registration deposit.",
  spentElsewhere: "One of its inputs was spent by a different transaction, so it can no longer be included on the chain as observed.",
  attestationLabel: 'Type "I checked this ID" to confirm that you checked this exact transaction ID in your wallet or a chain explorer.',
  attestationPhrase: "I checked this ID",
  offer: "Dismiss this record",
  confirm: "Confirm dismissal",
  keep: "Keep the record",
  region: "Dismiss pending record",
  dismissedRegion: "Dismissed record",
  dismissedCaption: "Transaction ID — dismissed by you",
  priorNotice: "A prior operation is unresolved in this browser. Keep its ID. This page can check its status and, after it expires, let you dismiss it once you have checked the ID yourself. It cannot retry it.",
});
/** The code itself when it is an own key of the kind's table; "__proto__", "constructor", "toString" and non-strings give null. */
export function failureCode(kind: FailureKind, code: unknown): string | null {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(tables[kind], code) ? code : null;
}
export function failureMessage(kind: FailureKind, code: unknown): string {
  const key = failureCode(kind, code);
  return key === null ? fallbacks[kind] : tables[kind][key];
}
export function failureCodes(kind: FailureKind): readonly string[] { return Object.freeze(Object.keys(tables[kind])); }
