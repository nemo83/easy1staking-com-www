#!/usr/bin/env node
"use strict";
// Executes actual production TypeScript, SDK serialization, guard issuance and crypto.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const assert = require("node:assert/strict");
const { createHash, createPrivateKey, createPublicKey, sign } = require("node:crypto");
const { test, after } = require("node:test");
const { registerHooks } = require("node:module"), { fileURLToPath } = require("node:url");
const transitivePaths = new Set();
const moduleHook = registerHooks({ load(url, context, next) {
  const result = next(url, context);
  if (url.startsWith("file:") && fileURLToPath(url).includes(path.sep + "node_modules" + path.sep)) transitivePaths.add(fileURLToPath(url));
  return result;
} });
const ts = require("typescript");
assert.match(process.version, /^v24\./, "Use the pinned Node 24 runtime");
const root = path.resolve(__dirname, ".."), source = path.join(root, "src/lib/site/delegation");
const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/stake-builder.json"))).vectors;
const loaded = new Map(), sdkModules = new Map();
function loader(overrides = {}, graph = loaded) {
  function load(file) {
    if (graph.has(file)) return graph.get(file).exports;
    const module = { exports: {} }; graph.set(file, module);
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017, esModuleInterop: true } }).outputText;
    module.compiledSha256 = createHash("sha256").update(js).digest("hex");
    const localRequire = id => {
      if (id.startsWith(".")) return load(path.resolve(path.dirname(file), id + ".ts"));
      if (id.startsWith("@evolution-sdk/evolution/")) {
        const resolved = require.resolve(id); sdkModules.set(id, resolved);
        return overrides[id] || require(id);
      }
      return require(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = loader(), builder = load(path.join(source, "builder.ts")), guard = load(path.join(source, "guard.ts"));
const crypto = load(path.join(source, "crypto.ts"));
const { GuardError } = load(path.join(source, "types.ts"));
const bytes = hex => Buffer.from(hex, "hex"), clone = structuredClone;

// Trusted-vector codec only: no builder, guard or transaction policy is copied here.
function read(hex) {
  const data = bytes(hex); let at = 0;
  function item() {
    const first = data[at++], major = first >> 5, ai = first & 31;
    if (major === 7) return ({ 20: false, 21: true, 22: null })[ai];
    let n = BigInt(ai);
    if (ai >= 24) { const width = 2 ** (ai - 24); n = 0n; for (let i = 0; i < width; i++) n = n * 256n + BigInt(data[at++]); }
    if (major === 0) return n;
    if (major === 2) { const v = Buffer.from(data.subarray(at, at + Number(n))); at += Number(n); return v; }
    if (major === 6) return { tag: n, value: item() };
    if (major === 4) return Array.from({ length: Number(n) }, item);
    if (major === 5) return new Map(Array.from({ length: Number(n) }, () => [item(), item()]));
    throw Error("unsupported trusted fixture");
  }
  const value = item(); assert.equal(at, data.length); return value;
}
function header(major, n) {
  n = BigInt(n); if (n < 24n) return Buffer.from([major * 32 + Number(n)]);
  for (const width of [1, 2, 4, 8]) if (n < (1n << BigInt(width * 8))) {
    const b = Buffer.alloc(width + 1); b[0] = major * 32 + 24 + Math.log2(width);
    for (let i = width; i > 0; i--) { b[i] = Number(n & 255n); n >>= 8n; } return b;
  }
  throw Error("fixture integer overflow");
}
function encode(v) {
  if (typeof v === "bigint") return header(0, v);
  if (Buffer.isBuffer(v)) return Buffer.concat([header(2, v.length), v]);
  if (Array.isArray(v)) return Buffer.concat([header(4, v.length), ...v.map(encode)]);
  if (v instanceof Map) return Buffer.concat([header(5, v.size), ...[...v].flatMap(([k, x]) => [encode(k), encode(x)])]);
  if (v && typeof v === "object" && "tag" in v) return Buffer.concat([header(6, v.tag), encode(v.value)]);
  if (v === null || typeof v === "boolean") return Buffer.from([v === null ? 246 : v ? 245 : 244]);
  throw Error("unsupported fixture shape");
}
const untag = v => v && "tag" in v ? v.value : v;
const raw = v => encode(v).toString("hex");
function context(f = vectors[0]) {
  const slot = BigInt(f.constructionSlot), now = 1596059091000 + Number(slot - 4492800n) * 1000;
  const tip = { slot, hash: "aa".repeat(32), epoch: 664n, observedAt: now };
  const input = { txId: f.inputId, index: 0n, addressHex: f.addressHex, lovelace: BigInt(f.funding), assets: {}, datum: null, referenceScript: null };
  return { networkId: 1, revision: 1, changeAddressHex: f.addressHex, stakeKeyHash: f.stakeKeyHash, bindingObservedAt: now,
    registration: f.registered ? "registered" : "unregistered", currentPoolHash: null, registrationObservedAt: now,
    constructionTip: { ...tip }, currentTip: { ...tip }, slotConfig: { zeroTime: 1596059091000n, zeroSlot: 4492800n, slotLength: 1000 },
    parameters: { identity: "b1848e36b120c1f2276f0435482d2dfa6e6ac15445faef6612012a054641d57a", epoch: 664n, observedAt: now,
      minFeeCoefficient: 44n, minFeeConstant: 155381n, stakeDeposit: 2000000n, coinsPerUTxOByte: 4310n, maxTxSize: 16384n, maxValueSize: 5000n },
    wallet: { complete: true, observedAt: now, utxos: [input] }, provider: { observedAt: now, utxos: [{ ...clone(input), unspent: true }] }, now };
}
function correlate(c, inputs = c.wallet.utxos) {
  c.wallet.utxos = inputs; c.provider.utxos = inputs.map(i => ({ ...clone(i), unspent: true })); return c;
}
function key(seed) {
  const privateKey = createPrivateKey({ key: Buffer.concat([bytes("302e020100300506032b657004220420"), bytes(seed)]), format: "der", type: "pkcs8" });
  const publicKey = createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32);
  return { privateKey, publicKey, hash: crypto.keyHash(publicKey.toString("hex")) };
}
// Public, valueless deterministic seeds; never used by the production module.
const payment = key("11".repeat(32)), stake = key("22".repeat(32));
const rawAccountingCases = [];
function witnessHex(review, keys) {
  return raw(new Map([[0n, keys.map(k => [k.publicKey, sign(null, bytes(review.txId), k.privateKey)])]]));
}
async function signed(result, c, keys = [payment, stake]) {
  guard.validateBeforeSigning(result.review, c);
  const accepted = await guard.assembleSignedTransaction(witnessHex(result.review, keys), result.review, c);
  const verified = await guard.verifySignedTransaction(accepted.signedHex, result.review, c);
  assert.equal(verified.txId, result.review.txId); assert.equal(verified.minimumFee, result.review.minimumFee);
  assert.equal(verified.fee, result.review.fee); assert.equal(verified.signedHex, accepted.signedHex);
  assert(accepted.signedHex.startsWith("84" + result.review.bodyHex));
  rawAccountingCases.push({ bodyHex: result.review.bodyHex, txId: result.review.txId, signedHex: accepted.signedHex,
    walletInputs: clone(c.wallet.utxos), changeAddressHex: c.changeAddressHex, stakeKeyHash: c.stakeKeyHash,
    registration: c.registration, parameters: clone(c.parameters), constructionSlot: c.constructionTip.slot });
  return accepted;
}
function assertResult(result, c) {
  assert(Object.isFrozen(result) && Object.isFrozen(result.review));
  const full = read(result.unsignedHex), map = read(result.review.bodyHex);
  assert.equal(raw(full[0]), result.review.bodyHex); assert.equal(full[1].size, 0); assert.equal(full[2], true); assert.equal(full[3], null);
  assert.deepEqual([...map.keys()].sort((a, b) => Number(a - b)), [0n, 1n, 2n, 3n, 4n, 15n]);
  assert.equal(map.get(15n), 1n); assert.equal(map.get(3n), c.constructionTip.slot + 600n);
  assert.equal(map.get(1n).length, 1);
  const out = map.get(1n)[0], [addr, value] = out instanceof Map ? [out.get(0n), out.get(1n)] : out;
  assert.equal(addr.toString("hex"), c.changeAddressHex);
  const inputRefs = untag(map.get(0n)).map(([id, index]) => `${id.toString("hex")}#${index}`);
  const selected = c.wallet.utxos.filter(i => inputRefs.includes(`${i.txId}#${i.index}`));
  assert.equal(inputRefs.length, selected.length);
  const expected = {}, actual = {};
  for (const i of selected) for (const [unit, q] of Object.entries(i.assets)) expected[unit] = (expected[unit] || 0n) + q;
  const coin = typeof value === "bigint" ? value : value[0];
  if (typeof value !== "bigint") for (const [policy, names] of value[1]) for (const [name, q] of names) actual[policy.toString("hex") + name.toString("hex")] = q;
  assert.deepEqual(actual, expected);
  assert.equal(selected.reduce((n, i) => n + i.lovelace, 0n), coin + result.review.fee + result.review.deposit);
  const count = new Set([c.stakeKeyHash, ...selected.map(i => i.addressHex.slice(2, 58))]).size;
  assert.equal(result.review.expectedKeyHashes.length, count);
  const witnessSize = 2 + (count < 24 ? 1 : count < 256 ? 2 : 3) + count * 101;
  assert.equal(result.review.minimumFee, c.parameters.minFeeConstant + c.parameters.minFeeCoefficient * BigInt(result.review.bodyHex.length / 2 + witnessSize + 2));
  guard.validateBeforeSigning(result.review, c);
  return { map, coin, value, count, witnessSize };
}
function reject(name, change, codes) {
  test(name, () => {
    const c = context(); change(c);
    assert.throws(() => builder.buildStakeTransaction(c), e => {
      assert(e instanceof GuardError || e instanceof builder.BuildError, "fixed typed error required");
      if (codes) assert(codes.includes(e.code), `expected ${codes}, received ${e.code}`);
      assert(!e.message.includes("SYNTHETIC_CANARY")); return true;
    }, `FORBIDDEN_ACCEPTANCE: ${name}`);
  });
}
const emitted = [];
for (const f of vectors) test(`literal SDK ${f.name}: actual builder, issued review, canonical real signatures`, async () => {
  const c = context(f), result = builder.buildStakeTransaction(c); assertResult(result, c);
  assert.equal(result.unsignedHex, f.unsignedHex); assert.equal(result.review.bodyHex, f.bodyHex);
  assert.equal(result.review.txId, f.txId); assert.equal(result.review.fee.toString(), f.fee); assert.equal(result.review.deposit.toString(), f.deposit);
  assert.equal(result.review.minimumFee.toString(), f.fee);
  assert.equal(createHash("sha256").update(bytes(result.review.bodyHex)).digest("hex"), f.bodySha256);
  const accepted = await signed(result, c); assert.equal(accepted.signedHex.length / 2, f.signedSize);
  const node = read(accepted.signedHex); assert.equal(raw(node[1]).length / 2, f.witnessSize);
  emitted.push({ ...f, signedHex: accepted.signedHex, signedSha256: createHash("sha256").update(bytes(accepted.signedHex)).digest("hex") });
  assert.throws(() => guard.validateBeforeSigning({ ...result.review }, c), e => e.code === "REVIEW");
});
test("deduplicated one payment/stake key has one real witness and exact fee", async () => {
  const c = context(); c.changeAddressHex = "01" + stake.hash + stake.hash;
  c.wallet.utxos[0].addressHex = c.changeAddressHex; correlate(c);
  const result = builder.buildStakeTransaction(c); assert.equal(assertResult(result, c).count, 1); await signed(result, c, [stake]);
});
test("24 distinct witnesses include array-header boundary and actual signatures", async () => {
  const c = context(), keys = [stake], inputs = [];
  for (let i = 1; i <= 23; i++) {
    const k = key(i.toString(16).padStart(2, "0").repeat(32)); keys.push(k);
    inputs.push({ ...clone(c.wallet.utxos[0]), txId: i.toString(16).padStart(64, "0"), addressHex: "01" + k.hash + stake.hash, lovelace: 57000n });
  }
  correlate(c, inputs); const result = builder.buildStakeTransaction(c), observed = assertResult(result, c);
  assert.equal(result.review.inputRefs.length, 23); assert.equal(observed.count, 24); assert.equal(observed.witnessSize, 2428);
  await signed(result, c, keys);
});
test("BigInt native assets aggregate across selected inputs without burn", async () => {
  const c = context(), unit = "55".repeat(28) + "abcd", other = "66".repeat(28);
  const first = { ...clone(c.wallet.utxos[0]), lovelace: 750000n, assets: { [unit]: 9007199254740993n } };
  const second = { ...clone(first), txId: "34".repeat(32), assets: { [unit]: 7n, [other]: 13n } };
  correlate(c, [first, second]); const result = builder.buildStakeTransaction(c); assertResult(result, c);
  assert.equal(result.review.inputRefs.length, 2); await signed(result, c);
});
test("ADA-only inputs are preferred over a larger token input", () => {
  const c = context(), token = { ...clone(c.wallet.utxos[0]), txId: "34".repeat(32), lovelace: 100000001n, assets: { ["55".repeat(28)]: 1n } };
  correlate(c, [token, c.wallet.utxos[0]]); const result = builder.buildStakeTransaction(c); assertResult(result, c);
  assert.deepEqual(result.review.inputRefs, ["33".repeat(32) + "#0"]);
});
test("known reference-script funds are skipped; exact corroborated datum may be spent", async () => {
  const c = context(), original = clone(c.wallet.utxos[0]); original.datum = "d87980";
  correlate(c, [{ ...clone(original), txId: "34".repeat(32), lovelace: 100000001n, referenceScript: "00" }, original]);
  const result = builder.buildStakeTransaction(c); assertResult(result, c); assert.deepEqual(result.review.inputRefs, [original.txId + "#0"]); await signed(result, c);
});
test("equal-valued input order and provider order produce identical bytes", () => {
  const c = context(); correlate(c, [c.wallet.utxos[0], { ...clone(c.wallet.utxos[0]), txId: "32".repeat(32) }]);
  const first = builder.buildStakeTransaction(c); c.wallet.utxos.reverse(); c.provider.utxos.reverse();
  const second = builder.buildStakeTransaction(c); assert.equal(first.unsignedHex, second.unsignedHex); assert.equal(second.review.inputRefs[0], "32".repeat(32) + "#0");
});
test("minimum ADA boundary funds exact change and refuses one lovelace less", () => {
  const c = context(); c.wallet.utxos[0].lovelace = 172937n + 969750n; correlate(c);
  const result = builder.buildStakeTransaction(c); assert.equal(assertResult(result, c).coin, 969750n);
  c.wallet.utxos[0].lovelace--; correlate(c);
  assert.throws(() => builder.buildStakeTransaction(c), e => e.code === "INSUFFICIENT_FUNDS");
});
test("final canonical fee plan rejects an SDK-style tagged witness container at exact minimum", async () => {
  const c = context(), result = builder.buildStakeTransaction(c), ws = read(witnessHex(result.review, [payment, stake]));
  const tagged = raw(new Map([[0n, { tag: 258n, value: ws.get(0n) }]]));
  const full = "84" + result.review.bodyHex + tagged + "f5f6";
  await assert.rejects(() => guard.verifySignedTransaction(full, result.review, c), e => e.code === "FEE");
  await signed(result, c);
});
test("real signature corruption is rejected for builder-issued review", async () => {
  const c = context(), result = builder.buildStakeTransaction(c), ws = read(witnessHex(result.review, [payment, stake]));
  ws.get(0n)[0][1][0] ^= 1;
  await assert.rejects(() => guard.assembleSignedTransaction(raw(ws), result.review, c), e => e.code === "SIGNATURE");
});
for (const value of [0, undefined, "1", 2]) reject(`unsupported explicit network ${value}`, c => c.networkId = value, ["NETWORK"]);
for (const value of [undefined, "unknown", false]) reject(`unknown registration ${value}`, c => c.registration = value, ["CONTEXT"]);
reject("already EASY1 acknowledges without returning bytes", c => c.currentPoolHash = guard.EASY1_POOL_HASH, ["ALREADY_DELEGATED"]);
reject("unregistered account cannot name an existing pool", c => { c.registration = "unregistered"; c.currentPoolHash = "44".repeat(28); }, ["BINDING"]);
reject("wrong stake/change credential", c => c.stakeKeyHash = "44".repeat(28), ["BINDING"]);
for (const prefix of ["61", "11", "21"]) reject(`unsupported change address ${prefix}`, c => c.changeAddressHex = prefix + c.changeAddressHex.slice(2), ["ADDRESS"]);
reject("unsupported input address", c => { c.wallet.utxos[0].addressHex = "11" + c.changeAddressHex.slice(2); correlate(c); }, ["ADDRESS"]);
for (const field of ["bindingObservedAt", "registrationObservedAt"]) {
  reject(`stale ${field}`, c => c[field] -= 30001, ["STALE"]);
  reject(`future ${field}`, c => c[field]++, ["STALE"]);
}
for (const field of ["currentTip", "constructionTip", "parameters", "wallet", "provider"]) reject(`stale ${field}`, c => c[field].observedAt -= 30001, ["STALE"]);
for (const revision of [-1, 0.5, "1", NaN]) reject(`invalid revision ${revision}`, c => c.revision = revision, ["REVISION"]);
reject("invalid parameter identity", c => c.parameters.identity = "bad", ["PARAMETERS"]);
reject("wrong effective parameter epoch", c => c.parameters.epoch++, ["PARAMETERS"]);
for (const field of ["minFeeConstant", "minFeeCoefficient", "coinsPerUTxOByte", "stakeDeposit", "maxTxSize", "maxValueSize"]) {
  for (const value of [0n, -1n, 2]) reject(`invalid ${field} ${value}`, c => c.parameters[field] = value);
}
reject("input transaction ref must be exact hex", c => c.wallet.utxos[0].txId = "SYNTHETIC_CANARY", ["INPUT"]);
reject("duplicate wallet inputs", c => c.wallet.utxos.push(clone(c.wallet.utxos[0])), ["INPUT"]);
reject("duplicate provider inputs", c => c.provider.utxos.push(clone(c.provider.utxos[0])), ["INPUT"]);
reject("missing selected provider corroboration differs from insufficient funds", c => c.provider.utxos[0].txId = "44".repeat(32), ["CORROBORATION"]);
for (const [field, value] of [["lovelace", 1n], ["addressHex", "01" + "44".repeat(56)], ["datum", "00"], ["referenceScript", "00"]]) {
  reject(`mismatched provider ${field}`, c => c.provider.utxos[0][field] = value, ["CORROBORATION"]);
}
reject("spent provider input", c => c.provider.utxos[0].unspent = false, ["INPUT"]);
reject("unknown reference script is not absence", c => { delete c.wallet.utxos[0].referenceScript; correlate(c); }, ["INPUT"]);
reject("all known reference-script funds remain protected", c => { c.wallet.utxos[0].referenceScript = "00"; correlate(c); }, ["INSUFFICIENT_FUNDS"]);
reject("incomplete wallet snapshot", c => c.wallet.complete = false, ["CONTEXT"]);
reject("empty input snapshot", c => correlate(c, []), ["INPUT"]);
reject("input resource cap", c => { c.wallet.utxos = Array(2049).fill(c.wallet.utxos[0]); }, ["INPUT"]);
for (const value of [1, -1n, 45000000000000001n]) reject(`unsafe input coin ${value}`, c => { c.wallet.utxos[0].lovelace = value; correlate(c); }, ["VALUE"]);
for (const value of [1, 0n, -1n, 9223372036854775808n]) reject(`unsafe native quantity ${value}`, c => { c.wallet.utxos[0].assets["55".repeat(28)] = value; correlate(c); }, ["VALUE"]);
reject("native asset unit shape", c => { c.wallet.utxos[0].assets.bad = 1n; correlate(c); }, ["VALUE"]);
reject("asset resource cap before SDK allocation", c => { c.wallet.utxos[0].assets = Object.fromEntries(Array.from({ length: 2049 }, (_, i) => ["55".repeat(28) + i.toString(16).padStart(4, "0"), 1n])); correlate(c); }, ["VALUE"]);
reject("summed native quantity overflow", c => {
  const unit = "55".repeat(28), first = { ...clone(c.wallet.utxos[0]), lovelace: 750000n, assets: { [unit]: 9223372036854775807n } };
  correlate(c, [first, { ...clone(first), txId: "34".repeat(32), assets: { [unit]: 1n } }]);
}, ["VALUE"]);
reject("single change maximum value size is explicit limitation", c => {
  c.wallet.utxos[0].assets = Object.fromEntries(Array.from({ length: 160 }, (_, i) => [i.toString(16).padStart(56, "0") + "ff".repeat(32), 1n])); correlate(c);
}, ["SINGLE_CHANGE"]);
reject("planned signed transaction maximum size", c => { c.parameters.maxTxSize = 399n; c.parameters.maxValueSize = 399n; }, ["SIZE"]);
reject("insufficient ADA cannot donate dust", c => { c.wallet.utxos[0].lovelace = 1000000n; correlate(c); }, ["INSUFFICIENT_FUNDS"]);
reject("registration deposit must be funded separately", c => { c.registration = "unregistered"; c.wallet.utxos[0].lovelace = 3000000n; correlate(c); }, ["INSUFFICIENT_FUNDS"]);
reject("protocol fee cannot raise site ceiling", c => c.parameters.minFeeConstant = 500001n, ["FEE"]);
reject("no caller fee/target/network override object", c => c.fee = 1n, ["CONTEXT"]);
test("synthetic SDK exception is replaced with a fixed redacted error", () => {
  const id = "@evolution-sdk/evolution/Transaction", real = require(id);
  const failing = loader({ [id]: { ...real, toCBORHex: () => { throw Error("SYNTHETIC_CANARY_PAYLOAD"); } } }, new Map())(path.join(source, "builder.ts"));
  assert.throws(() => failing.buildStakeTransaction(context()), e => e.code === "BUILD" && e.message === new builder.BuildError("BUILD").message);
});

let outwardCalls = 0;
const originalFetch = globalThis.fetch, originalCardano = Object.getOwnPropertyDescriptor(globalThis, "cardano");
const tripwire = () => { outwardCalls++; throw Error("OFFLINE_BOUNDARY"); };
globalThis.fetch = tripwire; Object.defineProperty(globalThis, "cardano", { configurable: true, get: tripwire });
const transportRestores = [];
for (const [name, functions] of [["node:http", ["request", "get"]], ["node:https", ["request", "get"]], ["node:net", ["connect", "createConnection"]], ["node:tls", ["connect"]]]) {
  const module = require(name);
  for (const fn of functions) { const original = module[fn]; module[fn] = tripwire; transportRestores.push(() => module[fn] = original); }
}
after(() => {
  globalThis.fetch = originalFetch; if (originalCardano) Object.defineProperty(globalThis, "cardano", originalCardano); else delete globalThis.cardano;
  for (const restore of transportRestores) restore(); assert.equal(outwardCalls, 0, "builder must remain entirely offline");
  moduleHook.deregister();
  const transitiveModules = [...transitivePaths].sort().map(file => ({ file: path.relative(root, file), sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex") }));
  assert(transitiveModules.some(m => m.file.includes("@evolution-sdk/evolution/dist/TransactionBody.js")));
  assert(transitiveModules.some(m => m.file.includes("@noble/hashes/blake2.js")));
  const identity = { node: process.version, production: [...loaded.keys()].map(file => ({ file: path.relative(root, file), sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"), compiledSha256: loaded.get(file).compiledSha256 })),
    sdk: [...sdkModules].map(([id, file]) => ({ id, file: path.relative(root, file), sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex") })), outwardCalls };
  identity.transitiveModulesCount = transitiveModules.length;
  identity.transitiveGraphSha256 = createHash("sha256").update(JSON.stringify(transitiveModules)).digest("hex");
  console.log("ACTUAL_MODULE_IDENTITY " + JSON.stringify(identity));
  const emitIndex = process.argv.indexOf("--emit");
  if (emitIndex >= 0) {
    const dir = path.resolve(process.argv[emitIndex + 1]); fs.mkdirSync(dir, { recursive: true });
    for (const f of emitted) {
      fs.writeFileSync(path.join(dir, f.name + ".json"), JSON.stringify(f, null, 2) + "\n");
      fs.writeFileSync(path.join(dir, f.name + ".cbor"), bytes(f.signedHex));
      fs.writeFileSync(path.join(dir, f.name + ".body.cbor"), bytes(f.bodyHex));
    }
    fs.writeFileSync(path.join(dir, "builder-originals.json"), JSON.stringify({ vectors: emitted }, null, 2) + "\n");
    fs.writeFileSync(path.join(dir, "raw-accounting-cases.json"), JSON.stringify({ cases: rawAccountingCases }, (_, v) => typeof v === "bigint" ? v.toString() : v, 2) + "\n");
    fs.writeFileSync(path.join(dir, "module-identity.json"), JSON.stringify({ ...identity, transitiveModules }, null, 2) + "\n");
  }
});
