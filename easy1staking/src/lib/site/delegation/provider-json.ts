/** Provider numbers retain their original JSON lexeme until a schema validates it. */
export class JsonNumber { constructor(readonly lexeme: string) { Object.freeze(this); } }
export type Json = null | boolean | string | JsonNumber | readonly Json[] | { readonly [key: string]: Json };
export type SourceCode = "CONFIGURATION" | "TRANSPORT" | "AUTHORIZATION" | "QUOTA" | "NOT_FOUND" | "RESPONSE" | "JSON" | "LIMIT" | "TIMEOUT" | "CANCELLED" | "WALLET" | "STALE" | "COHERENCE" | "PARAMETERS" | "INELIGIBLE" | "INPUT" | "NO_FUNDS";
const messages: Record<SourceCode, string> = {
  CONFIGURATION: "A browser-public mainnet provider identifier is required.", TRANSPORT: "Current provider information is unavailable.",
  AUTHORIZATION: "The provider identifier was refused.", QUOTA: "The provider quota is unavailable.", NOT_FOUND: "The provider has not established the required account information.",
  RESPONSE: "The provider response could not be validated.", JSON: "The provider data encoding is unsupported.", LIMIT: "The complete provider information exceeds supported limits.",
  TIMEOUT: "Current provider information did not arrive in time.", CANCELLED: "The provider assessment was cancelled.", WALLET: "A fresh complete mainnet wallet observation is required.",
  STALE: "Account or chain information expired. Refresh again.", COHERENCE: "Current indexed chain observations disagree. Refresh again.",
  PARAMETERS: "The current mainnet protocol profile is unsupported or unavailable.", INELIGIBLE: "EASY1 is unavailable for delegation at the observed chain point.",
  INPUT: "The complete wallet inputs could not be independently corroborated.", NO_FUNDS: "No supported funded wallet inputs are available.",
};
export class SourceError extends Error {
  constructor(readonly code: SourceCode) { super(messages[code]); this.name = "SourceError"; }
}
/** Rebuild callback failures from one primitive whitelisted code; never forward supplied objects. */
export function sourceFailure(error: unknown, fallback: SourceCode): SourceError {
  let code: unknown;
  try { code = error !== null && (typeof error === "object" || typeof error === "function") ? (error as { code?: unknown }).code : undefined; }
  catch { return new SourceError(fallback); }
  return new SourceError(typeof code === "string" && Object.prototype.hasOwnProperty.call(messages, code) ? code as SourceCode : fallback);
}
export function ensure(condition: unknown, code: SourceCode): asserts condition { if (!condition) throw new SourceError(code); }
export const JSON_LIMITS = Object.freeze({ bytes: 4194304, depth: 32, nodes: 131072, entries: 8192, string: 262144, number: 128 });
/** Bounded JSON, duplicate decoded keys refused; records have no prototype. */
export function parseProviderJson(text: string): Json {
  ensure(typeof text === "string" && new TextEncoder().encode(text).length <= JSON_LIMITS.bytes, "LIMIT");
  let at = 0, nodes = 0;
  function whitespace(): void { while (/[\x20\x09\x0a\x0d]/.test(text[at] ?? "x")) at++; }
  function string(): string {
    const start = at++; let units = 0;
    while (at < text.length) {
      const ch = text.charCodeAt(at++);
      if (ch === 34) {
        const value: unknown = JSON.parse(text.slice(start, at));
        ensure(typeof value === "string" && value.length <= JSON_LIMITS.string, "LIMIT"); return value;
      }
      ensure(ch >= 32, "JSON");
      if (ch === 92) {
        const escape = text[at++]; ensure(typeof escape === "string" && '"\\/bfnrtu'.includes(escape), "JSON");
        if (escape === "u") { ensure(/^[0-9a-f]{4}$/i.test(text.slice(at, at + 4)), "JSON"); at += 4; }
      }
      ensure(++units <= JSON_LIMITS.string, "LIMIT");
    }
    throw new SourceError("JSON");
  }
  function read(depth: number): Json {
    ensure(depth <= JSON_LIMITS.depth && ++nodes <= JSON_LIMITS.nodes, "LIMIT"); whitespace();
    const ch = text[at];
    if (ch === '"') return string();
    if (ch === "[" || ch === "{") {
      const array = ch === "[", end = array ? "]" : "}"; at++; whitespace();
      const list: Json[] = [], record: Record<string, Json> = Object.create(null); let entries = 0;
      if (text[at] === end) { at++; return Object.freeze(array ? list : record); }
      while (true) {
        ensure(++entries <= JSON_LIMITS.entries, "LIMIT"); whitespace();
        if (array) list.push(read(depth + 1));
        else {
          ensure(text[at] === '"', "JSON"); const key = string();
          ensure(!Object.prototype.hasOwnProperty.call(record, key), "JSON"); whitespace(); ensure(text[at++] === ":", "JSON");
          record[key] = read(depth + 1);
        }
        whitespace(); const separator = text[at++]; if (separator === end) break; ensure(separator === ",", "JSON");
      }
      return Object.freeze(array ? list : record);
    }
    for (const [word, value] of [["true", true], ["false", false], ["null", null]] as const) {
      if (text.slice(at, at + word.length) === word) { at += word.length; return value; }
    }
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(at, at + JSON_LIMITS.number + 1));
    ensure(match && match[0].length <= JSON_LIMITS.number, "JSON"); at += match[0].length;
    return new JsonNumber(match[0]);
  }
  try { const result = read(0); whitespace(); ensure(at === text.length, "JSON"); return result; }
  catch (error) { throw sourceFailure(error, "JSON"); }
}
export function object(value: Json): { readonly [key: string]: Json } {
  ensure(value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof JsonNumber), "RESPONSE");
  return value as { readonly [key: string]: Json };
}
export function list(value: Json): readonly Json[] { ensure(Array.isArray(value), "RESPONSE"); return value; }
export function field(value: Json, key: string): Json { const row = object(value); ensure(Object.prototype.hasOwnProperty.call(row, key), "RESPONSE"); return row[key]; }
export function text(value: Json): string { ensure(typeof value === "string", "RESPONSE"); return value; }
export function integer(value: Json, maximum = BigInt(Number.MAX_SAFE_INTEGER), minimum = BigInt(0)): bigint {
  ensure(value instanceof JsonNumber && /^(0|[1-9][0-9]*)$/.test(value.lexeme), "RESPONSE");
  const n = BigInt(value.lexeme); ensure(n >= minimum && n <= maximum, "RESPONSE"); return n;
}
export function decimal(value: Json, maximum = BigInt("45000000000000000"), minimum = BigInt(0)): bigint {
  ensure(typeof value === "string" && value.length <= 32 && /^(0|[1-9][0-9]*)$/.test(value), "RESPONSE");
  const n = BigInt(value); ensure(n >= minimum && n <= maximum, "RESPONSE"); return n;
}
export function hash(value: Json, size = 32): string { const v = text(value); ensure(v.length === size * 2 && /^[0-9a-f]+$/.test(v), "RESPONSE"); return v; }
export function canonical(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical((value as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(value);
}
