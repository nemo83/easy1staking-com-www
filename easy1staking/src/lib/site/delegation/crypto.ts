import { blake2b } from "@noble/hashes/blake2.js";
import { bytes, hex } from "./cbor";
import { GuardError } from "./types";

export function bodyId(bodyHex: string): string { return hex(blake2b(bytes(bodyHex), { dkLen: 32 })); }
export function keyHash(vkeyHex: string): string { return hex(blake2b(bytes(vkeyHex), { dkLen: 28 })); }
export async function verifyEd25519(vkeyHex: string, signatureHex: string, id: string): Promise<boolean> {
  try {
    const key = await globalThis.crypto.subtle.importKey("raw", new Uint8Array(bytes(vkeyHex)), "Ed25519", false, ["verify"]);
    return await globalThis.crypto.subtle.verify("Ed25519", key, new Uint8Array(bytes(signatureHex)), new Uint8Array(bytes(id)));
  } catch { throw new GuardError("CRYPTO"); }
}
