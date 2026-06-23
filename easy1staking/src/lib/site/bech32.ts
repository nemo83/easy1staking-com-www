/**
 * Minimal BIP-173 bech32 encoder — just enough to turn a CIP-30 reward-address
 * hex (e.g. "e1<28-byte hash>") into a `stake1…` address for account queries.
 * Self-contained so the wallet assessment doesn't need to load the (heavy) SDK.
 * Validated round-trip against a known mainnet stake address.
 */
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const r: number[] = [];
  for (let i = 0; i < hrp.length; i++) r.push(hrp.charCodeAt(i) >> 5);
  r.push(0);
  for (let i = 0; i < hrp.length; i++) r.push(hrp.charCodeAt(i) & 31);
  return r;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const values = hrpExpand(hrp).concat(data, [0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const r: number[] = [];
  for (let i = 0; i < 6; i++) r.push((mod >> (5 * (5 - i))) & 31);
  return r;
}

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) ret.push((acc << (to - bits)) & maxv);
  return ret;
}

export function hexToBytes(hex: string): number[] {
  const a: number[] = [];
  for (let i = 0; i < hex.length; i += 2) a.push(parseInt(hex.substr(i, 2), 16));
  return a;
}

export function bech32Encode(hrp: string, dataBytes: number[]): string {
  const data = convertBits(dataBytes, 8, 5, true);
  const combined = data.concat(createChecksum(hrp, data));
  let ret = hrp + "1";
  for (const d of combined) ret += CHARSET[d];
  return ret;
}

/** CIP-30 reward-address hex -> bech32 `stake1…` (mainnet) / `stake_test1…`. */
export function rewardHexToStakeAddress(hex: string): string {
  const clean = hex.toLowerCase();
  // header high nibble: e=key reward, f=script reward; low nibble: 1=mainnet, 0=testnet
  const networkId = parseInt(clean[1], 16) & 1;
  const hrp = networkId === 1 ? "stake" : "stake_test";
  return bech32Encode(hrp, hexToBytes(clean));
}
