import type { Input } from "./types";

export class WalletCodecError extends Error {
  constructor() { super("The complete wallet inputs or account addresses are unsupported or malformed."); this.name = "WalletCodecError"; }
}
function check(condition: unknown): asserts condition { if (!condition) throw new WalletCodecError(); }
export function normalizeWalletHex(value: unknown, maximumBytes: number, empty = false): string {
  check(typeof value === "string" && (empty || value.length > 0) && value.length <= maximumBytes * 2 && value.length % 2 === 0 && /^[0-9a-f]*$/i.test(value));
  return value.toLowerCase();
}
export function baseAddress(value: unknown): string {
  const address = normalizeWalletHex(value, 57);
  check(address.length === 114 && address.startsWith("01"));
  return address;
}
export interface WalletBinding {
  readonly networkId: 1;
  readonly changeAddressHex: string;
  readonly stakeKeyHash: string;
  readonly rewardAddresses: readonly string[];
  readonly matchingRewardAddress: string | null;
  readonly registration: "unresolved";
}
export function bindWallet(network: unknown, change: unknown, rewards: unknown): WalletBinding {
  check(network === 1);
  const changeAddressHex = baseAddress(change), stakeKeyHash = changeAddressHex.slice(58);
  check(Array.isArray(rewards) && rewards.length <= 2048);
  const rewardAddresses = [...new Set(Array.from(rewards, value => {
    const address = normalizeWalletHex(value, 29);
    check(address.length === 58 && address.startsWith("e1"));
    return address;
  }))].sort();
  const matchingRewardAddress = rewardAddresses.find(address => address.slice(2) === stakeKeyHash) ?? null;
  check(rewardAddresses.length === 0 || matchingRewardAddress !== null);
  return Object.freeze({ networkId: 1, changeAddressHex, stakeKeyHash, rewardAddresses: Object.freeze(rewardAddresses), matchingRewardAddress, registration: "unresolved" });
}

type Node = { kind: "int"; value: bigint } | { kind: "bytes"; value: string; largestChunk: number }
  | { kind: "array"; value: Node[] } | { kind: "map"; value: [Node, Node][] } | { kind: "tag"; tag: bigint; value: Node };
type Budget = { nodes: number };
/** Wallet CBOR permits bounded indefinite containers; the transaction guard remains stricter. */
function decode(hex: string, budget: Budget, depth = 0): Node {
  let offset = 0;
  const length = hex.length / 2;
  function byte(): number { check(offset < length); return parseInt(hex.slice(offset++ * 2, offset * 2), 16); }
  function read(level: number): Node {
    check(level <= 24 && ++budget.nodes <= 8192);
    const initial = byte(), major = initial >> 5, info = initial & 31, indefinite = info === 31;
    check(info < 28 || indefinite);
    let n = BigInt(info);
    if (info >= 24 && !indefinite) {
      n = BigInt(0);
      for (let i = 0; i < 2 ** (info - 24); i++) n = n * BigInt(256) + BigInt(byte());
    }
    if (major === 0 || major === 1) {
      check(!indefinite);
      return { kind: "int", value: major === 0 ? n : -BigInt(1) - n };
    }
    if (major === 2 && !indefinite) {
      check(n <= BigInt(length - offset));
      const size = Number(n), value = hex.slice(offset * 2, (offset + size) * 2); offset += size;
      return { kind: "bytes", value, largestChunk: size };
    }
    if (major === 6) { check(!indefinite); return { kind: "tag", tag: n, value: read(level + 1) }; }
    check((major === 2 && indefinite) || major === 4 || major === 5);
    check(indefinite || n <= BigInt(2048));
    const values: Node[] = [], entries: [Node, Node][] = [];
    let chunks = "", largestChunk = 0, count = 0;
    while (indefinite ? hex.slice(offset * 2, offset * 2 + 2) !== "ff" : count < Number(n)) {
      check(++count <= 2048);
      if (major === 2) {
        check((parseInt(hex.slice(offset * 2, offset * 2 + 2), 16) >> 5) === 2 && hex.slice(offset * 2, offset * 2 + 2) !== "5f");
        const part = read(level + 1); check(part.kind === "bytes"); chunks += part.value; largestChunk = Math.max(largestChunk, part.largestChunk);
      } else if (major === 4) values.push(read(level + 1));
      else entries.push([read(level + 1), read(level + 1)]);
    }
    if (indefinite) check(byte() === 255);
    return major === 2 ? { kind: "bytes", value: chunks, largestChunk } : major === 4 ? { kind: "array", value: values } : { kind: "map", value: entries };
  }
  const node = read(depth); check(offset === length); return node;
}
function array(node: Node, size?: number): Node[] { check(node.kind === "array" && (size === undefined || node.value.length === size)); return node.value; }
function integer(node: Node, min = BigInt(0), max = BigInt("18446744073709551615")): bigint { check(node.kind === "int" && node.value >= min && node.value <= max); return node.value; }
function bytes(node: Node, size?: number): string { check(node.kind === "bytes" && (size === undefined || node.value.length === size * 2)); return node.value; }
function entries(node: Node): [Node, Node][] {
  check(node.kind === "map"); const seen = new Set<string>();
  for (const [key] of node.value) {
    check(key.kind === "int" || key.kind === "bytes");
    const identity = key.kind + ":" + key.value;
    check(!seen.has(identity)); seen.add(identity);
  }
  return node.value;
}
function byteEnvelope(value: string): string {
  const size = value.length / 2;
  const header = size < 24 ? (64 + size).toString(16) : size < 256 ? "58" + size.toString(16).padStart(2, "0") : size < 65536 ? "59" + size.toString(16).padStart(4, "0") : "5a" + size.toString(16).padStart(8, "0");
  return header + value;
}
function enclosed(node: Node, budget: Budget): { content: string; node: Node } {
  check(node.kind === "tag" && node.tag === BigInt(24));
  const content = bytes(node.value); check(content.length > 0);
  return { content, node: decode(content, budget, 3) };
}
function plutus(node: Node): void {
  if (node.kind === "int") return;
  if (node.kind === "bytes") { check(node.largestChunk <= 64); return; }
  if (node.kind === "array") { node.value.forEach(plutus); return; }
  if (node.kind === "map") { node.value.forEach(([k, v]) => { plutus(k); plutus(v); }); return; }
  if (node.tag === BigInt(2) || node.tag === BigInt(3)) { check(node.value.kind === "bytes" && node.value.largestChunk <= 64); return; }
  if (node.tag === BigInt(102)) { const parts = array(node.value, 2); integer(parts[0]); array(parts[1]).forEach(plutus); return; }
  check((node.tag >= BigInt(121) && node.tag <= BigInt(127)) || (node.tag >= BigInt(1280) && node.tag <= BigInt(1400)));
  array(node.value).forEach(plutus);
}
function nativeScript(node: Node): void {
  const parts = array(node), tag = integer(parts[0], BigInt(0), BigInt(5));
  check(parts.length === (tag === BigInt(3) ? 3 : 2));
  if (tag === BigInt(0)) bytes(parts[1], 28);
  else if (tag === BigInt(1) || tag === BigInt(2)) array(parts[1]).forEach(nativeScript);
  else if (tag === BigInt(3)) { integer(parts[1], -BigInt("9223372036854775808"), BigInt("9223372036854775807")); array(parts[2]).forEach(nativeScript); }
  else integer(parts[1]);
}
function datum(node: Node, budget: Budget): string {
  const parts = array(node, 2), tag = integer(parts[0], BigInt(0), BigInt(1));
  if (tag === BigInt(0)) return "82005820" + bytes(parts[1], 32);
  const inner = enclosed(parts[1], budget); plutus(inner.node);
  return "8201d818" + byteEnvelope(inner.content);
}
function script(node: Node, budget: Budget): string {
  const inner = enclosed(node, budget), parts = array(inner.node, 2), tag = integer(parts[0], BigInt(0), BigInt(3));
  if (tag === BigInt(0)) nativeScript(parts[1]); else bytes(parts[1]);
  return "d818" + byteEnvelope(inner.content);
}
function input(raw: string): Input {
  const budget = { nodes: 0 }, pair = array(decode(raw, budget), 2), ref = array(pair[0], 2);
  const txId = bytes(ref[0], 32), index = integer(ref[1], BigInt(0), BigInt(65535));
  let address: Node, value: Node, datumHex: string | null = null, referenceScript: string | null = null;
  if (pair[1].kind === "array") {
    const output = array(pair[1]); check(output.length === 2 || output.length === 3);
    [address, value] = output;
    if (output.length === 3) datumHex = "82005820" + bytes(output[2], 32);
  } else {
    const output = new Map<number, Node>();
    for (const [key, v] of entries(pair[1])) output.set(Number(integer(key, BigInt(0), BigInt(3))), v);
    check(output.has(0) && output.has(1)); address = output.get(0)!; value = output.get(1)!;
    if (output.has(2)) datumHex = datum(output.get(2)!, budget);
    if (output.has(3)) referenceScript = script(output.get(3)!, budget);
  }
  const addressHex = baseAddress(bytes(address)), assets: Record<string, bigint> = {};
  let coin = value;
  if (value.kind === "array") {
    const parts = array(value, 2); coin = parts[0];
    for (const [policy, names] of entries(parts[1])) {
      const policyHex = bytes(policy, 28), tokens = entries(names); check(tokens.length > 0);
      for (const [name, amount] of tokens) {
        const nameHex = bytes(name); check(nameHex.length <= 64);
        assets[policyHex + nameHex] = integer(amount, BigInt(1), BigInt("9223372036854775807"));
      }
    }
  }
  const orderedAssets: Record<string, bigint> = {};
  for (const unit of Object.keys(assets).sort()) orderedAssets[unit] = assets[unit];
  return Object.freeze({ txId, index, addressHex, lovelace: integer(coin, BigInt(0), BigInt("45000000000000000")), assets: Object.freeze(orderedAssets), datum: datumHex, referenceScript });
}
export interface WalletInputSnapshot { readonly complete: true; readonly utxos: readonly Input[] }
export function decodeWalletInputs(raw: unknown): WalletInputSnapshot {
  try {
    check(Array.isArray(raw) && raw.length <= 2048);
    let total = 0;
    for (const encoded of raw) { check(typeof encoded === "string" && encoded.length <= 131072); total += encoded.length / 2; check(total <= 16 * 1024 * 1024); }
    const refs = new Set<string>(), utxos = raw.map(encoded => {
      const decoded = input(normalizeWalletHex(encoded, 65536)), ref = decoded.txId + "#" + decoded.index;
      check(!refs.has(ref)); refs.add(ref);
      return decoded;
    });
    utxos.sort((a, b) => a.txId.localeCompare(b.txId) || Number(a.index - b.index));
    return Object.freeze({ complete: true, utxos: Object.freeze(utxos) });
  } catch { throw new WalletCodecError(); }
}
