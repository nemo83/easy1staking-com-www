#!/usr/bin/env node
"use strict";
// Executes production TypeScript; fixture mutation encoding has no policy logic.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { createHash, createPrivateKey, createPublicKey, sign, verify } = require("node:crypto");
const { test } = require("node:test");
const ts = require("typescript");
assert.match(process.version, /^v24\./, "Use the pinned Node 24 runtime");
const root = path.resolve(__dirname, "..");
const loaded = new Map();
function load(file) {
  if (loaded.has(file)) return loaded.get(file).exports;
  const module = { exports: {} }; loaded.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const localRequire = id => id.startsWith(".") ? load(path.resolve(path.dirname(file), id + ".ts")) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const guard = load(path.join(root, "src/lib/site/delegation/guard.ts"));
const crypto = load(path.join(root, "src/lib/site/delegation/crypto.ts"));
const cbor = load(path.join(root, "src/lib/site/delegation/cbor.ts"));
const { GuardError } = load(path.join(root, "src/lib/site/delegation/types.ts"));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/stake-guard.json"))).fixtures;
const get = name => fixtures.find(f => f.name === name);
const original = get("registered");
const b = hex => Buffer.from(hex, "hex");
const clone = value => structuredClone(value);

// A small independent fixture codec. It only decodes trusted fixture bytes and
// encodes raw mutations; malformed/resource probes below are literal byte strings.
function readFixture(hex) {
  const data = b(hex); let at = 0;
  function read() {
    const first = data[at++], major = first >> 5, ai = first & 31;
    if (major === 7) return ai === 22 ? null : ai === 21;
    let n = BigInt(ai);
    if (ai >= 24) { const width = 2 ** (ai - 24); n = 0n; for (let i = 0; i < width; i++) n = n * 256n + BigInt(data[at++]); }
    if (major === 0) return n;
    if (major === 1) return -n - 1n;
    if (major === 2) { const v = Buffer.from(data.subarray(at, at + Number(n))); at += Number(n); return v; }
    if (major === 6) return { tag: n, value: read() };
    if (major === 4) return Array.from({ length: Number(n) }, read);
    if (major === 5) return new Map(Array.from({ length: Number(n) }, () => [read(), read()]));
    throw Error("unsupported trusted fixture encoding");
  }
  const value = read(); assert.equal(at, data.length); return value;
}
function head(major, n) {
  n = BigInt(n);
  if (n < 24n) return Buffer.from([major * 32 + Number(n)]);
  for (const width of [1, 2, 4, 8]) if (n < (1n << BigInt(width * 8))) {
    const out = Buffer.alloc(width + 1); out[0] = major * 32 + 24 + Math.log2(width);
    for (let i = width; i > 0; i--) { out[i] = Number(n & 255n); n >>= 8n; } return out;
  }
  throw Error("fixture integer overflow");
}
function encode(value) {
  if (typeof value === "bigint") return head(value < 0n ? 1 : 0, value < 0n ? -value - 1n : value);
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.concat([head(2, value.length), value]);
  if (Array.isArray(value)) return Buffer.concat([head(4, value.length), ...value.map(encode)]);
  if (value instanceof Map) return Buffer.concat([head(5, value.size), ...[...value].flatMap(([k, v]) => [encode(k), encode(v)])]);
  if (value && typeof value === "object" && "tag" in value) return Buffer.concat([head(6, value.tag), encode(value.value)]);
  if (value === null || typeof value === "boolean") return Buffer.from([value === null ? 246 : value ? 245 : 244]);
  throw Error("unsupported mutation shape");
}
const untag = value => value && "tag" in value ? value.value : value;
const body = f => readFixture(f.bodyHex);
const raw = value => encode(value).toString("hex");
function context(f = original) {
  const slot = BigInt(f.constructionSlot), now = 1596059091000 + Number(slot - 4492800n) * 1000;
  const tip = { slot, hash: "aa".repeat(32), epoch: 664n, observedAt: now };
  const input = { txId: f.inputId, index: BigInt(f.inputIndex), addressHex: f.addressHex, lovelace: BigInt(f.funding), assets: Object.fromEntries(Object.entries(f.inputAssets).map(([u, q]) => [u, BigInt(q)])), datum: null, referenceScript: null };
  const inputs = f.selectedInputs ? f.selectedInputs.map(i => ({ ...i, index: BigInt(i.index), lovelace: BigInt(i.lovelace), assets: Object.fromEntries(Object.entries(i.assets).map(([u, q]) => [u, BigInt(q)])) })) : [input];
  return { networkId: 1, revision: 1, changeAddressHex: f.addressHex, stakeKeyHash: f.stakeKeyHash, bindingObservedAt: now,
    registration: f.registered ? "registered" : "unregistered", currentPoolHash: null, registrationObservedAt: now,
    constructionTip: { ...tip }, currentTip: { ...tip }, slotConfig: { zeroTime: 1596059091000n, zeroSlot: 4492800n, slotLength: 1000 },
    parameters: { identity: "b1848e36b120c1f2276f0435482d2dfa6e6ac15445faef6612012a054641d57a", epoch: 664n, observedAt: now, minFeeCoefficient: 44n, minFeeConstant: 155381n, stakeDeposit: 2000000n, coinsPerUTxOByte: 4310n, maxTxSize: 16384n, maxValueSize: 5000n },
    wallet: { complete: true, observedAt: now, utxos: inputs }, provider: { observedAt: now, utxos: inputs.map(i => ({ ...clone(i), unspent: true })) }, now };
}
function advance(c, slots) {
  const next = clone(c); next.now += slots * 1000; next.currentTip.slot += BigInt(slots); next.currentTip.hash = "ab".repeat(32);
  for (const target of [next.currentTip, next.parameters, next.wallet, next.provider]) target.observedAt = next.now;
  next.bindingObservedAt = next.registrationObservedAt = next.now; return next;
}
function rejection(name, codes, fn) {
  try { fn(); } catch (error) { assert(error instanceof GuardError && codes.includes(error.code), `${name}: expected ${codes}, got ${error.code || error.name}`); return; }
  assert.fail(`FORBIDDEN_ACCEPTANCE: ${name}`);
}
async function rejects(name, codes, fn) {
  try { await fn(); } catch (error) { assert(error instanceof GuardError && codes.includes(error.code), `${name}: expected ${codes}, got ${error.code || error.name}`); return; }
  assert.fail(`FORBIDDEN_ACCEPTANCE: ${name}`);
}
function mutate(name, codes, change, fixture = original, alterContext = () => {}) {
  test(name, () => { const map = body(fixture), c = context(fixture); change(map, c); alterContext(c); rejection(name, codes, () => guard.reviewBody(raw(map), c)); });
}
function contextMutant(name, codes, change) { mutate(name, codes, () => {}, original, change); }

for (const f of fixtures.filter(f => f.name !== "registered-wrongpool")) test(`original SDK positive: ${f.name}`, async () => {
  const c = context(f), review = guard.reviewBody(f.bodyHex, c);
  assert.equal(review.txId, f.txId); assert.equal(review.bodyHex, f.bodyHex);
  assert.equal(createHash("sha256").update(b(f.bodyHex)).digest("hex"), f.bodySha256);
  assert.equal(createHash("sha256").update(b(f.signedHex)).digest("hex"), f.signedSha256);
  assert.equal(review.fee.toString(), f.fee); assert.equal(review.deposit.toString(), f.deposit);
  assert.equal(review.expectedKeyHashes.length, f.witnessCount ?? (f.name === "dedup" ? 1 : 2));
  const accepted = await guard.verifySignedTransaction(f.signedHex, review, c);
  assert.equal(accepted.signedHex, f.signedHex); assert.equal(accepted.txId, f.txId);
  assert.equal(accepted.minimumFee.toString(), f.expectedOfficialMinimum);
  assert.equal(accepted.minimumFee, 155381n + 44n * BigInt(f.signedSize - 1));
  const tx = readFixture(f.signedHex), assembled = await guard.assembleSignedTransaction(raw(tx[1]), review, c);
  assert(assembled.signedHex.startsWith("84" + f.bodyHex));
  assert.equal(assembled.minimumFee, accepted.minimumFee - 132n); // tag258 normalization only
  assert.equal(assembled.txId, f.txId);
});
test("ledger accepts wrong pool control; site must reject it", () => rejection("wrong pool", ["CERTIFICATE"], () => guard.reviewBody(get("registered-wrongpool").bodyHex, context())));
test("WebCrypto RFC8032 vector and actual negative execute", async () => {
  const key = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
  const sig = "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";
  assert.equal(await crypto.verifyEd25519(key, sig, ""), true);
  assert.equal(await crypto.verifyEd25519(key, "00" + sig.slice(2), ""), false);
  assert.equal(await crypto.verifyEd25519(key, sig, "00"), false);
});
test("unsupported crypto produces a typed redacted limitation", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try { Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true }); await rejects("crypto unavailable", ["CRYPTO"], () => crypto.verifyEd25519("00".repeat(32), "00".repeat(64), "00".repeat(32))); }
  finally { Object.defineProperty(globalThis, "crypto", descriptor); }
});

for (const tag of [0, 1, 3, 7, 8, 9, 10, 11, 12, 13, 99]) mutate(`forbidden registered certificate tag ${tag}`, ["CERTIFICATE"], map => { untag(map.get(4n))[0][0] = BigInt(tag); });
for (const tag of [0, 1, 9, 10, 12, 13, 99]) mutate(`forbidden unregistered certificate tag ${tag}`, ["CERTIFICATE"], map => { untag(map.get(4n))[0][0] = BigInt(tag); }, get("unregistered"));
mutate("duplicate certificates", ["CBOR"], map => { const set = untag(map.get(4n)); set.push(set[0]); });
mutate("empty certificates", ["CERTIFICATE"], map => { map.set(4n, []); });
mutate("wrong certificate credential", ["CERTIFICATE"], map => { untag(map.get(4n))[0][1][1] = b("66".repeat(28)); });
mutate("script certificate credential", ["CERTIFICATE"], map => { untag(map.get(4n))[0][1][0] = 1n; });
mutate("certificate extra fields", ["CERTIFICATE"], map => { untag(map.get(4n))[0].push(0n); });
mutate("certificate missing credential", ["CERTIFICATE"], map => { untag(map.get(4n))[0].splice(1); });
mutate("wrong explicit deposit", ["CERTIFICATE"], map => { untag(map.get(4n))[0][3] = 1999999n; }, get("unregistered"));
mutate("wrong tag7 deposit", ["CERTIFICATE"], map => { untag(map.get(4n))[0][2] = 1999999n; }, get("registration7and2"));
mutate("reversed tag7 then2 sequence", ["CERTIFICATE"], map => { untag(map.get(4n)).reverse(); }, get("registration7and2"));
mutate("missing network", ["BODY"], map => { map.delete(15n); });
mutate("wrong network", ["NETWORK"], map => { map.set(15n, 0n); });
for (const key of [5, 6, 7, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 99]) mutate(`forbidden body key ${key} even empty`, ["BODY"], map => { map.set(BigInt(key), new Map()); });
for (const key of [0, 1, 2, 3, 4]) mutate(`missing required body key ${key}`, ["BODY"], map => { map.delete(BigInt(key)); });

mutate("foreign input", ["INPUT"], map => { untag(map.get(0n))[0][0] = b("77".repeat(32)); });
mutate("duplicate selected input", ["CBOR"], map => { const set = untag(map.get(0n)); set.push(set[0]); });
mutate("empty selected inputs", ["INPUT"], map => { map.set(0n, []); });
contextMutant("missing provider record", ["INPUT"], c => { c.provider.utxos[0].txId = "77".repeat(32); });
contextMutant("provider value mismatch", ["INPUT"], c => { c.provider.utxos[0].lovelace -= 1n; });
contextMutant("provider address mismatch", ["INPUT"], c => { c.provider.utxos[0].addressHex = "01" + "77".repeat(28) + c.stakeKeyHash; });
contextMutant("provider datum mismatch", ["INPUT"], c => { c.provider.utxos[0].datum = "01"; });
contextMutant("spent input", ["INPUT"], c => { c.provider.utxos[0].unspent = false; });
contextMutant("unknown reference script state", ["CONTEXT"], c => { delete c.wallet.utxos[0].referenceScript; });
contextMutant("selected reference script input", ["INPUT"], c => { c.wallet.utxos[0].referenceScript = c.provider.utxos[0].referenceScript = "01"; });
contextMutant("script input payment credential", ["ADDRESS"], c => { c.wallet.utxos[0].addressHex = c.provider.utxos[0].addressHex = "11" + c.changeAddressHex.slice(2); });
contextMutant("duplicate wallet snapshot", ["INPUT"], c => { c.wallet.utxos.push(clone(c.wallet.utxos[0])); });
contextMutant("duplicate provider snapshot", ["INPUT"], c => { c.provider.utxos.push(clone(c.provider.utxos[0])); });
contextMutant("paginated/incomplete snapshot", ["CONTEXT"], c => { c.wallet.complete = false; });

mutate("output X/A forbidden exact address", ["ADDRESS"], map => { map.get(1n)[0][0] = b("01" + "77".repeat(28) + original.stakeKeyHash); });
mutate("output P/B forbidden exact address", ["ADDRESS"], map => { map.get(1n)[0][0] = b("01" + original.paymentKeyHash + "77".repeat(28)); });
mutate("output enterprise address", ["CBOR"], map => { map.get(1n)[0][0] = b("61" + original.paymentKeyHash); });
mutate("output datum array", ["BODY"], map => { map.get(1n)[0].push(null); });
for (const key of [2n, 3n, 99n]) mutate(`output map forbidden field ${key}`, ["BODY"], map => { const [addr, value] = map.get(1n)[0]; map.set(1n, [new Map([[0n, addr], [1n, value], [key, null]])]); });
test("Babbage map output accepted neighbor", () => { const map = body(original), [addr, value] = map.get(1n)[0]; map.set(1n, [new Map([[0n, addr], [1n, value]])]); assert(guard.reviewBody(raw(map), context()).txId); });
mutate("native asset burn", ["ASSETS"], map => { const value = map.get(1n)[0][1]; const names = [...value[1].values()][0]; names.set([...names.keys()][0], 9007199254740991n); }, get("tokens"));
mutate("native asset diversion unit", ["ASSETS"], map => { const value = map.get(1n)[0][1], names = [...value[1].values()][0], entry = [...names][0]; names.clear(); names.set(b("02"), entry[1]); }, get("tokens"));
mutate("native asset extra", ["ASSETS"], map => { const value = map.get(1n)[0][1], names = [...value[1].values()][0]; names.set(b("02"), 1n); }, get("tokens"));
mutate("native asset negative", ["VALUE"], map => { const names = [...map.get(1n)[0][1][1].values()][0]; names.set([...names.keys()][0], -1n); }, get("tokens"));
mutate("native asset over int64", ["VALUE"], map => { const names = [...map.get(1n)[0][1][1].values()][0]; names.set([...names.keys()][0], 9223372036854775808n); }, get("tokens"));
mutate("native asset zero", ["VALUE"], map => { const names = [...map.get(1n)[0][1][1].values()][0]; names.set([...names.keys()][0], 0n); }, get("tokens"));
mutate("native policy wrong length", ["CBOR"], map => { const assets = map.get(1n)[0][1][1], entry = [...assets][0]; assets.clear(); assets.set(b("55"), entry[1]); }, get("tokens"));
mutate("native name too long", ["VALUE"], map => { const names = [...map.get(1n)[0][1][1].values()][0], entry = [...names][0]; names.clear(); names.set(b("01".repeat(33)), entry[1]); }, get("tokens"));
mutate("ADA diversion", ["ADA"], map => { map.get(1n)[0][1] -= 1n; });
mutate("negative ADA", ["VALUE"], map => { map.get(1n)[0][1] = -1n; });
mutate("output below minADA", ["MIN_ADA"], map => { map.get(1n)[0][1] = 100n; });
contextMutant("unknown numeric input quantity", ["VALUE"], c => { c.wallet.utxos[0].lovelace = 100000000; });
contextMutant("input asset malformed identifier", ["VALUE"], c => { c.wallet.utxos[0].assets = { bad: 1n }; });
contextMutant("unknown parameter", ["PARAMETERS"], c => { c.parameters.minFeeCoefficient = null; });
contextMutant("zero minADA coefficient", ["PARAMETERS"], c => { c.parameters.coinsPerUTxOByte = 0n; });
contextMutant("body/transaction size", ["SIZE"], c => { c.parameters.maxTxSize = 250n; c.parameters.maxValueSize = 100n; });
mutate("value size limit", ["SIZE"], () => {}, get("tokens"), c => { c.parameters.maxValueSize = 4n; });

function feeBody(fee) { const map = body(original); map.set(2n, fee); map.get(1n)[0][1] = 100000000n - fee; return raw(map); }
test("independent exact planned fee boundaries", () => {
  // Original192 byte body, canonical205 byte witnesses, ARRAY3+null2 bytes.
  const minimum = 155381n + 44n * 399n; assert.equal(minimum, 172937n);
  for (const fee of [minimum, minimum + 10000n]) assert.equal(guard.reviewBody(feeBody(fee), context()).minimumFee, minimum);
  for (const fee of [minimum - 1n, minimum + 10001n, 500001n]) rejection(`fee ${fee}`, ["FEE"], () => guard.reviewBody(feeBody(fee), context()));
});
test("absolute fee cap has an independently accepted neighbor", () => {
  const c = context(); c.parameters.minFeeConstant = 482444n; // 482444+44*399=500000
  assert.equal(guard.reviewBody(feeBody(500000n), c).minimumFee, 500000n);
  rejection("absolute cap", ["FEE"], () => guard.reviewBody(feeBody(500001n), c));
});
// These are the original fixture generator's public, valueless Ed25519 seeds.
// Standard Node crypto signs the exact new body ID; no wallet/provider is used.
function signedFeeBody(fee) {
  const hex = feeBody(fee), id = crypto.bodyId(hex);
  const witnesses = ["11", "22"].map(seed => {
    const key = createPrivateKey({ key: b("302e020100300506032b657004220420" + seed.repeat(32)), format: "der", type: "pkcs8" });
    const publicKey = createPublicKey(key), vkey = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const signature = sign(null, b(id), key);
    assert(verify(null, b(id), publicKey, signature));
    return [vkey, signature];
  });
  assert.deepEqual(witnesses.map(([vkey]) => crypto.keyHash(vkey.toString("hex"))).sort(), [original.paymentKeyHash, original.stakeKeyHash].sort());
  assert.equal(b(hex).length, 192);
  return { hex, witnesses, signedHex: "84" + hex + raw(new Map([[0n, witnesses]])) + "f5f6" };
}
test("final fee minimum uses real signatures and only witness encoding changes", async () => {
  // ARRAY3 omits isValid: body 192 + canonical witnesses 205 + array/null 2 =399.
  const minimum = 155381n + 44n * 399n, f = signedFeeBody(minimum);
  assert.equal(minimum, 172937n);
  const c = context(), review = guard.reviewBody(f.hex, c);
  assert.equal((await guard.verifySignedTransaction(f.signedHex, review, c)).minimumFee, minimum);
  const tagged = "84" + f.hex + raw(new Map([[0n, { tag: 258n, value: f.witnesses }]])) + "f5f6";
  assert.equal(b(tagged).length, b(f.signedHex).length + 3);
  assert.equal(155381n + 44n * BigInt(b(tagged).length - 1), minimum + 132n);
  await rejects("below final minimum with real signatures", ["FEE"], () => guard.verifySignedTransaction(tagged, review, c));
});
test("real signatures accept canonical fee minimum plus 10000 and reject plus 10001", async () => {
  const minimum = 155381n + 44n * 399n, f = signedFeeBody(minimum + 10000n), c = context();
  const review = guard.reviewBody(f.hex, c), accepted = await guard.verifySignedTransaction(f.signedHex, review, c);
  assert.equal(accepted.fee, accepted.minimumFee + 10000n);
  rejection("canonical fee minimum plus10001", ["FEE"], () => guard.reviewBody(feeBody(minimum + 10001n), context()));
});
mutate("foreign required signer", ["SIGNER"], map => { map.set(14n, [b("66".repeat(28))]); map.set(2n, 180000n); map.get(1n)[0][1] = 99820000n; });
mutate("duplicate required signer", ["CBOR"], map => { map.set(14n, [b(original.stakeKeyHash), b(original.stakeKeyHash)]); });
test("required signer normal tag258 accepted", () => { const map = body(get("required")); map.set(14n, { tag: 258n, value: untag(map.get(14n)) }); assert(guard.reviewBody(raw(map), context(get("required")))); });
test("untagged body sets accepted neighbor", () => { const map = body(original); map.set(0n, untag(map.get(0n))); map.set(4n, untag(map.get(4n))); assert(guard.reviewBody(raw(map), context())); });

for (const [name, change, codes] of [
  ["missing witnesses", tx => { tx[1] = new Map(); }, ["WITNESS", "FEE"]],
  ["partial witnesses", tx => { untag(tx[1].get(0n)).pop(); }, ["WITNESS"]],
  ["duplicate witnesses", tx => { const set = untag(tx[1].get(0n)); set[1] = set[0]; }, ["WITNESS"]],
  ["extra witnesses", tx => { const set = untag(tx[1].get(0n)); set.push(set[0]); }, ["WITNESS"]],
  ["wrong vkey", tx => { untag(tx[1].get(0n))[0][0] = b("66".repeat(32)); }, ["WITNESS"]],
  ["corrupt signature same body", tx => { untag(tx[1].get(0n))[0][1][0] ^= 1; }, ["SIGNATURE"]],
  ["short signature", tx => { untag(tx[1].get(0n))[0][1] = b("00"); }, ["CBOR", "WITNESS"]],
  ["false isValid", tx => { tx[2] = false; }, ["BODY"]],
  ["auxiliary metadata", tx => { tx[3] = new Map(); }, ["BODY"]],
  ["changed signed body", tx => { tx[0].set(15n, 0n); }, ["REVIEW"]],
]) test(name, async () => { const review = guard.reviewBody(original.bodyHex, context()), tx = readFixture(original.signedHex); change(tx); await rejects(name, codes, () => guard.verifySignedTransaction(raw(tx), review, context())); });
for (const key of [1n, 2n, 3n, 4n, 5n, 6n, 7n, 99n]) test(`forbidden witness field ${key}`, async () => {
  const tx = readFixture(original.signedHex); tx[1].set(key, []); const review = guard.reviewBody(original.bodyHex, context());
  await rejects(`witness field ${key}`, ["WITNESS"], () => guard.verifySignedTransaction(raw(tx), review, context()));
});

test("normal tip advancement and exact 180/120 positive boundaries", async () => {
  const c = context(), review = guard.reviewBody(original.bodyHex, c);
  for (const slots of [1, 30, 420]) guard.validateBeforeSigning(review, advance(c, slots));
  assert.equal((await guard.verifySignedTransaction(original.signedHex, review, advance(c, 480))).txId, original.txId);
});
test("pre-sign 180 accepts then monotonic 179 rejects on an independent review", () => {
  const c = context(), review = guard.reviewBody(original.bodyHex, c);
  guard.validateBeforeSigning(review, advance(c, 420)); // 600 - 420 = 180.
  rejection("179 slots pre-sign", ["VALIDITY"], () => guard.validateBeforeSigning(review, advance(c, 421)));
});
test("final 120 accepts then monotonic 119 rejects the original real signatures", async () => {
  const c = context(), review = guard.reviewBody(original.bodyHex, c);
  assert.equal((await guard.verifySignedTransaction(original.signedHex, review, advance(c, 480))).txId, original.txId);
  await rejects("119 slots pre-submit", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, review, advance(c, 481)));
});
test("expiry rejects original signed bytes without an earlier conflicting observation", async () => {
  const c = context(), review = guard.reviewBody(original.bodyHex, c);
  await rejects("expired with no earlier conflict", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, review, advance(c, 600)));
});
mutate("TTL not construction+600", ["VALIDITY"], map => { map.set(3n, map.get(3n) + 1n); });
mutate("future lower bound", ["VALIDITY"], map => { map.set(8n, BigInt(original.constructionSlot) + 1n); });
mutate("negative upper bound", ["VALUE"], map => { map.set(3n, -1n); });
contextMutant("tip rollback", ["VALIDITY"], c => { c.currentTip.slot -= 1n; });
contextMutant("same-slot fork", ["VALIDITY"], c => { c.currentTip.hash = "bb".repeat(32); });
contextMutant("unknown registration", ["CONTEXT"], c => { c.registration = "unknown"; });
contextMutant("already EASY1 must reassess", ["BINDING"], c => { c.currentPoolHash = guard.EASY1_POOL_HASH; });
contextMutant("network context mismatch", ["NETWORK"], c => { c.networkId = 0; });
contextMutant("stake account mismatch", ["BINDING"], c => { c.stakeKeyHash = "66".repeat(28); });
contextMutant("unsupported slot config", ["VALIDITY"], c => { c.slotConfig.slotLength = 20; });
for (const [name, change] of [
  ["revision", c => { c.revision++; }],
  ["change address", c => { c.changeAddressHex = "01" + "66".repeat(28) + c.stakeKeyHash; }],
  ["registration", c => { c.registration = "unregistered"; }],
  ["delegation", c => { c.currentPoolHash = "66".repeat(28); }],
  ["parameter identity", c => { c.parameters.identity = "66".repeat(32); }],
  ["parameter coefficient", c => { c.parameters.coinsPerUTxOByte++; }],
  ["selected input value", c => { c.wallet.utxos[0].lovelace++; c.provider.utxos[0].lovelace++; }],
  ["construction tip", c => { c.constructionTip.hash = c.currentTip.hash = "66".repeat(32); }],
]) test(`review invalidated by ${name}`, async () => {
  const c = context(), review = guard.reviewBody(original.bodyHex, c); change(c);
  await rejects(name, name === "construction tip" ? ["VALIDITY"] : ["BINDING", "ADDRESS", "CERTIFICATE", "ADA"], () => guard.verifySignedTransaction(original.signedHex, review, c));
});
for (const [label, accessor] of [
  ["binding", c => [c, "bindingObservedAt"]], ["registration", c => [c, "registrationObservedAt"]],
  ["tip", c => [c.currentTip, "observedAt"]], ["parameters", c => [c.parameters, "observedAt"]],
  ["wallet", c => [c.wallet, "observedAt"]], ["provider", c => [c.provider, "observedAt"]],
]) test(`${label} observation has precise 30s freshness`, () => {
  const c = context(), [target, key] = accessor(c); target[key] -= 30000;
  if (label === "tip") c.constructionTip.observedAt = target[key];
  assert(guard.reviewBody(original.bodyHex, c));
  target[key]--; rejection(`${label} stale`, ["STALE"], () => guard.reviewBody(original.bodyHex, c));
  target[key] = c.now + 1; rejection(`${label} future`, ["STALE", "VALIDITY"], () => guard.reviewBody(original.bodyHex, c));
});
for (const bad of [NaN, Infinity, -1, 1.5, "1793401779000"]) contextMutant(`invalid now ${bad}`, ["CONTEXT"], c => { c.now = bad; });
contextMutant("parameter epoch change", ["PARAMETERS"], c => { c.parameters.epoch++; });
contextMutant("tip epoch inconsistency", ["CONTEXT"], c => { c.currentTip.epoch++; });
test("issued review and accepted bytes resist caller mutation and forgery", async () => {
  const c = context(), review = guard.reviewBody(original.bodyHex, c), copy = { ...review };
  assert(Object.isFrozen(review)); assert(Object.isFrozen(review.inputRefs)); assert(Object.isFrozen(review.expectedKeyHashes));
  assert.throws(() => { review.bodyHex = "a0"; }, TypeError);
  assert.throws(() => { review.expectedKeyHashes.push("00"); }, TypeError);
  await rejects("forged review", ["REVIEW"], () => guard.verifySignedTransaction(original.signedHex, copy, c));
  const input = b(original.signedHex), signedHex = input.toString("hex"), accepted = await guard.verifySignedTransaction(signedHex, review, c); input.fill(0);
  assert.equal(accepted.signedHex, original.signedHex); assert(Object.isFrozen(accepted));
  c.wallet.utxos[0].lovelace = 0n;
  assert.equal(review.txId, original.txId); assert.equal(review.fee.toString(), original.fee);
  await rejects("mutated caller input", ["INPUT"], () => guard.verifySignedTransaction(original.signedHex, review, c));
});

for (const [name, value] of [
  ["empty", ""], ["truncated", "a1"], ["trailing data", original.bodyHex + "00"],
  ["huge array count", "9bffffffffffffffff"], ["huge bytes count", "5bffffffffffffffff"],
  ["unsupported tag", "c000"], ["indefinite array", "9fff"], ["non-minimal integer", "1817"],
  ["excessive depth", "81".repeat(26) + "00"], ["malformed map pair", "a100"],
  ["text string", "6161"], ["float", "f90000"], ["non-hex", "zz"],
  ["odd hex", "0"], ["tag258 wrong member shape", "d9010200"],
]) test(`raw CBOR rejects ${name}`, () => rejection(name, ["CBOR", "BODY"], () => guard.reviewBody(value, context())));
for (const [name, duplicate, unique] of [
  ["duplicate integer map key", "a200000001", "a10000"],
  ["duplicate bytes map key", "a240004001", "a14000"],
]) test(`raw CBOR rejects ${name}`, () => {
  assert.equal(cbor.decode(unique).kind, "map");
  rejection(name, ["CBOR"], () => cbor.decode(duplicate));
});
test("complete balanced body rejects a duplicate fee key before body policy", () => {
  const hex = feeBody(180000n), map = readFixture(hex);
  assert.equal(map.get(1n)[0][1], 99820000n);
  assert.equal(guard.reviewBody(hex, context()).fee, 180000n);
  const duplicate = Buffer.concat([head(5, map.size + 1), ...[...map].flatMap(([key, value]) => [encode(key), encode(value)]), encode(2n), encode(180000n)]).toString("hex");
  assert.equal(b(duplicate).length, b(hex).length + 6);
  // The extra 6 body bytes are funded: planned official 405 bytes, minimum 173201.
  assert.equal(155381n + 44n * 405n, 173201n);
  assert(180000n >= 173201n && 180000n <= 173201n + 10000n);
  rejection("duplicate valid fee body", ["CBOR"], () => guard.reviewBody(duplicate, context()));
});
test("parser byte resource bound", () => rejection("byte bound", ["CBOR"], () => cbor.decode("00".repeat(65537))));
test("minimum ADA exact accepted/rejected neighbors use serialized output bytes", () => {
  const map = body(original), c = context(), minimum = 4310n * 225n; // array1 + address59 + coin5 =65
  map.get(1n)[0][1] = minimum;
  c.wallet.utxos[0].lovelace = c.provider.utxos[0].lovelace = minimum + BigInt(original.fee);
  assert(guard.reviewBody(raw(map), c));
  map.get(1n)[0][1]--;
  c.wallet.utxos[0].lovelace--; c.provider.utxos[0].lovelace--;
  rejection("minADA one below", ["MIN_ADA"], () => guard.reviewBody(raw(map), c));
});
test("size and value-size accepted exact neighbors", async () => {
  const c = context(); c.parameters.maxTxSize = 403n; c.parameters.maxValueSize = 5n;
  const review = guard.reviewBody(original.bodyHex, c);
  assert(await guard.verifySignedTransaction(original.signedHex, review, c));
  // Independent issuance fixes the tighter bound in this review's fingerprint.
  // The unsigned plan is 400 mempool bytes; original tagged signed bytes are 403.
  const tight = context(); tight.parameters.maxTxSize = 402n; tight.parameters.maxValueSize = 5n;
  const tightReview = guard.reviewBody(original.bodyHex, tight);
  await rejects("final size above unchanged limit", ["SIZE"], () => guard.verifySignedTransaction(original.signedHex, tightReview, tight));
  c.parameters.maxValueSize = 4n;
  rejection("value size one below", ["SIZE"], () => guard.reviewBody(original.bodyHex, c));
});
test("ordinary key input with a corroborated datum and unrelated snapshot entries", () => {
  const c = context(); c.wallet.utxos[0].datum = c.provider.utxos[0].datum = "d87980";
  const other = { ...clone(c.wallet.utxos[0]), txId: "66".repeat(32), referenceScript: "00" };
  c.wallet.utxos.push(other); c.provider.utxos.push({ ...clone(other), unspent: true });
  assert(guard.reviewBody(original.bodyHex, c));
});
test("same value independent asset-map order does not alter semantic review", async () => {
  const f = get("tokens"), c = context(f), review = guard.reviewBody(f.bodyHex, c);
  c.wallet.utxos[0].assets = Object.fromEntries(Object.entries(c.wallet.utxos[0].assets).reverse());
  assert(await guard.verifySignedTransaction(f.signedHex, review, c));
});
test("context mutation while WebCrypto awaits is rejected", async () => {
  const c = context(), review = guard.reviewBody(original.bodyHex, c);
  const accepted = guard.verifySignedTransaction(original.signedHex, review, c); c.revision++;
  await rejects("context changed during verification", ["BINDING"], () => accepted);
});
test("canonical witness assembly rejects raw script fields and corrupt signatures", async () => {
  const c = context(), review = guard.reviewBody(original.bodyHex, c), tx = readFixture(original.signedHex);
  untag(tx[1].get(0n))[0][1][0] ^= 1;
  await rejects("assemble corrupt signature", ["SIGNATURE"], () => guard.assembleSignedTransaction(raw(tx[1]), review, c));
  tx[1].set(1n, []);
  await rejects("assemble script witness", ["WITNESS"], () => guard.assembleSignedTransaction(raw(tx[1]), review, c));
});
for (const [name, change, codes] of [
  ["missing context shape", c => { delete c.provider; }, ["CONTEXT"]],
  ["unknown context keys", c => { c.extra = true; }, ["CONTEXT"]],
  ["unknown wallet assets", c => { c.wallet.utxos[0].assets = null; }, ["CONTEXT"]],
  ["boolean registration proof", c => { c.registration = true; }, ["CONTEXT"]],
  ["null provider reference state", c => { c.provider.utxos[0].referenceScript = undefined; }, ["INPUT"]],
  ["invalid revision", c => { c.revision = NaN; }, ["REVISION"]],
  ["non-base change", c => { c.changeAddressHex = "61" + original.paymentKeyHash; }, ["ADDRESS"]],
  ["invalid parameter max", c => { c.parameters.maxValueSize = 17000n; }, ["PARAMETERS"]],
  ["future chain slot", c => { c.now--; c.currentTip.observedAt--; c.bindingObservedAt--; c.registrationObservedAt--; c.parameters.observedAt--; c.wallet.observedAt--; c.provider.observedAt--; c.constructionTip.observedAt--; }, ["STALE"]],
]) contextMutant(name, codes, change);
test("redacted failures never echo supplied payload", () => {
  const c = context(); c.parameters.identity = "sensitive-synthetic-header";
  try { guard.reviewBody(original.bodyHex, c); assert.fail("must reject"); } catch (error) { assert(error instanceof GuardError); assert(!String(error).includes("sensitive-synthetic-header")); }
});

test("issuance retains actual current-slot hash above construction", async () => {
  const c = advance(context(), 1), review = guard.reviewBody(original.bodyHex, c);
  assert(await guard.verifySignedTransaction(original.signedHex, review, c));
  const replacement = clone(c); replacement.currentTip.hash = "ac".repeat(32);
  await rejects("issuance same-slot replacement", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, review, replacement));
  await rejects("revoked issuance cannot resurrect", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, review, c));
});
test("successful pre-sign retains latest slot and hash", async () => {
  const c = advance(context(), 1), review = guard.reviewBody(original.bodyHex, c), latest = advance(context(), 21);
  guard.validateBeforeSigning(review, latest);
  assert(await guard.verifySignedTransaction(original.signedHex, review, latest));
  const replacement = clone(latest); replacement.currentTip.hash = "ac".repeat(32);
  rejection("accepted same-slot replacement", ["VALIDITY"], () => guard.validateBeforeSigning(review, replacement));
  await rejects("revoked pre-sign cannot resurrect", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, review, latest));
});
test("successful pre-sign rejects rollback above issuance with valid signed bytes", async () => {
  const review = guard.reviewBody(original.bodyHex, advance(context(), 1));
  guard.validateBeforeSigning(review, advance(context(), 21));
  await rejects("pre-sign accepted envelope rollback", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, review, advance(context(), 20)));
});
test("successful final check retains latest slot and rejects rollback above issuance", async () => {
  const c = advance(context(), 1), review = guard.reviewBody(original.bodyHex, c);
  assert(await guard.verifySignedTransaction(original.signedHex, review, advance(context(), 21)));
  await rejects("accepted envelope rollback above issuance", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, review, advance(context(), 20)));
  await rejects("rollback cannot resurrect", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, review, advance(context(), 22)));
});
test("revocation stays local to the issued candidate", async () => {
  const c = context(), candidateA = guard.reviewBody(original.bodyHex, c), candidateB = guard.reviewBody(original.bodyHex, c);
  assert.notEqual(candidateA, candidateB); assert.equal(candidateA.txId, candidateB.txId);
  const conflict = clone(c); conflict.currentTip.hash = "ac".repeat(32);
  rejection("candidate A conflicting tip", ["VALIDITY"], () => guard.validateBeforeSigning(candidateA, conflict));
  assert.equal((await guard.verifySignedTransaction(original.signedHex, candidateB, c)).txId, original.txId);
  await rejects("candidate A remains revoked after B accepts", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, candidateA, c));
});
test("monotonic accepted envelopes and immutable primitive capture", async () => {
  const c = advance(context(), 1), review = guard.reviewBody(original.bodyHex, c);
  c.currentTip.slot = 1n; c.currentTip.hash = "ff".repeat(32);
  for (const slots of [2, 20, 21, 22]) {
    const fresh = advance(context(), slots); guard.validateBeforeSigning(review, fresh);
    assert(await guard.verifySignedTransaction(original.signedHex, review, fresh));
  }
  const latest = advance(context(), 23); guard.validateBeforeSigning(review, latest);
  latest.currentTip.slot = 1n; latest.currentTip.hash = "ff".repeat(32);
  assert(await guard.verifySignedTransaction(original.signedHex, review, advance(context(), 23)));
});
test("failed semantic and stale checks never advance accepted envelope", async () => {
  const review = guard.reviewBody(original.bodyHex, advance(context(), 1));
  guard.validateBeforeSigning(review, advance(context(), 21));
  const bad = advance(context(), 30); bad.parameters.identity = "ac".repeat(32);
  rejection("failed semantic does not advance", ["BINDING"], () => guard.validateBeforeSigning(review, bad));
  const stale = advance(context(), 30); stale.provider.observedAt -= 30001;
  rejection("failed stale does not advance", ["STALE"], () => guard.validateBeforeSigning(review, stale));
  assert(await guard.verifySignedTransaction(original.signedHex, review, advance(context(), 22)));
});
test("failed real signature verification never advances accepted envelope", async () => {
  const review = guard.reviewBody(original.bodyHex, advance(context(), 1));
  guard.validateBeforeSigning(review, advance(context(), 21));
  const tx = readFixture(original.signedHex); untag(tx[1].get(0n))[0][1][0] ^= 1;
  await rejects("failed signature does not advance", ["SIGNATURE"], () => guard.verifySignedTransaction(raw(tx), review, advance(context(), 30)));
  assert(await guard.verifySignedTransaction(original.signedHex, review, advance(context(), 22)));
});
async function scheduleRealVerification(action) {
  const subtle = globalThis.crypto.subtle, descriptor = Object.getOwnPropertyDescriptor(subtle, "verify"), real = subtle.verify.bind(subtle);
  let release, observed, first = true;
  const barrier = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { observed = resolve; });
  Object.defineProperty(subtle, "verify", { configurable: true, value: async (...args) => {
    const result = await real(...args);
    if (first) { first = false; observed(); await barrier; }
    return result;
  } });
  try { await action({ started, release }); }
  finally { release(); if (descriptor) Object.defineProperty(subtle, "verify", descriptor); else delete subtle.verify; }
}
test("older in-flight real signature verification cannot downgrade accepted envelope", async () => {
  const review = guard.reviewBody(original.bodyHex, advance(context(), 1));
  await scheduleRealVerification(async ({ started, release }) => {
    const pending = guard.verifySignedTransaction(original.signedHex, review, advance(context(), 20));
    await Promise.race([started, pending.then(() => { throw Error("CRYPTO_INSTRUMENT: verification completed without invoking real crypto"); })]);
    assert(await guard.verifySignedTransaction(original.signedHex, review, advance(context(), 21))); release();
    await rejects("in-flight older accepted tip", ["VALIDITY"], () => pending);
    await rejects("in-flight conflict permanently invalidates", ["VALIDITY"], () => guard.verifySignedTransaction(original.signedHex, review, advance(context(), 22)));
  });
});
test("older in-flight real signature verification cannot accept after revocation", async () => {
  const review = guard.reviewBody(original.bodyHex, advance(context(), 1));
  await scheduleRealVerification(async ({ started, release }) => {
    const pending = guard.verifySignedTransaction(original.signedHex, review, advance(context(), 20));
    await Promise.race([started, pending.then(() => { throw Error("CRYPTO_INSTRUMENT: verification completed without invoking real crypto"); })]);
    const newer = advance(context(), 21); guard.validateBeforeSigning(review, newer);
    const conflict = clone(newer); conflict.currentTip.hash = "ac".repeat(32);
    rejection("concurrent conflicting observation", ["VALIDITY"], () => guard.validateBeforeSigning(review, conflict));
    release(); await rejects("in-flight revoked tip", ["VALIDITY"], () => pending);
  });
});
