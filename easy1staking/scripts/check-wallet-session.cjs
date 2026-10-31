#!/usr/bin/env node
"use strict";
// Runs production ES2017 modules; encoders below generate only synthetic test payloads.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const { createHash } = require("node:crypto"), { test, after } = require("node:test");
const { registerHooks } = require("node:module"), { fileURLToPath } = require("node:url");
const dependencies = new Set();
const hook = registerHooks({ load(url, context, next) {
  const result = next(url, context);
  if (url.startsWith("file:") && fileURLToPath(url).includes(path.sep + "node_modules" + path.sep)) dependencies.add(fileURLToPath(url));
  return result;
} });
const ts = require("typescript"), root = path.resolve(__dirname, ".."), source = path.join(root, "src/lib/site/delegation");
assert.equal(process.version, "v24.22.1");
const fixturePath = path.join(__dirname, "fixtures/wallet-session.json"), fixture = JSON.parse(fs.readFileSync(fixturePath));
let forbiddenCalls = 0;
const forbiddenAction = () => { forbiddenCalls++; throw Error("FORBIDDEN outward action"); };
const restores = [], originalFetch = globalThis.fetch;
globalThis.fetch = forbiddenAction;
for (const [name, methods] of [["node:http", ["request", "get"]], ["node:https", ["request", "get"]], ["node:net", ["connect", "createConnection"]], ["node:tls", ["connect"]]]) {
  const transport = require(name);
  for (const method of methods) { const original = transport[method]; transport[method] = forbiddenAction; restores.push(() => { transport[method] = original; }); }
}
const graph = new Map(), hash = value => createHash("sha256").update(value).digest("hex");
function load(file) {
  if (graph.has(file)) return graph.get(file).exports;
  const original = fs.readFileSync(file, "utf8"), compiled = ts.transpileModule(original, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true }, reportDiagnostics: true });
  assert.equal(compiled.diagnostics.length, 0, "production module must transpile");
  const module = { exports: {}, sourceSha256: hash(original), compiledSha256: hash(compiled.outputText), compiled: compiled.outputText }; graph.set(file, module);
  vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename: file })(id => {
    return id.startsWith(".") ? load(path.resolve(path.dirname(file), id + ".ts")) : require(id);
  }, module, module.exports);
  return module.exports;
}
const codec = load(path.join(source, "wallet-codec.ts")), { createWalletSession } = load(path.join(source, "wallet-session.ts"));
function header(major, n) {
  n = BigInt(n); if (n < 24n) return Buffer.from([major * 32 + Number(n)]);
  for (const width of [1, 2, 4, 8]) if (n < 1n << BigInt(width * 8)) {
    const b = Buffer.alloc(width + 1); b[0] = major * 32 + 24 + Math.log2(width);
    for (let i = width; i; i--) { b[i] = Number(n & 255n); n >>= 8n; } return b;
  }
  throw Error("fixture integer overflow");
}
function encode(value) {
  if (typeof value === "bigint") return value >= 0n ? header(0, value) : header(1, -1n - value);
  if (Buffer.isBuffer(value)) return Buffer.concat([header(2, value.length), value]);
  if (Array.isArray(value)) return Buffer.concat([header(4, value.length), ...value.map(encode)]);
  if (value && value.map) return Buffer.concat([value.indefinite ? Buffer.from([0xbf]) : header(5, value.map.length), ...value.map.flatMap(([k, v]) => [encode(k), encode(v)]), ...(value.indefinite ? [Buffer.from([255])] : [])]);
  if (value && value.raw) return Buffer.from(value.raw, "hex");
  if (value && value.tag !== undefined) return Buffer.concat([header(6, value.tag), encode(value.value)]);
  if (value === null) return Buffer.from([246]);
  throw Error("fixture type");
}
const b = hex => Buffer.from(hex, "hex"), raw = value => encode(value).toString("hex"), map = entries => ({ map: entries });
const address = "01" + fixture.payment + fixture.stake, otherAddress = "01" + fixture.other + fixture.other;
const reward = "e1" + fixture.stake, otherReward = "e1" + fixture.other;
function utxo(output = [b(address), 0n], id = fixture.txId, index = 0n) { return raw([[b(id), index], output]); }
const modern = extra => map([[0n, b(address)], [1n, 0n], ...(extra || [])]);
const sample = utxo(), decode = values => codec.decodeWalletInputs(values), binding = rewards => codec.bindWallet(1, address, rewards);
function bad(name, payload) { test(name, () => assert.throws(() => decode(typeof payload === "function" ? payload() : payload), codec.WalletCodecError, "FORBIDDEN_ACCEPTANCE: " + name)); }
test("legacy and map ADAzero exact immutable Input", () => {
  const a = decode([sample]), c = decode([utxo(modern())]); assert.deepEqual(a, c); assert.equal(a.utxos[0].lovelace, 0n);
  assert(Object.isFrozen(a) && Object.isFrozen(a.utxos) && Object.isFrozen(a.utxos[0]) && Object.isFrozen(a.utxos[0].assets));
});
test("empty array is complete, no-funds observation", () => assert.deepEqual(decode([]), { complete: true, utxos: [] }));
test("exact input-count limit and maximum index are supported", () => {
  assert.equal(decode(Array.from({ length: 2048 }, (_, i) => utxo(undefined, fixture.txId, BigInt(i)))).utxos.length, 2048);
  assert.equal(decode([utxo(undefined, fixture.txId, 65535n)]).utxos[0].index, 65535n);
});
test("uppercase inputs and binding normalize", () => { assert.deepEqual(decode([sample.toUpperCase()]), decode([sample])); assert.equal(codec.bindWallet(1, address.toUpperCase(), [reward.toUpperCase()]).changeAddressHex, address); });
test("indefinite arrays and output map preserve complete snapshot", () => {
  const ref = raw([b(fixture.txId), 0n]);
  const indefinite = "9f" + ref + "bf00" + raw(b(address)) + "0100ffff";
  assert.deepEqual(decode([indefinite]), decode([sample]));
  const legacy = "9f9f" + raw(b(fixture.txId)) + "00ff9f" + raw(b(address)) + "00ffff";
  assert.deepEqual(decode([legacy]), decode([sample]));
});
test("indefinite byte chunks normalize raw address", () => {
  const chunks = "5f" + raw(b(address.slice(0, 50))) + raw(b(address.slice(50))) + "ff";
  assert.deepEqual(decode([utxo([{ raw: chunks }, 0n])]), decode([sample]));
});
test("large token and empty name are exact BigInt", () => {
  const value = [45000000000000000n, map([[b(fixture.policy), map([[Buffer.alloc(0), 9007199254740993n], [b("abcd"), 9223372036854775807n]])]])];
  const i = decode([utxo([b(address), value])]).utxos[0]; assert.equal(i.assets[fixture.policy], 9007199254740993n); assert.equal(i.assets[fixture.policy + "abcd"], 9223372036854775807n);
});
test("different payment and stake input address remains wallet observation", () => assert.equal(decode([utxo([b(otherAddress), 0n])]).utxos[0].addressHex, otherAddress));
test("hash datum legacy and map normalize identically; inline remains distinct", () => {
  const hashDatum = "aa".repeat(32), legacy = decode([utxo([b(address), 0n, b(hashDatum)])]);
  assert.deepEqual(legacy, decode([utxo(modern([[2n, [0n, b(hashDatum)]]]))]));
  assert.equal(legacy.utxos[0].datum, "82005820" + hashDatum);
  const inline = decode([utxo(modern([[2n, [1n, { tag: 24n, value: b("9f1800ff") }]]]))]);
  assert.equal(inline.utxos[0].datum, "8201d818449f1800ff"); assert.notEqual(inline.utxos[0].datum, legacy.utxos[0].datum);
});
test("reference script envelope preserves original enclosed bytes", () => {
  const inner = "9f014100ff", i = decode([utxo(modern([[3n, { tag: 24n, value: b(inner) }]]))]).utxos[0];
  assert.equal(i.referenceScript, "d81845" + inner); assert.notEqual(i.referenceScript, null);
});
test("actual unchanged builder excludes decoded reference-script funding", () => {
  const { buildStakeTransaction, BuildError } = load(path.join(source, "builder.ts"));
  const slot = 201835488n, now = 1596059091000 + Number(slot - 4492800n) * 1000, tip = { slot, hash: "aa".repeat(32), epoch: 664n, observedAt: now };
  const context = inputs => ({ networkId: 1, revision: 1, changeAddressHex: address, stakeKeyHash: fixture.stake, bindingObservedAt: now, registration: "registered", currentPoolHash: null, registrationObservedAt: now,
    constructionTip: { ...tip }, currentTip: { ...tip }, slotConfig: { zeroTime: 1596059091000n, zeroSlot: 4492800n, slotLength: 1000 },
    parameters: { identity: "b1848e36b120c1f2276f0435482d2dfa6e6ac15445faef6612012a054641d57a", epoch: 664n, observedAt: now, minFeeCoefficient: 44n, minFeeConstant: 155381n, stakeDeposit: 2000000n, coinsPerUTxOByte: 4310n, maxTxSize: 16384n, maxValueSize: 5000n },
    wallet: { ...inputs, observedAt: now }, provider: { observedAt: now, utxos: inputs.utxos.map(i => ({ ...i, unspent: true })) }, now });
  const funded = map([[0n, b(address)], [1n, 100000000n]]), reference = map([...funded.map, [3n, { tag: 24n, value: b("82014100") }]]);
  assert(buildStakeTransaction(context(decode([utxo(funded)]))).review);
  assert.throws(() => buildStakeTransaction(context(decode([utxo(reference)]))), e => e instanceof BuildError && e.code === "INSUFFICIENT_FUNDS");
});
test("indefinite token maps and datum bytes chunks", () => {
  const value = [0n, { map: [[b(fixture.policy), { map: [[b(""), 1n]], indefinite: true }]], indefinite: true }];
  assert.equal(decode([utxo([b(address), value])]).utxos[0].assets[fixture.policy], 1n);
  const inner = "5f" + raw(Buffer.alloc(64)) + raw(Buffer.alloc(64)) + "ff";
  assert.equal(decode([utxo(modern([[2n, [1n, { tag: 24n, value: b(inner) }]]]))]).utxos[0].datum, "8201d818" + raw(b(inner)));
});
test("actual pinned SDK output codecs confirm normalized datum and reference representations", () => {
  const Output = require("@evolution-sdk/evolution/TransactionOutput"), Datum = require("@evolution-sdk/evolution/DatumOption"), Script = require("@evolution-sdk/evolution/ScriptRef");
  const output = modern([[2n, [1n, { tag: 24n, value: b("00") }]], [3n, { tag: 24n, value: b("82014100") }]]);
  assert(Output.fromCBORHex(raw(output)));
  const input = decode([utxo(output)]).utxos[0];
  assert(Datum.fromCBORHex(input.datum)); assert(Script.fromCBORHex(input.referenceScript));
});
for (const value of [null, undefined, {}, "", [null], [""], ["0"], ["xx"]]) bad("missing/non-array/invalid raw " + String(value), value);
bad("duplicate outref", [sample, sample]);
bad("duplicate outref across output encodings", [sample, utxo(modern())]);
bad("duplicate oversized snapshot", () => Array(2049).fill(sample));
bad("oversized malformed scalar", () => ["00".repeat(65537)]);
bad("aggregate malformed scalars", () => Array(257).fill("00".repeat(65536)));
bad("deep malformed outer shape", () => ["81".repeat(26) + "00"]);
bad("truncated declared container", ["990801"]);
bad("many-node malformed outer shape", () => ["85" + ("9907ff" + "00".repeat(2047)).repeat(5)]);
function sizedReferenceInput(size, id = fixture.txId) {
  let payload = size;
  const make = () => utxo(modern([[3n, { tag: 24n, value: encode([1n, Buffer.alloc(payload)]) }]]), id);
  let encoded = make();
  // Recompute after crossing a CBOR byte-string header width; assert the actual final size.
  for (let attempt = 0; encoded.length / 2 !== size && attempt < 3; attempt++) { payload -= encoded.length / 2 - size; encoded = make(); }
  assert.equal(encoded.length / 2, size); return encoded;
}
const inlineInput = value => utxo(modern([[2n, [1n, { tag: 24n, value: encode(value) }]]]));
function nestedDatum(depth) { let value = 0n; while (depth--) value = [value]; return value; }
function datumStructure(value) {
  if (!Array.isArray(value)) { assert.equal(value, 0n); return { nodes: 1, depth: 0, largest: 0 }; }
  const children = value.map(datumStructure);
  return { nodes: 1 + children.reduce((n, v) => n + v.nodes, 0), depth: 1 + Math.max(0, ...children.map(v => v.depth)), largest: Math.max(value.length, ...children.map(v => v.largest)) };
}
function resourceInputs(name, parameters) {
  if (name === "count") return Array.from({ length: parameters.count }, (_, i) => utxo(undefined, fixture.txId, BigInt(i)));
  if (name === "bytes") return [sizedReferenceInput(parameters.bytes)];
  if (name === "aggregate") return Array.from({ length: parameters.count }, (_, i) => sizedReferenceInput(parameters.bytes, BigInt(i).toString(16).padStart(64, "0")));
  const value = name === "depth" ? nestedDatum(parameters.arrays) : name === "container" ? Array(parameters.entries).fill(0n) : parameters.groups.map(n => Array(n).fill(0n));
  const structure = datumStructure(value);
  // The inline UTxO envelope has 14 nodes; the enclosed datum starts at depth 3.
  assert.deepEqual({ nodes: 14 + structure.nodes, depth: 3 + structure.depth, largest: structure.largest }, parameters.structure);
  return [inlineInput(value)];
}
for (const scenario of fixture.resourceCases) test(scenario.name, () => {
  const pair = [scenario.supported, scenario.excessive].map(parameters => {
    const inputs = resourceInputs(scenario.kind, parameters);
    assert.equal(inputs.length, parameters.count);
    assert.equal(new Set(inputs).size, inputs.length, "synthetic outrefs must be distinct");
    assert.equal(inputs.reduce((n, v) => n + v.length / 2, 0), parameters.totalBytes);
    assert.equal(Math.max(...inputs.map(v => v.length / 2)), parameters.maximumBytes);
    return inputs;
  });
  const supported = decode(pair[0]); assert.equal(supported.complete, true); assert.equal(supported.utxos.length, pair[0].length);
  assert.equal(new Set(supported.utxos.map(i => i.txId + "#" + i.index)).size, pair[0].length);
  for (const input of supported.utxos) { assert.equal(input.addressHex, address); assert.equal(input.lovelace, 0n); assert.deepEqual(input.assets, {}); }
  assert.throws(() => decode(pair[1]), codec.WalletCodecError, "FORBIDDEN_ACCEPTANCE: " + scenario.name);
});
for (const [name, out] of [
  ["duplicate output key", map([[0n, b(address)], [1n, 0n], [1n, 1n]])], ["unknown output key", modern([[4n, 0n]])],
  ["missing address", map([[1n, 0n]])], ["missing value", map([[0n, b(address)]])], ["empty legacy", []], ["extra legacy field", [b(address), 0n, b("aa".repeat(32)), 0n]],
  ["negative coin", [b(address), -1n]], ["coin overflow", [b(address), 45000000000000001n]],
  ["wrong value shape", [b(address), []]], ["null datum", modern([[2n, null]])], ["null reference", modern([[3n, null]])],
  ["short hash", modern([[2n, [0n, b("00")]]])], ["unknown datum kind", modern([[2n, [2n, b("00")]]])],
  ["inline missing tag", modern([[2n, [1n, b("00")]]])], ["inline unknown inner", modern([[2n, [1n, { tag: 24n, value: b("f6") }]]])],
  ["inline oversized definite bytes", modern([[2n, [1n, { tag: 24n, value: encode(Buffer.alloc(65)) }]]])],
  ["script wrong tag", modern([[3n, { tag: 25n, value: b("82014100") }]])], ["script empty payload", modern([[3n, { tag: 24n, value: b("") }]])],
  ["script malformed payload", modern([[3n, { tag: 24n, value: b("820400") }]])]
]) bad(name, [utxo(out)]);
for (const [name, policy, assetName, amount] of [["policy length", "00", "", 1n], ["name length", fixture.policy, "00".repeat(33), 1n], ["zero token", fixture.policy, "", 0n], ["negative token", fixture.policy, "", -1n], ["token overflow", fixture.policy, "", 9223372036854775808n]]) bad(name, [utxo([b(address), [0n, map([[b(policy), map([[b(assetName), amount]])]])]])]);
bad("empty policy assets", [utxo([b(address), [0n, map([[b(fixture.policy), map([])]])]])]);
bad("duplicate policy", [utxo([b(address), [0n, map([[b(fixture.policy), map([[b(""), 1n]])], [b(fixture.policy), map([[b("aa"), 1n]])]])]])]);
bad("duplicate asset name", [utxo([b(address), [0n, map([[b(fixture.policy), map([[b(""), 1n], [b(""), 1n]])]])]])]);
for (const [name, id, index] of [["txid length", "00", 0n], ["index negative", fixture.txId, -1n], ["index overflow", fixture.txId, 65536n]]) bad(name, [utxo(undefined, id, index)]);
for (const headerByte of ["00", "11", "21", "31", "41", "61", "81", "e1", "f1"]) {
  bad("unsupported input address " + headerByte, [utxo([b(headerByte + address.slice(2)), 0n])]);
  test("unsupported change address " + headerByte, () => assert.throws(() => codec.bindWallet(1, headerByte + address.slice(2), [reward]), codec.WalletCodecError));
}
for (const rewards of [[otherReward], ["f1" + fixture.stake], ["e0" + fixture.stake], ["00"], [reward, "invalid"], null]) test("unsupported rewards " + JSON.stringify(rewards), () => assert.throws(() => binding(rewards), codec.WalletCodecError, "FORBIDDEN_ACCEPTANCE: unmatched reward"));
test("matching reward selected after unrelated entry and deduplicated", () => { const o = binding([otherReward, reward, reward.toUpperCase()]); assert.equal(o.matchingRewardAddress, reward); assert.deepEqual(o.rewardAddresses, [reward, otherReward].sort()); });
test("empty rewards retain A and unresolved registration", () => { const o = binding([]); assert.equal(o.stakeKeyHash, fixture.stake); assert.equal(o.registration, "unresolved"); assert.equal(o.matchingRewardAddress, null); });
test("sparse arrays are malformed rather than complete", () => { assert.throws(() => binding(Array(1)), codec.WalletCodecError); assert.throws(() => decode(Array(1)), codec.WalletCodecError); });
for (const network of [0, undefined, 2, "1"]) test("wrong network " + String(network), () => assert.throws(() => codec.bindWallet(network, address, [reward]), codec.WalletCodecError));

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function wallet(options = {}) {
  const calls = [], counts = {}; let active = 0, maximum = 0;
  const trap = forbiddenAction;
  const api = { signTx: trap, submitTx: trap, signData: trap, cip95: new Proxy({}, { get: trap }) };
  for (const [method, result] of Object.entries({ getNetworkId: 1, getChangeAddress: address, getRewardAddresses: [reward], getUtxos: [sample] })) api[method] = async function(...args) {
    assert.equal(args.length, 0); calls.push(method); const count = counts[method] = (counts[method] || 0) + 1;
    active++; maximum = Math.max(maximum, active);
    try { return await (options[method] ? options[method](count) : result); } finally { active--; }
  };
  return { api, calls, maximum: () => maximum };
}
function setup(wallets, options = {}) {
  const enableCalls = []; let index = 0;
  const provider = { enable: async function(...args) { assert.equal(args.length, 0); enableCalls.push(index); const value = wallets[Math.min(index++, wallets.length - 1)]; return typeof value === "function" ? value() : value.api; } };
  const session = createWalletSession(id => id === "chosen" ? provider : options.otherProvider, options.runtime);
  return { session, enableCalls };
}
test("dormant/disposed session never auto-enables", async () => { const { session, enableCalls } = setup([wallet()]); await session.recheck(); assert.equal(enableCalls.length, 0); session.dispose(); await session.connect("chosen"); assert.equal(enableCalls.length, 0); });
test("explicit chosen provider calls exact read methods and no outward methods", async () => {
  const w = wallet(), { session } = setup([w]); await session.connect("chosen"); assert.equal(session.getState().phase, "observed"); assert(session.hasCurrentHandle());
  assert.deepEqual(w.calls, ["getNetworkId", "getChangeAddress", "getRewardAddresses", "getUtxos", "getNetworkId", "getChangeAddress"]); assert.equal(w.maximum(), 1); session.dispose();
});
test("healthy unchanged fresh handle preserves revision and updates conservative timestamps", async () => {
  let time = 100; const a = wallet(), c = wallet(), { session } = setup([a, c], { runtime: { now: () => time++ } });
  await session.connect("chosen"); const first = session.getState(); await session.recheck(); const second = session.getState();
  assert.equal(first.revision, second.revision); assert.equal(second.handleGeneration, first.handleGeneration + 1); assert(second.acquisitionGeneration > first.acquisitionGeneration);
  assert(second.observation.bindingObservedAt < second.observation.inputsObservedAt); assert(second.observation.inputsObservedAt < second.observation.finalBindingObservedAt); assert(c.calls.length > 0); session.dispose();
});
test("input order and reward order preserve semantic revision", async () => {
  const second = utxo(undefined, "66".repeat(32)), a = wallet({ getUtxos: () => [sample, second], getRewardAddresses: () => [reward, otherReward] }), c = wallet({ getUtxos: () => [second, sample], getRewardAddresses: () => [otherReward, reward, reward] });
  const { session } = setup([a, c]); await session.connect("chosen"); const revision = session.getState().revision; await session.recheck(); assert.equal(session.getState().revision, revision); session.dispose();
});
test("asset entry order is semantic-order independent", async () => {
  const value = names => [0n, map([[b(fixture.policy), map(names)]])];
  const a = utxo([b(address), value([[b("aa"), 1n], [b("bb"), 2n]])]), c = utxo([b(address), value([[b("bb"), 2n], [b("aa"), 1n]])]);
  const { session } = setup([wallet({ getUtxos: () => [a] }), wallet({ getUtxos: () => [c] })]); await session.connect("chosen"); const revision = session.getState().revision; await session.recheck(); assert.equal(session.getState().revision, revision); session.dispose();
});
test("new explicit provider advances revision even for same account", async () => {
  const { session } = setup([wallet()], { otherProvider: { enable: async () => wallet().api } }); await session.connect("chosen"); const revision = session.getState().revision; await session.connect("other"); assert(session.getState().revision > revision); assert.equal(session.getState().walletId, "other"); session.dispose();
});
for (const [name, output] of [["value", [b(address), 1n]], ["payment", [b(otherAddress), 0n]], ["datum", modern([[2n, [0n, b("aa".repeat(32))]]])], ["reference", modern([[3n, { tag: 24n, value: b("82014100") }]])]]) test("semantic input " + name + " invalidates revision", async () => {
  const { session } = setup([wallet(), wallet({ getUtxos: () => [utxo(output)] })]); await session.connect("chosen"); const revision = session.getState().revision; await session.recheck(); assert(session.getState().revision > revision); session.dispose();
});
test("snapshot is defensive and frozen", async () => {
  const rewards = [reward], inputs = [sample], { session } = setup([wallet({ getRewardAddresses: () => rewards, getUtxos: () => inputs })]); await session.connect("chosen"); rewards.length = inputs.length = 0;
  const o = session.getState().observation; assert.equal(o.binding.rewardAddresses.length, 1); assert.equal(o.inputs.utxos.length, 1); assert.throws(() => o.inputs.utxos.push({})); assert.throws(() => { o.inputs.utxos[0].assets.x = 1n; }); session.dispose();
});
for (const [name, options] of [["network bracket", { getNetworkId: count => count === 1 ? 1 : 0 }], ["change bracket", { getChangeAddress: count => count === 1 ? address : otherAddress }], ["no matching rewards", { getRewardAddresses: () => [otherReward] }], ["null inputs", { getUtxos: () => null }], ["malformed inputs", { getUtxos: () => ["x"] }]]) test(name + " clears stale handle", async () => {
  const { session } = setup([wallet(), wallet(options)]); await session.connect("chosen"); await session.recheck(); assert.equal(session.getState().phase, "failed"); assert.equal(session.getState().observation, null); assert.equal(session.hasCurrentHandle(), false); session.dispose();
});
test("denied/revoked enable and raw exception payload redacted", async () => {
  const { session } = setup([wallet(), () => { throw Error("SYNTHETIC_PRIVATE_CANARY"); }]); await session.connect("chosen"); await session.recheck(); assert.equal(session.getState().error, "REFUSED"); assert(!JSON.stringify(session.getState()).includes("CANARY")); assert.equal(session.getState().walletId, "chosen"); assert(!session.hasCurrentHandle()); session.dispose();
});
for (const method of ["getNetworkId", "getChangeAddress", "getRewardAddresses", "getUtxos"]) test("missing required method " + method, async () => { const w = wallet(); delete w.api[method]; const { session } = setup([w]); await session.connect("chosen"); assert.equal(session.getState().error, "UNSUPPORTED"); session.dispose(); });
test("unavailable explicit provider fails closed", async () => { const { session } = setup([wallet()]); await session.connect("missing"); assert.equal(session.getState().error, "UNAVAILABLE"); session.dispose(); });
test("simultaneous refreshes coalesce and serialize", async () => { const w = wallet(), { session, enableCalls } = setup([w]); await session.connect("chosen"); await Promise.all([session.recheck(), session.recheck(), session.recheck()]); assert.equal(enableCalls.length, 2); assert.equal(w.maximum(), 1); session.dispose(); });
const phases = ["enable", "network", "change", "rewards", "utxos", "finalNetwork", "finalChange"];
for (const phase of phases) for (const operation of ["switch", "disconnect"]) test(operation + " during deferred " + phase + " ignores success and rejection", async () => {
  for (const reject of [false, true]) {
    const hold = deferred(), newer = wallet(), methods = { network: ["getNetworkId", 1], change: ["getChangeAddress", 1], rewards: ["getRewardAddresses", 1], utxos: ["getUtxos", 1], finalNetwork: ["getNetworkId", 2], finalChange: ["getChangeAddress", 2] };
    let reached = false; const option = {};
    if (phase !== "enable") { const [method, count] = methods[phase]; option[method] = n => { if (n === count) { reached = true; return hold.promise; } return method === "getNetworkId" ? 1 : method === "getChangeAddress" ? address : method === "getRewardAddresses" ? [reward] : [sample]; }; }
    const old = wallet(option), { session } = setup([phase === "enable" ? () => { reached = true; return hold.promise; } : old], { otherProvider: { enable: async () => newer.api } });
    const pending = session.connect("chosen"); await flush(); assert(reached, phase + " reached");
    if (operation === "switch") await session.connect("newer"); else session.disconnect();
    const current = session.getState(); assert.equal(current.observation === null, operation === "disconnect");
    if (reject) hold.reject(Error("SYNTHETIC_PRIVATE_CANARY")); else hold.resolve(phase === "enable" ? old.api : phase.includes("Network") || phase === "network" ? 1 : phase.includes("Change") || phase === "change" ? address : phase === "rewards" ? [reward] : [sample]);
    await pending; await flush(); assert.equal(session.getState(), current); assert.equal(session.hasCurrentHandle(), operation === "switch"); session.dispose();
  }
});
test("queued refresh invalidates current acquisition before publication", async () => {
  const hold = deferred(), w = wallet({ getUtxos: () => hold.promise }), { session, enableCalls } = setup([w, wallet()]);
  const pending = session.connect("chosen"); await flush(); const refresh = session.recheck(); hold.resolve([utxo([b(address), 9n])]); await Promise.all([pending, refresh]);
  assert.equal(enableCalls.length, 2); assert.equal(session.getState().observation.inputs.utxos[0].lovelace, 0n); assert.equal(session.getState().handleGeneration, 1); session.dispose();
});
for (const outcome of ["success", "rejection"]) test("timeout clears state and ignores late " + outcome, async () => {
  const hold = deferred(), { session } = setup([() => hold.promise, wallet()], { runtime: { stepTimeoutMs: 5 } }); await session.connect("chosen"); assert.equal(session.getState().error, "TIMEOUT"); assert(!session.hasCurrentHandle()); await session.recheck(); const current = session.getState();
  if (outcome === "success") hold.resolve(wallet().api); else hold.reject(Error("PRIVATE")); await flush(); assert.equal(session.getState(), current); session.dispose();
});
for (const phase of phases.slice(1)) test("per-step timeout at " + phase + " redacts late read", async () => {
  const methods = { network: ["getNetworkId", 1], change: ["getChangeAddress", 1], rewards: ["getRewardAddresses", 1], utxos: ["getUtxos", 1], finalNetwork: ["getNetworkId", 2], finalChange: ["getChangeAddress", 2] };
  const hold = deferred(), [method, count] = methods[phase], options = {};
  options[method] = n => n === count ? hold.promise : method === "getNetworkId" ? 1 : address;
  const { session } = setup([wallet(options)], { runtime: { stepTimeoutMs: 5 } }); await session.connect("chosen"); const failed = session.getState();
  assert.equal(failed.error, "TIMEOUT"); assert(!session.hasCurrentHandle()); hold.reject(Error("SYNTHETIC_PRIVATE_CANARY")); await flush(); assert.equal(session.getState(), failed); session.dispose();
});
test("final publication obsolete generation independently blocks stale handle", async () => {
  const hold = deferred(); let finalReached = false;
  const old = wallet({ getChangeAddress: count => { if (count === 2) { finalReached = true; return hold.promise; } return address; } });
  const { session } = setup([old]); const pending = session.connect("chosen"); await flush(); assert(finalReached);
  // The final step resolves before disconnect, but its awaiting acquisition resumes afterward.
  hold.resolve(address); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  session.disconnect(); await pending;
  assert.equal(session.getState().phase, "disconnected", "FORBIDDEN_ACCEPTANCE: obsolete publication"); assert.equal(session.hasCurrentHandle(), false); assert.equal(session.getState().observation, null);
});
after(() => {
  globalThis.fetch = originalFetch; for (const restore of restores) restore(); assert.equal(forbiddenCalls, 0, "zero sign/submit/data/CIP95/HTTP calls");
  const identity = { node: process.version, fixture: { path: fixturePath, sha256: hash(fs.readFileSync(fixturePath)) }, lockSha256: hash(fs.readFileSync(path.join(root, "package-lock.json"))),
    modules: [...graph].map(([file, m]) => ({ path: file, sourceSha256: m.sourceSha256, compiledSha256: m.compiledSha256 })),
    forbiddenCalls, dependencies: [...dependencies].sort().map(file => ({ path: file, sha256: hash(fs.readFileSync(file)) })) };
  if (process.env.WALLET_SESSION_EVIDENCE_DIR) {
    fs.writeFileSync(path.join(process.env.WALLET_SESSION_EVIDENCE_DIR, "identity.json"), JSON.stringify(identity, null, 2));
    fs.writeFileSync(path.join(process.env.WALLET_SESSION_EVIDENCE_DIR, "compiled.json"), JSON.stringify([...graph].map(([file, m]) => ({ file, compiled: m.compiled }))));
  }
  console.log("Production graph:", JSON.stringify(identity.modules)); console.log("Dependency files:", identity.dependencies.length); hook.deregister();
});
