import { JsonNumber, parseProviderJson } from "./provider-json";

/** Bytes of a first-attempt 400 submit reply read for classification; a longer body is never classified. */
export const REPORT_BODY_LIMIT = 16384;
const CONTENT_TYPE = /^application\/json(?:\s*;\s*charset=utf-8)?$/i;
/** The whole message is one node ledger-rejection list: "ApplyTxError [" or "ConwayApplyTxError [" through its closing "]". */
const LEDGER_REJECTION = /^(?:Conway)?ApplyTxError \[[A-Z][A-Za-z]* \([\s\S]*\)\]$/;
/** Wording that can mean the transaction is already known, queued, duplicated or has spent its own inputs: never classified. */
const AMBIGUOUS = /already|duplicate|mempool|BadInputsUTxO/i;
/** W8: true only when Blockfrost reported a ledger validation error for the submitted bytes in this narrow local form (status 400, the
 * three required fields exactly, status_code the number 400, error "Bad Request", and a message that is one ledger-rejection list with no
 * ambiguous wording). It is a provider report, never proof that the transaction was not sent, relayed or included. Anything else,
 * including any thrown error, is false and the outcome stays unknown. Nothing here is logged, stored or rendered. */
export function reportedValidationError(status: number, redirected: boolean, contentType: string | null, body: Uint8Array): boolean {
  try {
    if (status !== 400 || redirected !== false) return false;
    if (!CONTENT_TYPE.test(contentType ?? "")) return false;
    if (!(body instanceof Uint8Array) || body.length > REPORT_BODY_LIMIT) return false;
    const value = parseProviderJson(new TextDecoder("utf-8", { fatal: true }).decode(body));
    if (value === null || typeof value !== "object" || Array.isArray(value) || value instanceof JsonNumber) return false;
    const reply = value as { readonly [key: string]: unknown };
    if (Object.keys(reply).sort().join(",") !== "error,message,status_code") return false;
    const code = reply.status_code, error = reply.error, message = reply.message;
    if (!(code instanceof JsonNumber) || code.lexeme !== "400") return false;
    if (error !== "Bad Request") return false;
    if (typeof message !== "string") return false;
    return LEDGER_REJECTION.test(message) && !AMBIGUOUS.test(message);
  } catch { return false; }
}
