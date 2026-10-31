#!/usr/bin/env node
"use strict";
// Actual production ES2017 graph and genuine public, valueless Ed25519 fixture witnesses.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const { createHash, createPrivateKey, createPublicKey, sign } = require("node:crypto");
const { registerHooks } = require("node:module"), { fileURLToPath } = require("node:url");
assert.equal(process.version, "v24.22.1");
const dependencies = new Set(), hook = registerHooks({ load(url, context, next) {
  const result = next(url, context);
  if (url.startsWith("file:") && fileURLToPath(url).includes(path.sep + "node_modules" + path.sep)) dependencies.add(fileURLToPath(url));
  return result;
} });
const ts = require("typescript"), root = path.resolve(__dirname, ".."), source = path.join(root, "src/lib/site/delegation");
const fixturePath = path.join(__dirname, "fixtures/wallet-signature.json"), fixture = JSON.parse(fs.readFileSync(fixturePath));
const vectorPath = path.join(__dirname, "fixtures/stake-builder.json"), vectors = JSON.parse(fs.readFileSync(vectorPath)).vectors;
const graph = new Map(), hash = value => createHash("sha256").update(value).digest("hex");
function load(file) {
  if (graph.has(file)) return graph.get(file).exports;
  const original = fs.readFileSync(file, "utf8"), compiled = ts.transpileModule(original, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true }, reportDiagnostics: true });
  assert.equal(compiled.diagnostics.length, 0);
  const module = { exports: {}, sourceSha256: hash(original), compiledSha256: hash(compiled.outputText), compiled: compiled.outputText }; graph.set(file, module);
  vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename: file })(id => id.startsWith(".") ? load(path.resolve(path.dirname(file), id + ".ts")) : require(id), module, module.exports);
  return module.exports;
}
let forbiddenCalls = 0;
function forbidden() { forbiddenCalls++; throw Error("FORBIDDEN outward action"); }
const transportRestores = [], originalFetch = globalThis.fetch;
if (!process.argv.includes("--browser")) {
  globalThis.fetch = forbidden;
  for (const [name, methods] of [["node:http", ["get", "request"]], ["node:https", ["get", "request"]], ["node:net", ["connect", "createConnection"]], ["node:tls", ["connect"]]]) {
    const transport = require(name); for (const method of methods) { const original = transport[method]; transport[method] = forbidden; transportRestores.push(() => { transport[method] = original; }); }
  }
}
const sessionModule = load(path.join(source, "wallet-session.ts")), { createWalletSession, WalletSignatureError } = sessionModule;
const guard = load(path.join(source, "guard.ts")), crypto = load(path.join(source, "crypto.ts")), cbor = load(path.join(source, "cbor.ts"));
const builder = load(path.join(source, "builder.ts")), codec = load(path.join(source, "wallet-codec.ts"));
const b = value => Buffer.from(value, "hex"), clone = structuredClone;
function header(major, n) {
  n = BigInt(n); if (n < 24n) return Buffer.from([major * 32 + Number(n)]);
  for (const width of [1, 2, 4, 8]) if (n < 1n << BigInt(width * 8)) {
    const out = Buffer.alloc(width + 1); out[0] = major * 32 + 24 + Math.log2(width);
    for (let i = width; i; i--) { out[i] = Number(n & 255n); n >>= 8n; } return out;
  }
  throw Error("fixture integer overflow");
}
function encode(v) {
  if (typeof v === "bigint") return header(0, v);
  if (Buffer.isBuffer(v)) return Buffer.concat([header(2, v.length), v]);
  if (Array.isArray(v)) return Buffer.concat([header(4, v.length), ...v.map(encode)]);
  if (v instanceof Map) return Buffer.concat([header(5, v.size), ...[...v].flatMap(([k, x]) => [encode(k), encode(x)])]);
  if (v && v.raw) return b(v.raw);
  if (v === null) return Buffer.from([246]);
  throw Error("fixture value");
}
const raw = v => encode(v).toString("hex");
function rawInput(i) {
  const value = Object.keys(i.assets).length ? [i.lovelace, new Map(Object.entries(i.assets).map(([unit, quantity]) => [unit.slice(0, 56), [unit.slice(56), quantity]]).reduce((entries, [policy, asset]) => {
    let entry = entries.find(([key]) => key.toString("hex") === policy); if (!entry) entries.push(entry = [b(policy), new Map()]); entry[1].set(b(asset[0]), asset[1]); return entries;
  }, []))] : i.lovelace;
  const output = new Map([[0n, b(i.addressHex)], [1n, value]]);
  if (i.datum !== null) output.set(2n, { raw: i.datum });
  if (i.referenceScript !== null) output.set(3n, { raw: i.referenceScript });
  return raw([[b(i.txId), i.index], output]);
}
function context(f = vectors[0], live = false) {
  const slot = live ? 4492800n + BigInt(Math.floor((Date.now() - 1596059091000) / 1000)) : BigInt(f.constructionSlot);
  const now = 1596059091000 + Number(slot - 4492800n) * 1000, epoch = 208n + (slot - 4492800n) / 432000n;
  const tip = { slot, epoch, hash: "aa".repeat(32), observedAt: now };
  const input = { txId: f.inputId, index: 0n, addressHex: f.addressHex, lovelace: BigInt(f.funding), assets: {}, datum: null, referenceScript: null };
  return { networkId: 1, revision: 1, changeAddressHex: f.addressHex, stakeKeyHash: f.stakeKeyHash, bindingObservedAt: now,
    registration: f.registered ? "registered" : "unregistered", currentPoolHash: null, registrationObservedAt: now,
    constructionTip: { ...tip }, currentTip: { ...tip }, slotConfig: { zeroTime: 1596059091000n, zeroSlot: 4492800n, slotLength: 1000 },
    parameters: { identity: "b1848e36b120c1f2276f0435482d2dfa6e6ac15445faef6612012a054641d57a", epoch, observedAt: now,
      minFeeCoefficient: 44n, minFeeConstant: 155381n, stakeDeposit: 2000000n, coinsPerUTxOByte: 4310n, maxTxSize: 16384n, maxValueSize: 5000n },
    wallet: { complete: true, observedAt: now, utxos: [input] }, provider: { observedAt: now, utxos: [{ ...clone(input), unspent: true }] }, now };
}
function key(seed) {
  const privateKey = createPrivateKey({ key: Buffer.concat([b("302e020100300506032b657004220420"), b(seed)]), format: "der", type: "pkcs8" });
  return { privateKey, publicKey: createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32) };
}
const keys = [key(fixture.paymentSeed), key(fixture.stakeSeed)];
const witnesses = (review, selected = keys) => raw(new Map([[0n, selected.map(k => [k.publicKey, sign(null, b(review.txId), k.privateKey)])]]));
const deferred = () => { let resolve, reject; const promise = new Promise((a, z) => { resolve = a; reject = z; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const owners = [];
function setup(c = context(), runtime = {}) {
  const calls = [], handles = []; let changes = {}, enableAction, signAction = () => "a0";
  const provider = { async enable(...args) {
    assert.equal(args.length, 0); if (enableAction) await enableAction();
    const id = handles.length + 1, api = { id, async getNetworkId(...a) { assert.equal(a.length, 0); return changes.network ?? 1; },
      async getChangeAddress(...a) { assert.equal(a.length, 0); return changes.address ?? c.changeAddressHex; },
      async getRewardAddresses(...a) { assert.equal(a.length, 0); return changes.rewards ?? ["e1" + c.stakeKeyHash]; },
      async getUtxos(...a) { assert.equal(a.length, 0); return (changes.inputs ?? c.wallet.utxos).map(rawInput); },
      signTx(...a) { calls.push({ receiver: this.id, handle: id, args: a }); return signAction(...a); }, submitTx: forbidden, signData: forbidden };
    Object.defineProperty(api, "cip95", { get: forbidden });
    if (changes.signProperty) Object.defineProperty(api, "signTx", changes.signProperty);
    handles.push(api); return api;
  } };
  const owner = createWalletSession(id => { assert.equal(id, "chosen"); return provider; }, { now: () => c.now, ...runtime }); owners.push(owner);
  return { owner, c, calls, handles, changes: value => { changes = value; }, signer: value => { signAction = value; }, enable: value => { enableAction = value; } };
}
async function ready(c = context(), runtime) { const s = setup(c, runtime); await s.owner.connect("chosen"); assert.equal(s.owner.getState().phase, "observed"); return s; }
function issued(s) { return builder.buildStakeTransaction(s.c); }
function safeError(error, code) {
  assert(error instanceof WalletSignatureError, "FORBIDDEN_ACCEPTANCE: unredacted error " + String(error)); if (code) assert.equal(error.code, code);
  assert.equal(Object.isFrozen(error), true); assert.equal(error.name, "WalletSignatureError");
  assert.equal("cause" in error, false); assert.doesNotMatch(error.message, /SECRET/); return true;
}
async function refused(s, review, c = s.c, code, options) {
  let value, error; try { value = await s.owner.requestSignature(review, c, options); } catch (e) { error = e; }
  assert(error, "FORBIDDEN_ACCEPTANCE: witness publication " + JSON.stringify(value)); safeError(error, code); return error;
}
async function preRefused(name, change, code = "CHANGED") {
  const s = await ready(), result = issued(s); change(s, result);
  await refused(s, result.review, s.c, code); assert.equal(s.calls.length, 0, "FORBIDDEN_ACCEPTANCE: sign call " + name);
}
function identity() {
  return { node: process.version, execPath: process.execPath, runner: hash(fs.readFileSync(__filename)), fixture: hash(fs.readFileSync(fixturePath)),
    vectors: hash(fs.readFileSync(vectorPath)), lock: hash(fs.readFileSync(path.join(root, "package-lock.json"))),
    modules: [...graph].map(([file, m]) => ({ file: path.relative(root, file), sourceSha256: m.sourceSha256, compiledSha256: m.compiledSha256 })),
    dependencies: [...dependencies].sort().map(file => ({ file: path.relative(root, file), sha256: hash(fs.readFileSync(file)) })), forbiddenCalls };
}
function writeEvidence(name, value) {
  if (process.env.WALLET_SIGNATURE_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.WALLET_SIGNATURE_EVIDENCE_DIR, name), JSON.stringify(value, null, 2));
}
function nodeTests() {
  const { test, after } = require("node:test");
  after(() => { for (const o of owners) o.dispose(); assert.equal(forbiddenCalls, 0); globalThis.fetch = originalFetch; transportRestores.forEach(f => f());
    writeEvidence("signature-identity.json", identity()); writeEvidence("signature-compiled.json", [...graph].map(([file, m]) => ({ file, compiled: m.compiled })));
    console.log("SIGNATURE_IDENTITY", JSON.stringify({ modules: identity().modules, dependencyFiles: dependencies.size, forbiddenCalls })); hook.deregister(); });
  test("outward instrument responds for each forbidden member", async () => {
    const before = forbiddenCalls, s = await ready(), api = s.handles[0];
    const methods = [globalThis.fetch, require("node:http").get, require("node:http").request, require("node:https").get, require("node:https").request,
      require("node:net").connect, require("node:net").createConnection, require("node:tls").connect, api.submitTx, api.signData, () => api.cip95];
    for (const fn of methods) assert.throws(fn, /FORBIDDEN/);
    assert.equal(forbiddenCalls - before, 11); forbiddenCalls = before;
  });
  test("dormant import/connect/recheck never signs; state shape stays unchanged", async () => {
    const s = setup(); assert.equal(s.handles.length, 0); await s.owner.recheck(); assert.equal(s.handles.length, 0);
    await s.owner.connect("chosen"); await s.owner.recheck(); assert.equal(s.calls.length, 0);
    assert.deepEqual(Object.keys(s.owner.getState()).sort(), ["phase", "walletId", "revision", "acquisitionGeneration", "handleGeneration", "observation", "error"].sort());
  });
  for (const f of vectors) test("actual builder wrapper/literal and real guard witnesses " + f.name, async () => {
    const s = await ready(context(f)), result = issued(s); assert.equal(result.unsignedHex, f.unsignedHex); assert.equal(result.review.txId, f.txId);
    s.signer(() => witnesses(result.review).toUpperCase()); const answer = await s.owner.requestSignature(result.review, s.c);
    assert(Object.isFrozen(answer)); assert.deepEqual(answer, { witnessHex: witnesses(result.review), revision: 1, handleGeneration: 2 });
    assert.equal(s.handles.length, 3); assert.deepEqual(s.calls, [{ receiver: 2, handle: 2, args: [f.unsignedHex, false] }], "FORBIDDEN_ACCEPTANCE: cached handle or wrong wrapper");
    const accepted = await guard.assembleSignedTransaction(answer.witnessHex, result.review, s.c); assert.equal((await guard.verifySignedTransaction(accepted.signedHex, result.review, s.c)).txId, f.txId);
  });
  test("read-only wallet remains connectable but explicit signing refuses", () => preRefused("missing sign", s => s.changes({ signProperty: { value: undefined } }), "UNSUPPORTED"));
  test("cloned issued review refuses before call", async () => { const s = await ready(), result = issued(s); await refused(s, { ...result.review }, s.c, "REVIEW"); assert.equal(s.calls.length, 0, "FORBIDDEN_ACCEPTANCE: cloned review signed"); });
  for (const [name, mutate] of [
    ["revision", c => c.revision++], ["payment address", c => c.changeAddressHex = "01" + "bb".repeat(28) + c.stakeKeyHash],
    ["stake", c => c.stakeKeyHash = "bb".repeat(28)], ["network", c => c.networkId = 0], ["complete", c => c.wallet.complete = false],
    ["outref", c => c.wallet.utxos[0].txId = "bb".repeat(32)], ["index", c => c.wallet.utxos[0].index++],
    ["input address", c => c.wallet.utxos[0].addressHex = "01" + "bb".repeat(56)], ["coin", c => c.wallet.utxos[0].lovelace++],
    ["BigInt asset", c => c.wallet.utxos[0].assets["aa".repeat(28)] = 9007199254740993n],
    ["datum", c => c.wallet.utxos[0].datum = "82005820" + "bb".repeat(32)], ["script", c => c.wallet.utxos[0].referenceScript = "d8184482014100"]
  ]) test("complete supplied context mismatch " + name, async () => {
    const s = await ready(), result = issued(s), c = clone(s.c); mutate(c);
    await refused(s, result.review, c, "CHANGED"); assert.equal(s.calls.length, 0, "FORBIDDEN_ACCEPTANCE: context " + name);
  });
  for (const [name, change] of [
    ["payment", s => s.changes({ address: "01" + "bb".repeat(28) + s.c.stakeKeyHash })],
    ["reward semantics", s => s.changes({ rewards: ["e1" + s.c.stakeKeyHash, "e1" + "bb".repeat(28)] })],
    ["unsupported network", s => s.changes({ network: 0 })],
    ["complete wallet input", s => { const inputs = clone(s.c.wallet.utxos); inputs[0].lovelace++; s.changes({ inputs }); }]
  ]) test("fresh acquisition differs " + name, () => preRefused(name, change));
  test("guard checks real current clock rather than stale context.now", async () => {
    const c = context(), s = await ready(c, { now: () => c.now + 30001 }), result = issued(s); await refused(s, result.review, c, "REVIEW"); assert.equal(s.calls.length, 0);
  });
  for (const [remaining, accepts] of [[180, true], [179, false]]) test("independent remaining slots " + remaining, async () => {
    const s = await ready(), result = issued(s), elapsed = BigInt(600 - remaining); s.c.currentTip.slot += elapsed; s.c.now += Number(elapsed) * 1000;
    for (const value of [s.c.currentTip, s.c.parameters, s.c.wallet, s.c.provider]) value.observedAt = s.c.now;
    s.c.bindingObservedAt = s.c.registrationObservedAt = s.c.now;
    if (accepts) { const answer = await s.owner.requestSignature(result.review, s.c); assert.equal(answer.witnessHex, "a0"); assert.equal(s.calls.length, 1); }
    else { await refused(s, result.review, s.c, "REVIEW"); assert.equal(s.calls.length, 0, "FORBIDDEN_ACCEPTANCE: 179-slot sign"); }
  });
  test("one same-owner signature request and post-approval fresh generation", async () => {
    const s = await ready(), result = issued(s), approval = deferred(); s.signer(() => approval.promise);
    const request = s.owner.requestSignature(result.review, s.c); await flush(); assert.equal(s.calls.length, 1);
    await refused(s, result.review, s.c, "BUSY"); await s.owner.recheck(); approval.resolve("a0"); const answer = await request;
    assert.equal(answer.handleGeneration, 2); assert.equal(s.owner.getState().handleGeneration, 4); assert.equal(answer.revision, s.owner.getState().revision);
  });
  test("approval reply during unchanged acquiring refresh waits for fresh binding", async () => {
    const s = await ready(), result = issued(s), approval = deferred(); s.signer(() => approval.promise);
    const pending = s.owner.requestSignature(result.review, s.c); await flush(); assert.equal(s.calls.length, 1);
    s.enable(() => sleep(5)); const refresh = s.owner.recheck(); approval.resolve("a0");
    assert.equal((await pending).witnessHex, "a0"); await refresh; assert.equal(s.owner.getState().revision, 1);
  });
  for (const operation of ["disconnect", "dispose", "reconnect", "abort"]) test("cancel/late result reservation " + operation, async () => {
    const s = await ready(), result = issued(s), approval = deferred(), ac = new AbortController(); s.signer(() => approval.promise);
    const request = s.owner.requestSignature(result.review, s.c, { signal: ac.signal }); const caught = request.catch(e => e); await flush(); assert.equal(s.calls.length, 1);
    if (operation === "abort") ac.abort(); else if (operation === "reconnect") await s.owner.connect("chosen"); else s.owner[operation]();
    safeError(await caught, operation === "abort" ? "ABORTED" : "CHANGED");
    await refused(s, result.review, s.c, "BUSY"); approval.resolve("a0"); await flush();
    if (operation === "abort") { s.signer(() => "a0"); assert.equal((await s.owner.requestSignature(result.review, s.c)).witnessHex, "a0"); }
    else await refused(s, result.review, s.c, "CHANGED");
  });
  test("pre-call abort releases immediately and no sign occurs", async () => { const s = await ready(), result = issued(s), ac = new AbortController(); ac.abort(); await refused(s, result.review, s.c, "ABORTED", { signal: ac.signal }); assert.equal(s.calls.length, 0); assert.equal((await s.owner.requestSignature(result.review, s.c)).witnessHex, "a0"); });
  test("native finite deadline suppresses delayed healthy response; reservation eventually releases", async () => {
    const s = await ready(context(), { signatureTimeoutMs: fixture.shortDeadlineMs }), result = issued(s); let settled = false;
    s.signer(async () => { await sleep(fixture.delayedReplyMs); settled = true; return "a0"; });
    await refused(s, result.review, s.c, "TIMEOUT"); assert.equal(settled, false); assert.equal(s.calls.length, 1);
    await refused(s, result.review, s.c, "BUSY"); await sleep(fixture.delayedReplyMs); assert.equal(settled, true);
    s.signer(() => "a0"); assert.equal((await s.owner.requestSignature(result.review, s.c)).witnessHex, "a0");
  });
  test("abort delayed healthy response never publishes witnesses", async () => {
    const s = await ready(), result = issued(s), ac = new AbortController();
    s.signer(async () => { await sleep(40); return "a0"; });
    const request = s.owner.requestSignature(result.review, s.c, { signal: ac.signal }); const caught = request.catch(e => e); await flush(); assert.equal(s.calls.length, 1); ac.abort();
    const error = await caught; assert(error instanceof WalletSignatureError, "FORBIDDEN_ACCEPTANCE: cancelled witnesses published " + JSON.stringify(error)); safeError(error, "ABORTED"); await sleep(50);
  });
  test("default timer exactly reviewed expiry; runtime cannot extend window", async () => {
    const delays = [], timers = new Set(), c = context(), s = await ready(c, {
      setTimeout(fn, ms) { delays.push(ms); const id = setTimeout(fn, ms); timers.add(id); return id; }, clearTimeout(id) { timers.delete(id); clearTimeout(id); } });
    const result = issued(s); await s.owner.requestSignature(result.review, c);
    assert(delays.includes(Number(c.slotConfig.zeroTime + (result.review.invalidHereafter - c.slotConfig.zeroSlot) * 1000n) - c.now)); assert.equal(timers.size, 0);
  });
  for (const value of [0, -1, 600001, 1.5, NaN]) test("unsupported signature timeout " + value, () => assert.throws(() => setup(context(), { signatureTimeoutMs: value }), e => safeError(e, "UNSUPPORTED")));
  for (const [name, change] of [["account", s => s.changes({ address: "01" + "bb".repeat(28) + s.c.stakeKeyHash })], ["input", s => { const inputs = clone(s.c.wallet.utxos); inputs[0].lovelace++; s.changes({ inputs }); }], ["rewards", s => s.changes({ rewards: [] })]]) test("fresh post-approval binding " + name, async () => {
    const s = await ready(), result = issued(s); s.signer(() => { change(s); return "a0"; }); await refused(s, result.review, s.c, "CHANGED"); assert.equal(s.calls.length, 1); assert.equal(s.handles.length, 3);
  });
  test("post-approval enable is actual fresh operation", async () => {
    const s = await ready(), result = issued(s); s.signer(() => { s.enable(() => { throw Error("SECRET post-enable"); }); return "a0"; });
    await refused(s, result.review, s.c, "CHANGED"); assert.equal(s.calls.length, 1);
  });
  for (const response of [null, {}, "0", "gg", "00".repeat(65537)]) test("bounded malformed witness " + (typeof response === "string" ? response.length : String(response)), async () => {
    const s = await ready(), result = issued(s); s.signer(() => response); await refused(s, result.review, s.c, "WITNESS"); assert.equal(s.calls.length, 1);
  });
  test("reviewed absolute expiry suppresses a settled response", async () => {
    const s = await ready(), result = issued(s); s.signer(() => { s.c.now = Number(s.c.slotConfig.zeroTime + (result.review.invalidHereafter - s.c.slotConfig.zeroSlot) * 1000n); return "a0"; });
    await refused(s, result.review, s.c, "TIMEOUT"); assert.equal(s.calls.length, 1);
  });
  test("BigInt native assets in complete snapshot remain exact and signable", async () => {
    const c = context(); c.wallet.utxos[0].assets["ab".repeat(28)] = 9007199254740993n; c.provider.utxos = c.wallet.utxos.map(i => ({ ...clone(i), unspent: true }));
    const s = await ready(c), result = issued(s); s.signer(() => witnesses(result.review));
    const answer = await s.owner.requestSignature(result.review, c); assert.equal(s.calls.length, 1); assert.equal((await guard.assembleSignedTransaction(answer.witnessHex, result.review, c)).txId, result.review.txId);
  });
  test("maximum witness hex remains untrusted; actual later guard refuses", async () => { const s = await ready(), result = issued(s); s.signer(() => "00".repeat(65536)); const answer = await s.owner.requestSignature(result.review, s.c); assert.equal(answer.witnessHex.length, 131072); await assert.rejects(guard.assembleSignedTransaction(answer.witnessHex, result.review, s.c)); });
  for (const [name, make] of [["empty", () => ""], ["partial", r => witnesses(r, keys.slice(0, 1))], ["foreign", r => witnesses(r, [...keys, key("44".repeat(32))])], ["invalid", r => witnesses(r).replace(/.$/, "f")]]) test("handoff untrusted; actual witness guard rejects " + name, async () => {
    const s = await ready(), result = issued(s); s.signer(() => make(result.review)); const answer = await s.owner.requestSignature(result.review, s.c); await assert.rejects(guard.assembleSignedTransaction(answer.witnessHex, result.review, s.c));
  });
  test("settled wallet decline is redacted and permits explicit retry", async () => { const s = await ready(), result = issued(s); s.signer(() => { throw { code: 2, info: "SECRET" }; }); await refused(s, result.review, s.c, "DECLINED"); s.signer(() => "a0"); assert.equal((await s.owner.requestSignature(result.review, s.c)).witnessHex, "a0"); });
  for (const [name, error] of [["raw", Error("SECRET native")], ["throwing code", Object.defineProperty({}, "code", { get() { throw Error("SECRET accessor"); } })], ["foreign same-class", Object.create(WalletSignatureError.prototype, { code: { value: "DECLINED" }, message: { value: "SECRET forged" } })]]) test("wallet error redaction " + name, async () => {
    const s = await ready(), result = issued(s); s.signer(() => Promise.reject(error)); await refused(s, result.review, s.c, "REFUSED");
  });
  test("sign property getter failures stay redacted", () => preRefused("sign accessor", s => s.changes({ signProperty: { get() { throw Error("SECRET getter"); } } }), "REFUSED"));
  test("hostile signature-property prototype trap stays redacted", () => preRefused("prototype trap", s => s.changes({ signProperty: { get() { throw new Proxy({}, { getPrototypeOf() { throw Error("SECRET prototype"); } }); } } }), "REFUSED"));
  test("elapsed short deadline refuses even before timer callback can run", async () => {
    const c = context(), start = performance.now(), s = await ready(c, { signatureTimeoutMs: 10, now: () => c.now + Math.floor(performance.now() - start) }), result = issued(s);
    s.signer(() => { const until = performance.now() + 25; while (performance.now() < until) { /* Delay only this synthetic RPC. */ } return "a0"; });
    await refused(s, result.review, c, "TIMEOUT"); assert.equal(s.calls.length, 1);
  });
  for (const decorated of [false, true]) test("captured callable invocation " + (decorated ? "decorated" : "ordinary"), async () => {
    const s = await ready(), result = issued(s), entries = []; let getterReads = 0;
    function signer(...args) {
      const state = s.owner.getState(); entries.push({ phase: state.phase, revision: state.revision, receiver: this.id, args }); return "a0";
    }
    if (decorated) for (const member of ["call", "apply", "bind"]) Object.defineProperty(signer, member, { get() {
      getterReads++; s.owner.disconnect(); return Function.prototype[member];
    } });
    s.changes({ signProperty: { value: signer } });
    let answer, error; try { answer = await s.owner.requestSignature(result.review, s.c); } catch (e) { error = e; }
    assert.equal(entries.filter(entry => entry.phase !== "observed" || entry.revision !== s.c.revision).length, 0,
      "FORBIDDEN_SIGN_AFTER_OBSERVED_DISCONNECT " + JSON.stringify(entries));
    assert.equal(getterReads, 0, "captured callable properties must not be read"); assert.equal(error, undefined);
    assert.deepEqual(entries, [{ phase: "observed", revision: 1, receiver: 2, args: [result.unsignedHex, false] }]);
    assert.equal(answer.witnessHex, "a0"); assert.equal(answer.handleGeneration, 2);
  });
  test("sign getter disconnect cannot call old handle", () => preRefused("sign getter disconnect", s => s.changes({ signProperty: { get() { s.owner.disconnect(); return () => { s.calls.push({ forbidden: true }); return "a0"; }; } } })));
  for (const kind of ["clock", "schedule", "cancel"]) test("new runtime callback failure redacted " + kind, async () => {
    let broken = false; const c = context(), s = await ready(c, { now() { if (broken && kind === "clock") throw Error("SECRET clock"); return c.now; },
      setTimeout(fn, ms) { if (broken && kind === "schedule" && ms > 10000) throw Error("SECRET timer"); return setTimeout(fn, ms); },
      clearTimeout(id) { clearTimeout(id); if (broken && kind === "cancel") throw Error("SECRET cancel"); } });
    const result = issued(s); if (kind === "cancel") s.signer(() => { broken = true; return "a0"; }); else broken = true;
    await refused(s, result.review, c);
  });
}
if (process.argv.includes("--browser")) browserMain().catch(error => { console.error(error); process.exitCode = 1; }); else nodeTests();

async function browserMain() {
  const http = require("node:http"), net = require("node:net");
  const { chromium } = require("/tmp/easy1-homepage-browser-tools/node_modules/playwright");
  const executablePath = "/home/giovanni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
  const served = new Map(), received = [], responseWork = [], consoleErrors = [];
  function asset(route, content, type = "text/javascript") { served.set(route, { content: Buffer.from(content), type }); }
  const browserModules = [...graph].filter(([file]) => path.basename(file) !== "builder.ts");
  for (const [file, m] of browserModules) asset("/production/" + path.basename(file, ".ts") + ".js", `globalThis.factories[${JSON.stringify("./" + path.basename(file, ".ts"))}]=function(require,module,exports){${m.compiled}\n};`);
  const nobleDir = path.join(root, "node_modules/@noble/hashes");
  for (const file of ["blake2.js", "_blake.js", "_md.js", "_u64.js", "utils.js"]) asset("/noble/" + file, fs.readFileSync(path.join(nobleDir, file)));
  asset("/", "<!doctype html><html><head><link rel=icon href=data:,></head><body>Private offline signature harness<script>globalThis.factories={};</script><script type=module>import * as noble from '/noble/blake2.js'; globalThis.noble=noble; for (const name of " + JSON.stringify(browserModules.map(([file]) => path.basename(file, ".ts"))) + ") await import('/production/'+name+'.js'); globalThis.moduleReady=true;</script></body></html>", "text/html");
  const server = http.createServer((req, res) => {
    const file = served.get(req.url); if (!file) { res.writeHead(404); res.end(); return; }
    assert.equal(req.method, "GET"); res.writeHead(200, { "Content-Type": file.type, "Cache-Control": "no-store" }); res.end(file.content);
  });
  let browser, browserContext, browserSession, port, childPid, browserVersion, result, child, exited, profile, debugPort, chromeExit;
  const { spawn } = require("node:child_process");
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); }); port = server.address().port;
    profile = fs.mkdtempSync(path.join(process.env.WALLET_SIGNATURE_EVIDENCE_DIR || require("node:os").tmpdir(), "signature-profile-"));
    child = spawn(executablePath, ["--headless=new", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-extensions", "--disable-sync", "--metrics-recording-only", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"], { stdio: ["ignore", "ignore", "ignore"] });
    childPid = child.pid;
    exited = new Promise(resolve => child.once("exit", (code, signal) => resolve({ code, signal })));
    const activePort = path.join(profile, "DevToolsActivePort");
    for (let i = 0; i < 200 && !fs.existsSync(activePort); i++) { assert.equal(child.exitCode, null); await sleep(25); }
    assert(fs.existsSync(activePort), "owned Chrome must publish its loopback debugging port");
    debugPort = Number(fs.readFileSync(activePort, "utf8").split("\n")[0]);
    // Pinned Playwright1.64.1 noDefaults applies only to the existing default context.
    browser = await chromium.connectOverCDP("http://127.0.0.1:" + debugPort, { noDefaults: true }); browserVersion = browser.version();
    browserSession = await browser.newBrowserCDPSession();
    browserContext = browser.contexts()[0]; assert(browserContext);
    const page = await browserContext.newPage(), nativePage = await browserContext.newCDPSession(page);
    const origin = "http://127.0.0.1:" + port; let escapedHttp = 0;
    await browserContext.route("**/*", route => { if (!route.request().url().startsWith(origin + "/")) { escapedHttp++; return route.abort(); } return route.continue(); });
    page.on("pageerror", e => consoleErrors.push(e.message));
    page.on("response", response => { responseWork.push((async () => {
      const content = await response.body(), route = new URL(response.url()).pathname, expected = served.get(route);
      assert(expected); assert.equal(hash(content), hash(expected.content)); received.push({ route, bytes: content.length, sha256: hash(content), status: response.status() });
    })()); });
    await page.goto(origin); await page.waitForFunction(() => globalThis.moduleReady === true);
    const payload = vectors.map(f => { const c = context(f), built = builder.buildStakeTransaction(c); return { c, ...built, witness: witnesses(built.review), partial: witnesses(built.review, keys.slice(0, 1)), foreign: witnesses(built.review, [...keys, key("44".repeat(32))]), literal: f }; });
    const liveContext = context(vectors[0], true), liveBuilt = builder.buildStakeTransaction(liveContext);
    const live = { c: liveContext, ...liveBuilt, witness: witnesses(liveBuilt.review) };
    result = await page.evaluate(async serialized => {
      const data = JSON.parse(serialized, (_k, v) => v && typeof v === "object" && Object.keys(v).length === 1 && "bigint" in v ? BigInt(v.bigint) : v);
      const { payload, live } = data;
      const records = [], cache = {};
      const ok = (condition, label) => { if (!condition) throw Error(label); records.push(label); };
      const eq = (a, b, label) => ok(a === b, label);
      function require(id) {
        if (id === "@noble/hashes/blake2.js") return globalThis.noble;
        if (cache[id]) return cache[id].exports;
        const module = { exports: {} }; cache[id] = module; globalThis.factories[id](require, module, module.exports); return module.exports;
      }
      const owners = [], pause = ms => new Promise(resolve => setTimeout(resolve, ms));
      let forbiddenCalls = 0;
      function forbidden() { forbiddenCalls++; throw Error("FORBIDDEN"); }
      const restore = [];
      for (const [object, member] of [[globalThis, "fetch"], [navigator, "sendBeacon"], [Storage.prototype, "setItem"], [Storage.prototype, "getItem"], [Storage.prototype, "removeItem"], [XMLHttpRequest.prototype, "open"], [WebSocket.prototype, "send"]]) {
        const original = object[member]; object[member] = forbidden; restore.push(() => { object[member] = original; });
        try { object[member](); } catch (e) { eq(e.message, "FORBIDDEN", "instrument member " + member); }
      }
      eq(forbiddenCalls, 7, "each browser forbidden instrument responds"); forbiddenCalls = 0;
      const { createWalletSession } = require("./wallet-session"), guard = require("./guard"), cbor = require("./cbor"), crypto = require("./crypto");
      eq(forbiddenCalls, 0, "actual production imports have zero forbidden effects");
      const json = value => JSON.stringify(value, (_k, v) => typeof v === "bigint" ? v.toString() : v);
      const rawInput = i => {
        // Synthetic fixture envelope only; original wallet codec is the deciding decoder.
        const uint = n => n < 24n ? n.toString(16).padStart(2, "0") : n <= 0xffffffffn ? "1a" + n.toString(16).padStart(8, "0") : "1b" + n.toString(16).padStart(16, "0");
        return "82825820" + i.txId + uint(i.index) + "825839" + i.addressHex + uint(i.lovelace);
      };
      function setup(item, runtime = {}) {
        const c = structuredClone(item.c), calls = [], handles = []; let changes = {}, signAction = () => item.witness;
        const owner = createWalletSession(id => { eq(id, "chosen", "explicit selected provider"); return { async enable(...args) {
          eq(args.length, 0, "enable has no extension argument"); const id = handles.length + 1;
          const api = { id, async getNetworkId() { return changes.network ?? 1; }, async getChangeAddress() { return changes.address ?? c.changeAddressHex; },
            async getRewardAddresses() { return changes.rewards ?? ["e1" + c.stakeKeyHash]; }, async getUtxos() { return (changes.inputs ?? c.wallet.utxos).map(rawInput); },
            signTx(...args) { calls.push({ receiver: this.id, id, args }); return signAction(); }, signData: forbidden, submitTx: forbidden };
          Object.defineProperty(api, "cip95", { get: forbidden });
          if (changes.signProperty) Object.defineProperty(api, "signTx", changes.signProperty);
          handles.push(api); return api;
        } }; }, { now: () => c.now, ...runtime });
        owners.push(owner); return { owner, c, calls, handles, changes: value => { changes = value; }, signer: fn => { signAction = fn; } };
      }
      async function reject(action, code, label) { let error; try { await action(); } catch (e) { error = e; } ok(error && (!code || error.code === code), label); ok(!error.message.includes("SECRET") && !("cause" in error), label + " redaction"); }
      try {
        for (const item of payload) {
          const s = setup(item); eq(s.handles.length, 0, "import/construction no enable"); await s.owner.connect("chosen"); await s.owner.recheck(); eq(s.calls.length, 0, "connect and recheck zero sign");
          const controlStart = forbiddenCalls;
          for (const fn of [s.handles[0].submitTx, s.handles[0].signData, () => s.handles[0].cip95]) { try { fn(); } catch (e) { eq(e.message, "FORBIDDEN", "wallet forbidden member responds"); } }
          eq(forbiddenCalls - controlStart, 3, "all wallet forbidden member controls"); forbiddenCalls = controlStart;
          const review = guard.reviewBody(item.review.bodyHex, s.c); eq(crypto.bodyId(review.bodyHex), item.literal.txId, "native actual Noble independent literal body ID " + item.literal.name);
          await reject(() => s.owner.requestSignature({ ...review }, s.c), "REVIEW", "cloned review before native sign"); eq(s.calls.length, 0, "clone zero sign");
          const result = await s.owner.requestSignature(review, s.c); eq(result.handleGeneration, 4, "provenance names actual signing generation after refused clone acquisition");
          eq(s.calls.length, 1, "one explicit browser sign"); eq(s.calls[0].receiver, s.calls[0].id, "native correct API receiver"); eq(s.calls[0].id, 4, "fresh H4, never cached H1");
          eq(s.calls[0].args[0], item.literal.unsignedHex, "native exact builder wrapper " + item.literal.name); eq(s.calls[0].args[1], false, "native partialSign false"); eq(s.calls[0].args.length, 2, "native exactly two sign arguments");
          const spans = cbor.array(cbor.decode(s.calls[0].args[0])); eq(spans.length, 4, "raw ARRAY4"); eq(s.calls[0].args[0].slice(spans[0].start * 2, spans[0].end * 2), item.literal.bodyHex, "original body span");
          const accepted = await guard.assembleSignedTransaction(result.witnessHex, review, s.c); eq((await guard.verifySignedTransaction(accepted.signedHex, review, s.c)).txId, item.literal.txId, "native real Ed25519 verify " + item.literal.name);
          for (const witness of ["a0", item.partial, item.foreign, result.witnessHex.replace(/.$/, "f")]) await reject(() => guard.assembleSignedTransaction(witness, review, s.c), undefined, "native malformed/invalid witness guard");
          const wrongBody = accepted.signedHex.replace(item.literal.bodyHex, payload.find(x => x !== item).literal.bodyHex);
          await reject(() => guard.verifySignedTransaction(wrongBody, review, s.c), undefined, "native changed body refused");
        }
        for (const decorated of [false, true]) {
          const item = payload[0], s = setup(item), entries = []; let getterReads = 0;
          await s.owner.connect("chosen"); const review = guard.reviewBody(item.review.bodyHex, s.c);
          function signer(...args) { const state = s.owner.getState(); entries.push({ phase: state.phase, revision: state.revision, receiver: this.id, args }); return item.witness; }
          if (decorated) for (const member of ["call", "apply", "bind"]) Object.defineProperty(signer, member, { get() {
            getterReads++; s.owner.disconnect(); return Function.prototype[member];
          } });
          s.changes({ signProperty: { value: signer } });
          let answer, error; try { answer = await s.owner.requestSignature(review, s.c); } catch (e) { error = e; }
          eq(entries.filter(entry => entry.phase !== "observed" || entry.revision !== s.c.revision).length, 0,
            "FORBIDDEN_SIGN_AFTER_OBSERVED_DISCONNECT " + json(entries));
          eq(getterReads, 0, "native captured callable properties never read " + decorated); eq(error, undefined, "native callable supported " + decorated);
          eq(json(entries), json([{ phase: "observed", revision: 1, receiver: 2, args: [item.literal.unsignedHex, false] }]), "native actual callable entry " + decorated);
          eq(answer.witnessHex, item.witness, "native callable returns untrusted witnesses " + decorated);
        }
        {
          const item = payload[0], s = setup(item), entries = []; await s.owner.connect("chosen"); const review = guard.reviewBody(item.review.bodyHex, s.c);
          s.changes({ signProperty: { get() { s.owner.disconnect(); return function(...args) { entries.push({ phase: s.owner.getState().phase, args }); return item.witness; }; } } });
          await reject(() => s.owner.requestSignature(review, s.c), "CHANGED", "native API sign getter disconnect refuses");
          eq(entries.length, 0, "native API sign getter disconnect zero actual entries");
        }
        const item = payload[0], s = setup(item), ac = new AbortController(); await s.owner.connect("chosen"); const review = guard.reviewBody(item.review.bodyHex, s.c);
        let approve; s.signer(() => new Promise(resolve => { approve = resolve; }));
        const pending = s.owner.requestSignature(review, s.c, { signal: ac.signal }); const caught = pending.catch(e => e); while (!approve) await pause(1);
        ac.abort(); eq((await caught).code, "ABORTED", "native abort returns while popup RPC pending"); await reject(() => s.owner.requestSignature(review, s.c), "BUSY", "native pending RPC reservation"); approve(item.witness); await pause(1);
        s.signer(() => item.witness); eq((await s.owner.requestSignature(review, s.c)).witnessHex, item.witness, "native reservation releases on late settlement");
        const changed = setup(item); await changed.owner.connect("chosen"); const changedReview = guard.reviewBody(item.review.bodyHex, changed.c);
        changed.signer(() => { changed.changes({ rewards: [] }); return item.witness; }); await reject(() => changed.owner.requestSignature(changedReview, changed.c), "CHANGED", "native post-approval fresh binding"); eq(changed.handles.length, 3, "native post-approval enable performed");
        const timed = setup(item, { signatureTimeoutMs: 25 }); await timed.owner.connect("chosen"); const timedReview = guard.reviewBody(item.review.bodyHex, timed.c);
        timed.signer(async () => { await pause(70); return item.witness; }); await reject(() => timed.owner.requestSignature(timedReview, timed.c), "TIMEOUT", "native short response timer"); await pause(80);
        const normal = setup(item, { signatureTimeoutMs: 200 }); await normal.owner.connect("chosen"); const normalReview = guard.reviewBody(item.review.bodyHex, normal.c);
        normal.signer(async () => { await pause(10); return item.witness; }); eq((await normal.owner.requestSignature(normalReview, normal.c)).witnessHex, item.witness, "native healthy short deadline neighbor");
        eq(forbiddenCalls, 0, "browser production forbidden effects zero");
        // Retain only this owner for real native event/30-second polling work outside evaluate.
        const eventOwner = setup(live, { now: Date.now }); await eventOwner.owner.connect("chosen"); eventOwner.owner.attachBrowser(window, document);
        globalThis.eventCounts = { focus: 0, visibility: 0, trusted: 0 };
        window.addEventListener("focus", e => { eventCounts.focus++; if (e.isTrusted) eventCounts.trusted++; });
        document.addEventListener("visibilitychange", e => { eventCounts.visibility++; if (e.isTrusted) eventCounts.trusted++; });
        globalThis.eventHarness = eventOwner; globalThis.eventReview = guard.reviewBody(live.review.bodyHex, { ...eventOwner.c, now: Date.now() }); globalThis.eventItem = live;
        for (const owner of owners) if (owner !== eventOwner.owner) owner.dispose();
        return { records, loaded: Object.keys(cache), forbiddenCalls, eventStart: { generation: eventOwner.owner.getState().handleGeneration, time: performance.now() }, bodies: [...payload, live].map(x => ({ bodyHex: x.review.bodyHex, txId: x.review.txId })) };
      } finally { restore.forEach(fn => fn()); }
    }, JSON.stringify({ payload, live }, (_k, v) => typeof v === "bigint" ? { bigint: v.toString() } : v));
    // Native tab visibility/focus changes, then a real visible 30-second timer during unchanged approval.
    await page.evaluate(() => { const s = eventHarness; s.signer(() => new Promise(resolve => { globalThis.eventApprove = resolve; })); globalThis.eventPending = s.owner.requestSignature(eventReview, s.c); });
    await page.waitForFunction(() => typeof globalThis.eventApprove === "function");
    const before = await page.evaluate(() => ({ generation: eventHarness.owner.getState().handleGeneration, focus: document.hasFocus(), visible: document.visibilityState }));
    const target = await nativePage.send("Target.getTargetInfo");
    const originalWindow = await nativePage.send("Browser.getWindowForTarget", { targetId: target.targetInfo.targetId });
    const newTarget = await nativePage.send("Target.createTarget", { url: "about:blank", browserContextId: target.targetInfo.browserContextId, newWindow: false });
    const secondWindow = await nativePage.send("Browser.getWindowForTarget", { targetId: newTarget.targetId });
    assert.equal(originalWindow.windowId, secondWindow.windowId, "native tab control must share a window");
    await nativePage.send("Target.activateTarget", { targetId: newTarget.targetId });
    await page.waitForFunction(() => document.visibilityState === "hidden", undefined, { timeout: 5000 });
    await nativePage.send("Target.activateTarget", { targetId: target.targetInfo.targetId });
    await page.waitForFunction(generation => eventHarness.owner.getState().phase === "observed" && eventHarness.owner.getState().handleGeneration > generation && eventCounts.focus > 0 && eventCounts.visibility > 0, before.generation, { timeout: 10000 });
    const events = await page.evaluate(() => ({ generation: eventHarness.owner.getState().handleGeneration, visible: document.visibilityState, focus: document.hasFocus(), counts: { ...eventCounts }, time: performance.now() }));
    assert.equal(events.visible, "visible"); assert(events.counts.trusted >= 2);
    assert.equal(await page.evaluate(() => Object.prototype.hasOwnProperty.call(document, "visibilityState")), false);
    await page.waitForFunction(generation => eventHarness.owner.getState().phase === "observed" && eventHarness.owner.getState().handleGeneration > generation, events.generation, { timeout: 35000 });
    const poll = await page.evaluate(async () => {
      const s = eventHarness, before = s.owner.getState().handleGeneration, elapsed = performance.now(); eventApprove(eventItem.witness);
      const result = await eventPending; const after = s.owner.getState().handleGeneration; s.owner.dispose();
      return { before, after, result, elapsed, calls: s.calls, phase: s.owner.getState().phase };
    });
    assert.equal(poll.calls.length, 1); assert.equal(poll.result.witnessHex, live.witness); assert(poll.after > poll.before); assert.equal(poll.phase, "disposed");
    result.nativeEvents = { before, events, poll, realVisibleIntervalMs: poll.elapsed - result.eventStart.time };
    assert(result.nativeEvents.realVisibleIntervalMs >= 29000); assert.equal(escapedHttp, 0); assert.deepEqual(consoleErrors, []);
    // Python's independent BLAKE2b checks native body bytes; no browser hash substitute is used.
    const { spawnSync } = require("node:child_process");
    const python = spawnSync("python3", ["-c", "import hashlib,json,sys; print(json.dumps([hashlib.blake2b(bytes.fromhex(x['bodyHex']),digest_size=32).hexdigest() for x in json.load(sys.stdin)]))"], { input: JSON.stringify(result.bodies), encoding: "utf8" });
    assert.equal(python.status, 0); assert.deepEqual(JSON.parse(python.stdout), result.bodies.map(x => x.txId));
    result.python = { status: python.status, stdout: python.stdout, stderr: python.stderr };
  } finally {
    if (browserSession) { try { await browserSession.send("Browser.close"); } catch { /* Closing can race the protocol reply. */ } }
    if (browser) await browser.close();
    if (child) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      chromeExit = await exited; assert.deepEqual(chromeExit, { code: 0, signal: null });
    }
    if (profile) fs.rmSync(profile, { recursive: true });
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await Promise.all(responseWork);
    if (childPid) assert.equal(fs.existsSync(`/proc/${childPid}`), false, "native Chromium child exited");
    for (const closedPort of [port, debugPort].filter(Boolean)) { const rebound = net.createServer(); await new Promise((resolve, reject) => { rebound.once("error", reject); rebound.listen(closedPort, "127.0.0.1", resolve); }); await new Promise(resolve => rebound.close(resolve)); }
    const evidence = { identity: identity(), executablePath, executableSha256: hash(fs.readFileSync(executablePath)), childPid, chromeExit, browserVersion, port, debugPort, profileRemoved: !profile || !fs.existsSync(profile), closed: true,
      served: [...served].map(([route, file]) => ({ route, sha256: hash(file.content), bytes: file.content.length })), received, consoleErrors, result };
    writeEvidence("browser.json", evidence); hook.deregister();
  }
  console.log("NATIVE_BROWSER", JSON.stringify({ assertions: result.records.length, loaded: result.loaded, responses: received.length, browserVersion, childPid, port, closed: true, realVisibleIntervalMs: result.nativeEvents.realVisibleIntervalMs }));
}
