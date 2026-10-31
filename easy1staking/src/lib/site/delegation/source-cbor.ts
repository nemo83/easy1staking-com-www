import * as Address from "@evolution-sdk/evolution/Address";
import * as RewardAccount from "@evolution-sdk/evolution/RewardAccount";
import * as PoolKeyHash from "@evolution-sdk/evolution/PoolKeyHash";
import * as ScriptRef from "@evolution-sdk/evolution/ScriptRef";
import * as CBOR from "@evolution-sdk/evolution/CBOR";
import { blake2b } from "@noble/hashes/blake2.js";
import { baseAddress, decodeWalletInputs, normalizeWalletHex } from "./wallet-codec";
import { bytes, hex } from "./cbor";
import { ensure, SourceError, canonical } from "./provider-json";
import type { Input } from "./types";
export function digest(value: string): string { return hex(blake2b(new TextEncoder().encode(value), { dkLen: 32 })); }
export function byteHash(value: string): string { return hex(blake2b(bytes(value), { dkLen: 32 })); }
export function addressBech32(value: string): string { return Address.toBech32(Address.fromHex(value)); }
export function addressHex(value: string): string {
  ensure(typeof value === "string" && value.startsWith("addr1") && value.length <= 200, "INPUT");
  const result = baseAddress(Address.toHex(Address.fromBech32(value))); ensure(addressBech32(result) === value, "INPUT"); return result;
}
export function stakeBech32(stake: string): string { return RewardAccount.toBech32(RewardAccount.fromHex("e1" + stake)); }
export function poolHash(value: string): string {
  ensure(typeof value === "string" && value.startsWith("pool1") && value.length <= 100, "COHERENCE");
  const decoded = PoolKeyHash.fromBech32(value); ensure(PoolKeyHash.toBech32(decoded) === value, "COHERENCE"); return PoolKeyHash.toHex(decoded);
}
export function poolBech32(value: string): string { return PoolKeyHash.toBech32(PoolKeyHash.fromHex(value)); }
function header(major: number, value: bigint): string {
  ensure(value >= BigInt(0) && value <= BigInt("18446744073709551615"), "WALLET");
  if (value < BigInt(24)) return (major * 32 + Number(value)).toString(16).padStart(2, "0");
  for (const [size, tag] of [[1, 24], [2, 25], [4, 26], [8, 27]]) if (value < BigInt(1) << BigInt(size * 8)) return (major * 32 + tag).toString(16) + value.toString(16).padStart(size * 2, "0");
  throw new SourceError("WALLET");
}
export function byteEnvelope(value: string): string { return header(2, BigInt(value.length / 2)) + value; }
/** Revalidate caller-owned typed observations through the accepted full wallet decoder. */
export function defensiveInputs(inputs: readonly Input[]): readonly Input[] {
  ensure(Array.isArray(inputs) && inputs.length <= 2048, "WALLET");
  const encoded = inputs.map(i => {
    ensure(i !== null && typeof i === "object" && Object.keys(i).sort().join(",") === "addressHex,assets,datum,index,lovelace,referenceScript,txId", "WALLET");
    const id = normalizeWalletHex(i.txId, 32); ensure(id.length === 64 && typeof i.index === "bigint" && typeof i.lovelace === "bigint", "WALLET");
    const address = baseAddress(i.addressHex); ensure(i.assets !== null && typeof i.assets === "object" && !Array.isArray(i.assets), "WALLET");
    const units = Object.keys(i.assets).sort(); ensure(units.length <= 2048, "WALLET"); const policies = new Map<string, string[]>();
    for (const unit of units) {
      ensure(/^[0-9a-f]{56}(?:[0-9a-f]{2}){0,32}$/.test(unit) && typeof i.assets[unit] === "bigint", "WALLET");
      const policy = unit.slice(0, 56); if (!policies.has(policy)) policies.set(policy, []); policies.get(policy)!.push(unit);
    }
    let value = header(0, i.lovelace);
    if (units.length) value = "82" + value + header(5, BigInt(policies.size)) + [...policies].map(([p, names]) => byteEnvelope(p) + header(5, BigInt(names.length)) + names.map(u => byteEnvelope(u.slice(56)) + header(0, i.assets[u])).join("")).join("");
    for (const option of [i.datum, i.referenceScript]) ensure(option === null || typeof option === "string" && option.length <= 131072 && /^[0-9a-f]+$/.test(option) && option.length % 2 === 0, "WALLET");
    const fields = ["00" + byteEnvelope(address), "01" + value, ...(i.datum === null ? [] : ["02" + i.datum]), ...(i.referenceScript === null ? [] : ["03" + i.referenceScript])];
    return "8282" + byteEnvelope(id) + header(0, i.index) + header(5, BigInt(fields.length)) + fields.join("");
  });
  const result = decodeWalletInputs(encoded).utxos;
  ensure(canonical([...inputs].sort((a, b) => a.txId.localeCompare(b.txId) || Number(a.index - b.index))) === canonical(result), "WALLET"); return result;
}
/** Bounded span walk checks truncation before public SDK decoding (which can over-report offsets). */
function span(data: Uint8Array, offset: number, depth: number, budget: { nodes: number }): number {
  ensure(depth <= 24 && ++budget.nodes <= 8192 && offset < data.length, "INPUT");
  const initial = data[offset++], major = initial >> 5, ai = initial & 31;
  ensure(major <= 6 && (ai < 28 || ai === 31 && (major === 2 || major === 4 || major === 5)), "INPUT");
  let n = BigInt(ai);
  if (ai >= 24 && ai !== 31) { const size = 2 ** (ai - 24); ensure(offset + size <= data.length, "INPUT"); n = BigInt(0); for (let j = 0; j < size; j++) n = n * BigInt(256) + BigInt(data[offset++]); }
  if (major <= 1) return offset;
  if (major === 2 && ai !== 31) { ensure(n <= BigInt(data.length - offset), "INPUT"); return offset + Number(n); }
  if (major === 6) return span(data, offset, depth + 1, budget);
  ensure(major === 2 || major === 4 || major === 5, "INPUT"); ensure(ai === 31 || n <= BigInt(2048), "INPUT");
  for (let j = 0; ai === 31 ? data[offset] !== 255 : j < Number(n); j++) {
    ensure(j < 2048, "INPUT"); if (major === 2) ensure(data[offset] >> 5 === 2 && data[offset] !== 95, "INPUT");
    offset = span(data, offset, depth + 1, budget); if (major === 5) offset = span(data, offset, depth + 1, budget);
  }
  if (ai === 31) { ensure(offset < data.length, "INPUT"); offset++; } return offset;
}
export function referenceHash(envelope: string): string {
  const outer = bytes(envelope); ensure(outer.length > 0 && outer.length <= 65536 && span(outer, 0, 0, { nodes: 0 }) === outer.length, "INPUT");
  const raw = ScriptRef.fromCBORHex(envelope).bytes;
  ensure(span(raw, 0, 0, { nodes: 0 }) === raw.length, "INPUT");
  const root = CBOR.decodeItemWithOffset(raw, 0); ensure(root.newOffset === raw.length && Array.isArray(root.item) && root.item.length === 2, "INPUT");
  // Locate children in the ORIGINAL array, including non-minimal and indefinite headers.
  const ai = raw[0] & 31, first = ai < 24 || ai === 31 ? 1 : 1 + 2 ** (ai - 24);
  const tag = CBOR.decodeItemWithOffset(raw, first), language = tag.item;
  ensure((typeof language === "bigint" || typeof language === "number") && BigInt(language) >= BigInt(0) && BigInt(language) <= BigInt(3), "INPUT");
  const lang = Number(language), body = CBOR.decodeItemWithOffset(raw, tag.newOffset);
  const payload = lang === 0 ? raw.subarray(tag.newOffset, body.newOffset) : body.item;
  ensure(payload instanceof Uint8Array && payload.length > 0, "INPUT");
  const original = new Uint8Array(payload.length + 1); original[0] = lang; original.set(payload, 1); return hex(blake2b(original, { dkLen: 28 }));
}
export function datumContent(envelope: string): { readonly hash: string | null; readonly inline: string | null } {
  if (envelope.startsWith("82005820") && envelope.length === 72) return { hash: envelope.slice(8), inline: null };
  ensure(envelope.startsWith("8201"), "INPUT"); const inner = ScriptRef.fromCBORHex(envelope.slice(4)).bytes;
  return { hash: byteHash(hex(inner)), inline: hex(inner) };
}
