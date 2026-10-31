/** Observations must be acquired and reconciled by the controller, never inferred from 404. */
export interface Value {
  readonly lovelace: bigint;
  /** policyId (28 bytes) followed by asset-name bytes (0..32). */
  readonly assets: Readonly<Record<string, bigint>>;
}
export interface Input extends Value {
  readonly txId: string;
  readonly index: bigint;
  readonly addressHex: string;
  readonly datum: null | string;
  readonly referenceScript: null | string;
}
export interface Tip {
  readonly slot: bigint;
  readonly hash: string;
  readonly epoch: bigint;
  readonly observedAt: number;
}
export interface GuardContext {
  readonly networkId: 1;
  readonly revision: number;
  readonly changeAddressHex: string;
  readonly stakeKeyHash: string;
  readonly bindingObservedAt: number;
  readonly registration: "registered" | "unregistered";
  readonly currentPoolHash: string | null;
  readonly registrationObservedAt: number;
  readonly constructionTip: Tip;
  readonly currentTip: Tip;
  readonly slotConfig: { readonly zeroTime: bigint; readonly zeroSlot: bigint; readonly slotLength: number };
  readonly parameters: {
    readonly identity: string;
    readonly epoch: bigint;
    readonly observedAt: number;
    readonly minFeeCoefficient: bigint;
    readonly minFeeConstant: bigint;
    readonly stakeDeposit: bigint;
    readonly coinsPerUTxOByte: bigint;
    readonly maxTxSize: bigint;
    readonly maxValueSize: bigint;
  };
  readonly wallet: { readonly complete: true; readonly observedAt: number; readonly utxos: readonly Input[] };
  readonly provider: { readonly observedAt: number; readonly utxos: readonly (Input & { readonly unspent: true })[] };
  readonly now: number;
}
export interface Review {
  readonly bodyHex: string;
  readonly txId: string;
  readonly targetPoolHash: string;
  readonly stakeKeyHash: string;
  readonly fee: bigint;
  readonly deposit: bigint;
  readonly invalidHereafter: bigint;
  readonly inputRefs: readonly string[];
  readonly expectedKeyHashes: readonly string[];
  readonly minimumFee: bigint;
}
export interface AcceptedTransaction {
  readonly signedHex: string;
  readonly txId: string;
  readonly fee: bigint;
  readonly minimumFee: bigint;
}
export type GuardCode = "CBOR" | "CONTEXT" | "STALE" | "NETWORK" | "REVISION" | "BINDING" | "PARAMETERS" | "INPUT" | "BODY" | "CERTIFICATE" | "ADDRESS" | "VALUE" | "ASSETS" | "ADA" | "MIN_ADA" | "SIZE" | "FEE" | "VALIDITY" | "SIGNER" | "WITNESS" | "SIGNATURE" | "CRYPTO" | "REVIEW";
const messages: Record<GuardCode, string> = {
  CBOR: "The transaction encoding is unsupported or malformed.", CONTEXT: "Fresh, complete account information is required.",
  STALE: "Account information expired. Refresh and review again.", NETWORK: "Only explicitly validated Cardano mainnet is supported.",
  REVISION: "The connected account changed. Review a new transaction.", BINDING: "The account or transaction context changed. Review again.",
  PARAMETERS: "Current protocol parameters could not be validated.", INPUT: "A selected input is unavailable or unsupported.",
  BODY: "The transaction contains an unsupported action.", CERTIFICATE: "The transaction is not an EASY1 stake-only delegation.",
  ADDRESS: "Every change output must return to the connected account.", VALUE: "A transaction value is invalid or unsupported.",
  ASSETS: "The transaction does not preserve every native asset.", ADA: "The transaction ADA balance is incorrect.",
  MIN_ADA: "A change output is below its required ADA minimum.", SIZE: "The transaction exceeds the supported size.",
  FEE: "The transaction fee is outside the permitted bounds.", VALIDITY: "The transaction validity window is unavailable or too short.",
  SIGNER: "The transaction requires an unexpected signer.", WITNESS: "The wallet returned incomplete or unexpected witnesses.",
  SIGNATURE: "A wallet signature does not match the reviewed transaction.", CRYPTO: "Ed25519 verification is unavailable in this browser.",
  REVIEW: "The transaction does not match an issued review.",
};
export class GuardError extends Error {
  constructor(readonly code: GuardCode) { super(messages[code]); this.name = "GuardError"; }
}
export function requireGuard(condition: unknown, code: GuardCode): asserts condition {
  if (!condition) throw new GuardError(code);
}
