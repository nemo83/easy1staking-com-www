import { requireGuard } from "./types";

export type Cbor = { readonly start: number; readonly end: number } & (
  | { readonly kind: "int"; readonly value: bigint }
  | { readonly kind: "bytes"; readonly value: string }
  | { readonly kind: "array"; readonly value: readonly Cbor[] }
  | { readonly kind: "map"; readonly value: readonly (readonly [Cbor, Cbor])[] }
  | { readonly kind: "tag"; readonly value: Cbor; readonly tag: bigint }
  | { readonly kind: "simple"; readonly value: boolean | null }
);
export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export function bytes(value: string): Uint8Array {
  requireGuard(typeof value === "string" && value.length % 2 === 0 && /^[0-9a-f]*$/.test(value), "CBOR");
  return Uint8Array.from(value.match(/../g) ?? [], (b) => parseInt(b, 16));
}
/** Definite, minimally encoded, bounded CBOR. Spans refer to the original bytes. */
export function decode(value: string): Cbor {
  requireGuard(typeof value === "string" && value.length > 0 && value.length <= 131072, "CBOR");
  const data = bytes(value);
  let offset = 0, nodes = 0;
  function read(depth: number): Cbor {
    requireGuard(depth <= 24 && ++nodes <= 8192 && offset < data.length, "CBOR");
    const start = offset, initial = data[offset++], major = initial >> 5, info = initial & 31;
    if (major === 7) {
      requireGuard(info === 20 || info === 21 || info === 22, "CBOR");
      return { kind: "simple", value: info === 22 ? null : info === 21, start, end: offset };
    }
    requireGuard(info < 28, "CBOR");
    let n = BigInt(info);
    if (info >= 24) {
      const length = 2 ** (info - 24);
      requireGuard(offset + length <= data.length, "CBOR");
      n = BigInt(0);
      for (let i = 0; i < length; i++) n = (n << BigInt(8)) | BigInt(data[offset++]);
      requireGuard(n >= [BigInt(24), BigInt(256), BigInt(65536), BigInt("4294967296")][info - 24], "CBOR");
    }
    if (major === 0 || major === 1) return { kind: "int", value: major === 0 ? n : -BigInt(1) - n, start, end: offset };
    if (major === 2) {
      requireGuard(n <= BigInt(data.length - offset), "CBOR");
      const b = hex(data.subarray(offset, offset + Number(n))); offset += Number(n);
      return { kind: "bytes", value: b, start, end: offset };
    }
    if (major === 6) {
      requireGuard(n === BigInt(258), "CBOR");
      return { kind: "tag", tag: n, value: read(depth + 1), start, end: offset };
    }
    requireGuard((major === 4 || major === 5) && n <= BigInt(2048), "CBOR");
    if (major === 4) {
      const children: Cbor[] = [];
      for (let i = 0; i < Number(n); i++) children.push(read(depth + 1));
      return { kind: "array", value: children, start, end: offset };
    }
    const entries: [Cbor, Cbor][] = [], keys = new Set<string>();
    for (let i = 0; i < Number(n); i++) {
      const key = read(depth + 1);
      requireGuard(key.kind === "int" || key.kind === "bytes", "CBOR");
      const identity = `${key.kind}:${key.value}`;
      requireGuard(!keys.has(identity), "CBOR"); keys.add(identity);
      entries.push([key, read(depth + 1)]);
    }
    return { kind: "map", value: entries, start, end: offset };
  }
  const result = read(0);
  requireGuard(offset === data.length, "CBOR");
  return result;
}
export function array(node: Cbor, set = false): readonly Cbor[] {
  if (set && node.kind === "tag" && node.tag === BigInt(258)) node = node.value;
  requireGuard(node.kind === "array", "CBOR");
  return node.value;
}
export function integer(node: Cbor): bigint { requireGuard(node.kind === "int", "CBOR"); return node.value; }
export function byteString(node: Cbor, length?: number): string {
  requireGuard(node.kind === "bytes" && (length === undefined || node.value.length === length * 2), "CBOR");
  return node.value;
}
export function fields(node: Cbor, allowed: readonly number[], code: "BODY" | "WITNESS" = "BODY"): Map<number, Cbor> {
  requireGuard(node.kind === "map", code);
  const result = new Map<number, Cbor>();
  for (const [key, value] of node.value) {
    const n = integer(key);
    requireGuard(allowed.some((k) => BigInt(k) === n), code);
    result.set(Number(n), value);
  }
  return result;
}
/** Only canonical witness containers are assembled; body spans are never encoded. */
export function arrayHeader(count: number): string {
  requireGuard(Number.isSafeInteger(count) && count >= 0 && count <= 2048, "WITNESS");
  return count < 24 ? (128 + count).toString(16) : count < 256 ? "98" + count.toString(16).padStart(2, "0") : "99" + count.toString(16).padStart(4, "0");
}
