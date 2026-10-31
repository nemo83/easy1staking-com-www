#!/usr/bin/env node
"use strict";
// Loads the actual production module once per process, including in real Chromium.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), vm = require("node:vm");
const assert = require("node:assert/strict"), http = require("node:http"), net = require("node:net");
const { createHash } = require("node:crypto");
assert.equal(process.version, "v24.22.1", "Use pinned Node 24.22.1");
const root = path.resolve(__dirname, ".."), filename = path.join(root, "src/lib/site/delegation/coordination.ts");
const fixtureFile = path.join(__dirname, "fixtures/delegation-coordination.json");
const ts = require("typescript"), source = fs.readFileSync(filename, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 }, reportDiagnostics: true });
assert.equal(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const js = compiled.outputText, hash = value => createHash("sha256").update(value).digest("hex");
const fixture = JSON.parse(fs.readFileSync(fixtureFile, "utf8")).record;
const original = JSON.stringify(fixture), clone = structuredClone;
const evidenceFlag = process.argv.indexOf("--evidence-dir");
const evidence = evidenceFlag >= 0 ? path.resolve(process.argv[evidenceFlag + 1]) : fs.mkdtempSync(path.join(os.tmpdir(), "easy1-coordination-"));
assert(evidence.startsWith(os.tmpdir() + path.sep), "Evidence belongs in owned temporary scratch");
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(evidence, "compiled.cjs"), js, { mode: 0o600 });
let checks = 0, browserChecks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS node ${name}`); }
const production = { exports: {} };
vm.runInThisContext(`(function(module,exports){${js}\n})`, { filename })(production, production.exports);
const api = production.exports;
function recordReject(value) { assert.throws(() => api.parseRecoveryRecord(value), e => e.code === "RECORD" && e.message === "The recovery record is unsupported or invalid.", "FORBIDDEN_RECORD_ACCEPTANCE"); }
function valueReject(value) { assert.throws(() => api.serializeRecoveryRecord(value), e => e.code === "RECORD", "FORBIDDEN_SCHEMA_ACCEPTANCE"); }
function recordChange(field, value) { return { ...clone(fixture), [field]: value }; }
function nodeCases() {
  check("import has no browser dependency/effect", () => assert.equal(typeof api.createDelegationCoordinator, "function"));
  check("fixed pool matches independent site identity and accepted guard source", () => {
    assert(fs.readFileSync(path.join(root, "src/lib/site/config.ts"), "utf8").includes(fixture.poolId));
    assert(fs.readFileSync(path.join(root, "src/lib/site/delegation/guard.ts"), "utf8").includes("20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9"));
    assert.equal(api.DELEGATION_POOL_ID, fixture.poolId);
  });
  check("exact accepted minimal canonical record", () => assert.equal(api.serializeRecoveryRecord(api.parseRecoveryRecord(original)), original));
  check("deeply immutable neutral record", () => { const r = api.parseRecoveryRecord(original); assert(Object.isFrozen(r) && Object.isFrozen(r.inputRefs)); });
  for (const value of ["4492800", "4492801", "9007199254740990", "9007199254740991"]) check(`accepted exact slot ${value}`, () => assert.equal(api.parseRecoveryRecord(JSON.stringify(recordChange("invalidHereafterSlot", value))).invalidHereafterSlot, value));
  for (const value of ["0", "4492799", "9007199254740992", "18446744073709551615", "0200000600", "2e8", "-1", "200000600.0", 200000600, null]) check(`slot refusal ${JSON.stringify(value)}`, () => recordReject(JSON.stringify(recordChange("invalidHereafterSlot", value))));
  for (const value of [0, 1, Number.MAX_SAFE_INTEGER]) check(`accepted timestamp ${value}`, () => assert.equal(api.parseRecoveryRecord(JSON.stringify(recordChange("createdAt", value))).createdAt, value));
  for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, "1793404800000", null]) check(`timestamp refusal ${JSON.stringify(value)}`, () => recordReject(JSON.stringify(recordChange("createdAt", value))));
  check("serializer refuses negative zero timestamp", () => valueReject(recordChange("createdAt", -0)));
  for (const stage of ["prepared", "submitting", "submitted", "unknown"]) check(`accepted stage ${stage}`, () => assert.equal(api.parseRecoveryRecord(JSON.stringify(recordChange("stage", stage))).stage, stage));
  for (const [field, values] of Object.entries({ schemaVersion: [0, 2, "1"], networkId: [0, 2, "1"], poolId: ["pool1wrong", null], txId: ["a".repeat(63), "a".repeat(65), "A".repeat(64), null], stage: ["confirmed", "expired", "", null] })) {
    for (const value of values) check(`identity/schema ${field} ${JSON.stringify(value)}`, () => recordReject(JSON.stringify(recordChange(field, value))));
  }
  for (const field of Object.keys(fixture)) check(`missing required field ${field}`, () => { const r = clone(fixture); delete r[field]; recordReject(JSON.stringify(r)); });
  for (const field of ["address", "handle", "walletId", "review", "body", "witness", "seed", "identifier", "extra"]) check(`extra field ${field}`, () => recordReject(JSON.stringify({ ...fixture, [field]: "synthetic" })));
  for (const count of [1, 2047, 2048]) check(`accepted unique refs count ${count} with max index`, () => {
    const refs = Array.from({ length: count }, (_, i) => i.toString(16).padStart(64, "0") + "#65535");
    assert.equal(api.parseRecoveryRecord(JSON.stringify(recordChange("inputRefs", refs))).inputRefs.length, count);
  });
  for (const count of [0, 2049]) check(`ref resource refusal count ${count} otherwise valid`, () => recordReject(JSON.stringify(recordChange("inputRefs", Array.from({ length: count }, (_, i) => i.toString(16).padStart(64, "0") + "#0")))));
  for (const index of ["0", "1", "65534", "65535"]) check(`accepted input index ${index}`, () => assert.equal(api.parseRecoveryRecord(JSON.stringify(recordChange("inputRefs", ["b".repeat(64) + "#" + index]))).inputRefs.length, 1));
  for (const ref of ["b".repeat(64) + "#65536", "b".repeat(64) + "#00", "b".repeat(64) + "#-1", "B".repeat(64) + "#0", "b".repeat(63) + "#0", "b".repeat(64) + "#1.0", null]) check(`input ref refusal ${JSON.stringify(ref)}`, () => recordReject(JSON.stringify(recordChange("inputRefs", [ref]))));
  check("duplicate refs refused beside unique neighbor", () => recordReject(JSON.stringify(recordChange("inputRefs", [fixture.inputRefs[0], fixture.inputRefs[0]]))));
  check("sparse refs serializer refused", () => valueReject(recordChange("inputRefs", Array(1))));
  for (const raw of ["", "{", "null", "[]", "0", original + " ", " " + original, original.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'), original.replace('"schemaVersion"', '"schema\\u0056ersion"'), JSON.stringify(Object.fromEntries(Object.entries(fixture).reverse())), "x".repeat(150001)]) check("hostile/canonical raw refusal " + hash(raw).slice(0, 8), () => recordReject(raw));
  check("input objects are copied before return", () => { const r = clone(fixture), text = api.serializeRecoveryRecord(r); r.inputRefs[0] = "bad"; assert.equal(text, original); });
  check("symbol key cannot bypass exact schema", () => { const r = clone(fixture); r[Symbol("extra")] = 1; valueReject(r); });
  check("no exported resolution, blind clear, wallet or transport capability", () => assert.deepEqual(Object.keys(api).sort(), ["CoordinationError", "DELEGATION_LOCK_NAME", "DELEGATION_POOL_ID", "DELEGATION_RECORD_KEY", "createDelegationCoordinator", "parseRecoveryRecord", "serializeRecoveryRecord"].sort()));
}
async function browserCases() {
  const option = (name, fallback) => process.argv.includes(name) ? path.resolve(process.argv[process.argv.indexOf(name) + 1]) : fallback;
  const playwrightPath = option("--playwright", "/tmp/easy1-homepage-browser-tools/node_modules/playwright");
  const { chromium } = require(playwrightPath);
  const executablePath = option("--chromium", "/home/giovanni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome");
  const sockets = new Set(), forbidden = [], lifecycle = { pid: process.pid, executablePath, executableSha256: hash(fs.readFileSync(executablePath)), playwrightPath,
    serverAddress: null, browserPid: null, browserExitCode: null, browserSignal: null, browserClosed: false, serverClosed: false, portRebound: false, observedModuleResponses: 0 };
  const server = http.createServer((req, res) => {
    if (req.method !== "GET" || !["/", "/module.js", "/favicon.ico"].includes(req.url)) { forbidden.push("server-request"); res.writeHead(403); res.end(); return; }
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/module.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js); }
    else if (req.url === "/favicon.ico") { res.writeHead(204); res.end(); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><title>Private coordination runner</title><script>window.module={exports:{}};window.exports=module.exports;</script><script src="/module.js"></script><script>window.api=module.exports;</script>'); }
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  lifecycle.serverAddress = server.address();
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser, browserServer;
  async function scenario(name, fn) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    try {
      await context.route("**/*", async route => {
        const request = route.request();
        if (request.method() !== "GET" || ![origin + "/", origin + "/module.js", origin + "/favicon.ico"].includes(request.url())) { forbidden.push("browser-request"); await route.abort(); }
        else await route.continue();
      });
      await context.addInitScript(() => {
        window.forbiddenEffects = [];
        const refuse = name => () => { window.forbiddenEffects.push(name); throw Error("forbidden synthetic effect"); };
        window.fetch = refuse("fetch"); navigator.sendBeacon = refuse("beacon");
        window.WebSocket = function() { return refuse("websocket")(); }; XMLHttpRequest.prototype.open = refuse("xhr");
        window.cardano = new Proxy({}, { get: refuse("wallet") });
        navigator.storage.persist = refuse("persistence-prompt");
      });
      const a = await context.newPage(), b = await context.newPage();
      for (const page of [a, b]) {
        const response = page.waitForResponse(origin + "/module.js");
        await page.goto(origin);
        assert.equal(hash(await (await response).body()), hash(js), "browser must load exact current ES2017 module bytes");
        lifecycle.observedModuleResponses++;
        await page.evaluate(record => {
          window.fixture = record;
          const { txId, invalidHereafterSlot, inputRefs, createdAt } = record;
          window.details = { txId, invalidHereafterSlot, inputRefs, createdAt };
          window.code = async fn => { try { await fn(); return "ACCEPTED"; } catch (error) { return error.code || error.name; } };
          window.c = api.createDelegationCoordinator(); window.effects = [];
        }, fixture);
      }
      await fn(a, b, context);
      for (const page of context.pages()) if (!page.isClosed()) assert.deepEqual(await page.evaluate(() => window.forbiddenEffects), [], "FORBIDDEN_EXTERNAL_EFFECT");
      browserChecks++; console.log(`PASS chromium ${name}`);
    } finally { await context.close(); }
  }
  try {
    browserServer = await chromium.launchServer({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    lifecycle.browserPid = browserServer.process().pid;
    browser = await chromium.connect(browserServer.wsEndpoint());
    console.log(JSON.stringify({ chromiumVersion: browser.version(), origin, nativeSecureContextRequired: true }));
    await scenario("native secure context/import has zero records, locks and external effects", async a => {
      assert.equal(await a.evaluate(() => isSecureContext), true);
      assert.deepEqual(await a.evaluate(async () => ({ records: localStorage.length, held: (await navigator.locks.query()).held, effects: forbiddenEffects })), { records: 0, held: [], effects: [] });
      assert.deepEqual(await a.evaluate(() => {
        for (const fn of [() => fetch("synthetic-forbidden"), () => cardano.synthetic, () => navigator.sendBeacon("synthetic-forbidden"), () => new WebSocket("synthetic-forbidden"), () => new XMLHttpRequest().open("POST", "synthetic-forbidden"), () => navigator.storage.persist()]) { try { fn(); } catch {} }
        const observed = [...forbiddenEffects]; forbiddenEffects.length = 0; return observed;
      }), ["fetch", "wallet", "beacon", "websocket", "xhr", "persistence-prompt"], "effect tripwires must respond without making an outward call");
    });
    await scenario("one native lock spans decision/build/review/sign/initial-attempt deferred phases", async (a, b) => {
      await a.evaluate(() => {
        window.phaseIndex = -1; window.nextPhase = null;
        window.operation = c.withNewOperation(async lease => {
          window.heldLease = lease;
          for (const phase of ["decision", "build", "review", "sign", "initial-attempt"]) {
            effects.push(phase); phaseIndex++; await new Promise(resolve => { nextPhase = resolve; });
          }
          return "complete";
        });
      });
      for (let i = 0; i < 5; i++) {
        await a.waitForFunction(i => phaseIndex === i, i);
        assert.equal(await b.evaluate(async () => (await navigator.locks.query()).held.filter(lock => lock.name === api.DELEGATION_LOCK_NAME && lock.mode === "exclusive").length), 1);
        assert.equal(await b.evaluate(() => code(() => c.withNewOperation(async () => { effects.push("FORBIDDEN_CALLBACK"); }))), "BUSY", "FORBIDDEN_CONCURRENT_CALLBACK");
        assert.deepEqual(await b.evaluate(() => effects), []);
        await a.evaluate(() => nextPhase());
      }
      assert.equal(await a.evaluate(() => operation), "complete");
      assert.equal(await b.evaluate(() => c.withNewOperation(async () => "healthy neighbor")), "healthy neighbor");
      assert.deepEqual(await b.evaluate(async () => (await navigator.locks.query()).held), []);
    });
    for (const failure of ["missing-lock", "lock-getter", "lock-reject", "storage-getter", "quota", "probe-readback", "cleanup"]) {
      await scenario(`injected capability ${failure} prevents protected callback`, async a => {
        const result = await a.evaluate(async failure => {
          const lockDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "locks"), storageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
          const set = Storage.prototype.setItem, get = Storage.prototype.getItem, remove = Storage.prototype.removeItem;
          try {
            if (failure === "missing-lock") Object.defineProperty(Navigator.prototype, "locks", { configurable: true, value: undefined });
            if (failure === "lock-getter") Object.defineProperty(Navigator.prototype, "locks", { configurable: true, get() { throw Error("sensitive native"); } });
            if (failure === "lock-reject") Object.defineProperty(Navigator.prototype, "locks", { configurable: true, value: { request() { return Promise.reject(Error("sensitive native")); } } });
            if (failure === "storage-getter") Object.defineProperty(window, "localStorage", { configurable: true, get() { throw Error("sensitive native"); } });
            if (failure === "quota") Storage.prototype.setItem = function() { throw new DOMException("sensitive native", "QuotaExceededError"); };
            if (failure === "probe-readback") Storage.prototype.getItem = function(key) { return key.includes(":probe:") ? null : get.call(this, key); };
            if (failure === "cleanup") Storage.prototype.removeItem = function() { throw Error("sensitive native"); };
            const result = await code(() => c.withNewOperation(async () => { effects.push("FORBIDDEN_CALLBACK"); }));
            return { result, effects };
          } finally {
            if (lockDescriptor) Object.defineProperty(Navigator.prototype, "locks", lockDescriptor);
            if (storageDescriptor) Object.defineProperty(window, "localStorage", storageDescriptor);
            Storage.prototype.setItem = set; Storage.prototype.getItem = get; Storage.prototype.removeItem = remove;
          }
        }, failure);
        assert.deepEqual(result, { result: "UNAVAILABLE", effects: [] }, "FORBIDDEN_CAPABILITY_CALLBACK");
        assert.equal(await a.evaluate(() => c.withNewOperation(async () => "healthy")), "healthy");
      });
    }
    for (const signal of ["true", "false", "reject", "absent"]) await scenario(`persisted ${signal} is optional read-only signal`, async a => {
      const result = await a.evaluate(async signal => {
        const saved = navigator.storage.persisted;
        try {
          navigator.storage.persisted = signal === "absent" ? undefined : async () => { if (signal === "reject") throw Error("private native"); return signal === "true"; };
          localStorage.setItem("unrelated-synthetic", "preserve");
          await c.withNewOperation(async () => effects.push("healthy"));
          return { state: c.getState(), unrelated: localStorage.getItem("unrelated-synthetic"), keys: Object.keys(localStorage) };
        } finally { navigator.storage.persisted = saved; }
      }, signal);
      assert.equal(result.state.persisted, signal === "true" ? true : signal === "false" ? false : null);
      assert.equal(result.unrelated, "preserve"); assert.deepEqual(result.keys, ["unrelated-synthetic"]);
    });
    await scenario("exact synchronous preparation/submitting readback precedes markers; returned ID stays pending", async (a, b) => {
      const result = await a.evaluate(async () => c.withNewOperation(async lease => {
        const originalSet = Storage.prototype.setItem, originalGet = Storage.prototype.getItem;
        window.order = [];
        try {
          Storage.prototype.setItem = function(key, value) { if (key === api.DELEGATION_RECORD_KEY) order.push("write:" + JSON.parse(value).stage); return originalSet.call(this, key, value); };
          Storage.prototype.getItem = function(key) { const value = originalGet.call(this, key); if (key === api.DELEGATION_RECORD_KEY && value !== null) order.push("read:" + JSON.parse(value).stage); return value; };
          const intent = c.prepare(lease, details); order.push("prepared-marker");
          const prepared = localStorage.getItem(api.DELEGATION_RECORD_KEY);
          const attempt = c.beginAttempt(lease, intent); order.push("outward-attempt-marker");
          c.markOutcome(lease, intent, "submitted");
          return { prepared, attempt, order, state: c.getState() };
        } finally { Storage.prototype.setItem = originalSet; Storage.prototype.getItem = originalGet; }
      }));
      assert.equal(result.prepared, original);
      assert(result.order.indexOf("write:prepared") < result.order.indexOf("read:prepared") && result.order.indexOf("read:prepared") < result.order.indexOf("prepared-marker"));
      assert(result.order.indexOf("write:submitting") < result.order.indexOf("read:submitting") && result.order.indexOf("read:submitting") < result.order.indexOf("outward-attempt-marker"), "FORBIDDEN_UNRETAINED_ATTEMPT_MARKER");
      assert.equal(result.state.status, "pending"); assert.equal(result.state.record.stage, "submitted");
      assert.equal(await b.evaluate(() => code(() => c.withNewOperation(async () => effects.push("FORBIDDEN_CALLBACK")))), "PENDING");
    });
    for (const stage of ["prepared", "submitting", "submitted", "unknown"]) await scenario(`retained ${stage} blocks other account/tab and reload despite expiry`, async (a, b) => {
      await a.evaluate(async stage => c.withNewOperation(async lease => {
        window.savedLease = lease; window.savedIntent = c.prepare(lease, { ...details, invalidHereafterSlot: "4492800", createdAt: 0 });
        if (stage !== "prepared") c.beginAttempt(lease, savedIntent);
        if (["submitted", "unknown"].includes(stage)) c.markOutcome(lease, savedIntent, stage);
      }), stage);
      await b.waitForFunction(() => c.getState().txId === fixture.txId);
      assert.equal(await b.evaluate(() => code(() => c.withNewOperation(async () => effects.push("FORBIDDEN_CALLBACK")))), "PENDING", "FORBIDDEN_PENDING_CALLBACK");
      await b.reload();
      const result = await b.evaluate(async txId => {
        window.c = api.createDelegationCoordinator(); let callbacks = 0;
        let rejection; try { await c.withNewOperation(async () => callbacks++); } catch (error) { rejection = error.code; }
        let cancel; await c.withRecoveryOperation(txId, async lease => { try { c.recoverUnattempted(lease); cancel = "ACCEPTED"; } catch (error) { cancel = error.code; } });
        return { callbacks, rejection, cancel, state: c.getState() };
      }, fixture.txId);
      assert.equal(result.callbacks, 0); assert.equal(result.rejection, "PENDING"); assert.equal(result.cancel, "INTENT");
      assert.equal(result.state.record.stage, stage); assert.equal(result.state.status, "pending");
    });
    await scenario("malformed retained record blocks and is never blindly erased or healed", async a => {
      assert.deepEqual(await a.evaluate(async () => {
        const raw = JSON.stringify({ ...fixture, secretExtra: "synthetic" }); localStorage.setItem(api.DELEGATION_RECORD_KEY, raw);
        const refusal = await code(() => c.withNewOperation(async () => effects.push("FORBIDDEN_CALLBACK")));
        const retained = localStorage.getItem(api.DELEGATION_RECORD_KEY) === raw;
        localStorage.removeItem(api.DELEGATION_RECORD_KEY);
        const later = await code(() => c.withNewOperation(async () => effects.push("FORBIDDEN_CALLBACK")));
        return { refusal, retained, later, effects, state: c.getState().status };
      }), { refusal: "RECORD", retained: true, later: "RECORD", effects: [], state: "invalid" });
    });
    for (const failure of ["prepared-write", "prepared-readback", "submitting-write", "submitting-readback", "submitting-missing", "submitting-getter"]) await scenario(`injected ${failure} prevents successful marker`, async a => {
      const result = await a.evaluate(async failure => {
        const set = Storage.prototype.setItem, get = Storage.prototype.getItem;
        let result;
        try {
          result = await code(() => c.withNewOperation(async lease => {
            const target = failure.startsWith("prepared") ? "prepared" : "submitting";
            Storage.prototype.setItem = function(key, value) { if (key === api.DELEGATION_RECORD_KEY && JSON.parse(value).stage === target && failure.endsWith("write")) throw Error("sensitive native"); return set.call(this, key, value); };
            Storage.prototype.getItem = function(key) { const value = get.call(this, key); if (key === api.DELEGATION_RECORD_KEY && value && JSON.parse(value).stage === target) {
              if (failure.endsWith("getter")) throw Error("sensitive native");
              if (failure.endsWith("readback") || failure.endsWith("missing")) return failure.endsWith("missing") ? null : value + " ";
            } return value; };
            const intent = c.prepare(lease, details); effects.push("prepared-marker");
            c.beginAttempt(lease, intent); effects.push("FORBIDDEN_ATTEMPT_MARKER");
          }));
        } finally { Storage.prototype.setItem = set; Storage.prototype.getItem = get; }
        return { result, effects, state: c.getState() };
      }, failure);
      assert.equal(result.result, "UNAVAILABLE", "FORBIDDEN_UNRETAINED_ATTEMPT_MARKER");
      assert(!result.effects.includes("FORBIDDEN_ATTEMPT_MARKER"), "FORBIDDEN_UNRETAINED_ATTEMPT_MARKER");
      assert.equal(result.state.txId, fixture.txId); assert.equal(result.state.status, "unknown");
    });
    for (const change of ["delete", "replace-id", "replace-input", "replace-stage"]) await scenario(`observed active storage ${change} blocks marker and keeps prior neutral ID`, async (a, b) => {
      await a.evaluate(() => {
        window.ready = false;
        window.operation = code(() => c.withNewOperation(async lease => {
          window.heldLease = lease; window.heldIntent = c.prepare(lease, details); ready = true;
          await new Promise(resolve => { window.resume = resolve; });
          c.beginAttempt(lease, heldIntent); effects.push("FORBIDDEN_ATTEMPT_MARKER");
        }));
      });
      await a.waitForFunction(() => ready);
      await b.evaluate(change => {
        if (change === "delete") localStorage.removeItem(api.DELEGATION_RECORD_KEY);
        else localStorage.setItem(api.DELEGATION_RECORD_KEY, JSON.stringify({ ...fixture, ...(change === "replace-id" ? { txId: "c".repeat(64) } : change === "replace-input" ? { inputRefs: ["d".repeat(64) + "#0"] } : { stage: "unknown" }) }));
      }, change);
      if (change !== "replace-stage") await a.waitForFunction(() => c.getState().status === "unknown");
      await a.evaluate(() => resume());
      const result = await a.evaluate(async () => ({ refusal: await operation, effects, state: c.getState() }));
      assert(["LOST", "INTENT"].includes(result.refusal)); assert.deepEqual(result.effects, []);
      assert.equal(result.state.txId, fixture.txId); assert.equal(result.state.record.txId, fixture.txId);
      assert.equal(await a.evaluate(() => code(() => c.withNewOperation(async () => effects.push("FORBIDDEN_CALLBACK")))), change === "replace-stage" ? "PENDING" : "LOST");
    });
    await scenario("real storage event remembers ID without polling; observed deletion remains sticky", async (a, b) => {
      await a.evaluate(() => {
        window.storageEvents = 0; window.eventReads = 0; addEventListener("storage", () => storageEvents++);
        const get = Storage.prototype.getItem;
        Storage.prototype.getItem = function(key) { if (key === api.DELEGATION_RECORD_KEY) eventReads++; return get.call(this, key); };
      });
      await b.evaluate(async () => c.withNewOperation(async lease => { c.prepare(lease, details); }));
      await a.waitForFunction(() => storageEvents > 0);
      assert((await a.evaluate(() => eventReads)) > 0, "coordinator listener must read actual storage before any getState polling");
      assert.equal(await a.evaluate(() => c.getState().txId), fixture.txId);
      await b.evaluate(() => localStorage.removeItem(api.DELEGATION_RECORD_KEY));
      await a.waitForFunction(() => storageEvents > 1);
      const state = await a.evaluate(() => c.getState()); assert.equal(state.status, "unknown"); assert.equal(state.txId, fixture.txId);
      assert.equal(await a.evaluate(() => code(() => c.withNewOperation(async () => effects.push("FORBIDDEN_CALLBACK")))), "LOST", "FORBIDDEN_LOST_CALLBACK");
      // A new instance with no retained record cannot detect loss across restart.
      await a.reload();
      assert.equal(await a.evaluate(() => api.createDelegationCoordinator().getState().status), "absent");
    });
    for (const change of ["delete-restore", "replace-restore"]) await scenario(`real ${change} race preserves event loss evidence despite restored bytes`, async (a, b) => {
      await a.evaluate(() => { window.events = 0; addEventListener("storage", () => events++); });
      await b.evaluate(async () => c.withNewOperation(async lease => { c.prepare(lease, details); }));
      await a.waitForFunction(() => events > 0);
      const result = await b.evaluate(change => {
        const original = localStorage.getItem(api.DELEGATION_RECORD_KEY);
        if (change === "delete-restore") localStorage.removeItem(api.DELEGATION_RECORD_KEY);
        else localStorage.setItem(api.DELEGATION_RECORD_KEY, JSON.stringify({ ...fixture, txId: "c".repeat(64) }));
        localStorage.setItem(api.DELEGATION_RECORD_KEY, original);
        return localStorage.getItem(api.DELEGATION_RECORD_KEY) === original;
      }, change);
      assert.equal(result, true);
      await a.waitForFunction(() => events >= 3);
      const state = await a.evaluate(() => c.getState());
      assert.equal(state.status, "unknown"); assert.equal(state.txId, fixture.txId);
      assert.equal(await a.evaluate(() => code(() => c.withNewOperation(async () => effects.push("FORBIDDEN_CALLBACK")))), "LOST", "FORBIDDEN_RESTORED_LOSS_CALLBACK");
    });
    await scenario("cloned/foreign lease and intent reject; private active pair still works", async a => {
      const results = await a.evaluate(async () => c.withNewOperation(async lease => {
        const other = api.createDelegationCoordinator();
        try {
          const clonedLease = await code(async () => c.prepare(structuredClone(lease), details));
          const foreignLease = await code(async () => other.prepare(lease, details));
          const intent = c.prepare(lease, details);
          const clonedIntent = await code(async () => c.beginAttempt(lease, structuredClone(intent)));
          const foreignIntent = await code(async () => other.beginAttempt(lease, intent));
          c.cancelUnattempted(lease, intent);
          return { clonedLease, foreignLease, clonedIntent, foreignIntent, status: c.getState().status };
        } finally { other.dispose(); }
      }));
      assert.deepEqual(results, { clonedLease: "LEASE", foreignLease: "LEASE", clonedIntent: "INTENT", foreignIntent: "LEASE", status: "absent" }, "FORBIDDEN_CLONED_OR_FOREIGN_AUTHORITY");
    });
    await scenario("released tokens cannot mutate; fresh matching recovery can cancel private never-attempted candidate", async a => {
      const results = await a.evaluate(async () => {
        await c.withNewOperation(async lease => { window.previousLease = lease; window.previousIntent = c.prepare(lease, details); });
        const expired = await code(async () => c.beginAttempt(previousLease, previousIntent));
        const wrong = await code(() => c.withRecoveryOperation("c".repeat(64), async () => effects.push("FORBIDDEN_CALLBACK")));
        const recovery = await c.withRecoveryOperation(fixture.txId, async lease => {
          const oldToken = await code(async () => c.cancelUnattempted(lease, previousIntent));
          const fresh = c.recoverUnattempted(lease);
          const splitAttempt = await code(async () => c.beginAttempt(lease, fresh));
          c.cancelUnattempted(lease, fresh); return { oldToken, splitAttempt };
        });
        return { expired, wrong, recovery, state: c.getState().status, effects };
      });
      assert.deepEqual(results, { expired: "LEASE", wrong: "PENDING", recovery: { oldToken: "INTENT", splitAttempt: "LEASE" }, state: "absent", effects: [] }, "FORBIDDEN_RELEASED_AUTHORITY");
      assert.equal(await a.evaluate(() => c.withNewOperation(async () => "healthy")), "healthy");
    });
    await scenario("attempted candidate cannot cancel, recover as never-attempted or mark twice", async a => {
      const results = await a.evaluate(async () => {
        const active = await c.withNewOperation(async lease => {
          const intent = c.prepare(lease, details); c.beginAttempt(lease, intent);
          const cancel = await code(async () => c.cancelUnattempted(lease, intent));
          const secondAttempt = await code(async () => c.beginAttempt(lease, intent));
          c.markOutcome(lease, intent, "unknown");
          const secondOutcome = await code(async () => c.markOutcome(lease, intent, "submitted"));
          return { cancel, secondAttempt, secondOutcome };
        });
        const recovery = await c.withRecoveryOperation(fixture.txId, lease => code(async () => c.recoverUnattempted(lease)));
        return { active, recovery, raw: localStorage.getItem(api.DELEGATION_RECORD_KEY), state: c.getState().status };
      });
      assert.deepEqual(results.active, { cancel: "INTENT", secondAttempt: "INTENT", secondOutcome: "INTENT" }, "FORBIDDEN_ATTEMPTED_CLEAR");
      assert.equal(results.recovery, "INTENT"); assert.equal(JSON.parse(results.raw).stage, "unknown"); assert.equal(results.state, "pending");
    });
    await scenario("cancel cleanup failure keeps known neutral ID and blocks further work", async a => {
      const result = await a.evaluate(async () => {
        let refusal;
        await c.withNewOperation(async lease => {
          const intent = c.prepare(lease, details), remove = Storage.prototype.removeItem;
          try { Storage.prototype.removeItem = function() { throw Error("sensitive native"); }; refusal = await code(async () => c.cancelUnattempted(lease, intent)); }
          finally { Storage.prototype.removeItem = remove; }
        });
        return { refusal, state: c.getState(), retained: localStorage.getItem(api.DELEGATION_RECORD_KEY) !== null };
      });
      assert.equal(result.refusal, "UNAVAILABLE"); assert.equal(result.state.status, "unknown"); assert.equal(result.state.txId, fixture.txId); assert.equal(result.retained, true);
    });
    await scenario("valid same-ID advance updates neutral state; rollback never re-enables work", async (a, b) => {
      await a.evaluate(() => localStorage.setItem(api.DELEGATION_RECORD_KEY, JSON.stringify(fixture)));
      assert.equal(await b.evaluate(() => c.getState().record.stage), "prepared");
      await a.evaluate(() => localStorage.setItem(api.DELEGATION_RECORD_KEY, JSON.stringify({ ...fixture, stage: "submitted" })));
      await b.waitForFunction(() => c.getState().record.stage === "submitted");
      assert.equal(await b.evaluate(() => c.getState().status), "pending");
      await a.evaluate(() => localStorage.setItem(api.DELEGATION_RECORD_KEY, JSON.stringify(fixture)));
      await b.waitForFunction(() => c.getState().status === "unknown");
      assert.equal(await b.evaluate(() => c.getState().record.stage), "submitted");
    });
    await scenario("abort after attempt never clears submitting record", async (a, b) => {
      await a.evaluate(() => {
        window.controller = new AbortController(); window.ready = false;
        window.operation = code(() => c.withNewOperation(async lease => {
          const intent = c.prepare(lease, details); c.beginAttempt(lease, intent); ready = true;
          await new Promise(resolve => { window.finish = resolve; });
          c.markOutcome(lease, intent, "submitted"); effects.push("FORBIDDEN_LATE_OUTCOME");
        }, { signal: controller.signal }));
      });
      await a.waitForFunction(() => ready); await a.evaluate(() => controller.abort());
      assert.equal(await a.evaluate(() => operation), "CANCELLED");
      assert.equal(await b.evaluate(() => JSON.parse(localStorage.getItem(api.DELEGATION_RECORD_KEY)).stage), "submitting");
      await a.evaluate(() => finish());
      assert.equal(await b.evaluate(() => code(() => c.withNewOperation(async () => effects.push("FORBIDDEN_CALLBACK")))), "PENDING");
      assert.deepEqual(await a.evaluate(() => effects), []);
    });
    for (const termination of ["abort", "dispose", "reject"]) await scenario(`${termination} releases native lock, invalidates late continuation and retains record`, async (a, b) => {
      await a.evaluate(termination => {
        window.abort = new AbortController(); window.ready = false; window.lateResult = null;
        window.operation = code(() => c.withNewOperation(async lease => {
          window.heldLease = lease; window.heldIntent = c.prepare(lease, details); ready = true;
          if (termination === "reject") throw Error("sensitive callback");
          await new Promise(resolve => { window.resume = resolve; });
          lateResult = await code(async () => { c.beginAttempt(lease, heldIntent); effects.push("FORBIDDEN_LATE_MARKER"); });
        }, { signal: abort.signal }));
      }, termination);
      await a.waitForFunction(() => ready);
      if (termination !== "reject") await a.evaluate(termination => termination === "abort" ? abort.abort() : c.dispose(), termination);
      assert.equal(await a.evaluate(() => operation), termination === "reject" ? "OPERATION" : "CANCELLED");
      assert.deepEqual(await b.evaluate(async () => (await navigator.locks.query()).held), []);
      assert.equal(await b.evaluate(() => c.withRecoveryOperation(fixture.txId, async () => "healthy recovery")), "healthy recovery");
      if (termination !== "reject") {
        await a.evaluate(() => resume()); await a.waitForFunction(() => lateResult !== null);
        assert.equal(await a.evaluate(() => lateResult), "LEASE", "FORBIDDEN_LATE_CONTINUATION");
      }
      assert.deepEqual(await a.evaluate(() => effects), []);
      assert.equal(await b.evaluate(() => JSON.parse(localStorage.getItem(api.DELEGATION_RECORD_KEY)).stage), "prepared");
    });
    await scenario("dispose removes owned storage/abort listeners and abort-before-entry never enters", async a => {
      assert.deepEqual(await a.evaluate(async () => {
        c.dispose();
        const add = window.addEventListener, remove = window.removeEventListener;
        let adds = 0, removes = 0, reads = 0;
        const get = Storage.prototype.getItem;
        try {
          window.addEventListener = function(name, ...args) { if (name === "storage") adds++; return add.call(this, name, ...args); };
          window.removeEventListener = function(name, ...args) { if (name === "storage") removes++; return remove.call(this, name, ...args); };
          Storage.prototype.getItem = function(...args) { reads++; return get.apply(this, args); };
          const fresh = api.createDelegationCoordinator(), controller = new AbortController(); controller.abort();
          const refusal = await code(() => fresh.withNewOperation(async () => effects.push("FORBIDDEN_CALLBACK"), { signal: controller.signal }));
          fresh.dispose(); fresh.dispose();
          const before = reads; dispatchEvent(new StorageEvent("storage", { key: api.DELEGATION_RECORD_KEY }));
          return { adds, removes, refusal, postDisposeReads: reads - before, effects };
        } finally { window.addEventListener = add; window.removeEventListener = remove; Storage.prototype.getItem = get; }
      }), { adds: 1, removes: 1, refusal: "CANCELLED", postDisposeReads: 0, effects: [] });
    });
    await scenario("caller-modified coordination errors cannot expose callback payloads", async a => {
      const result = await a.evaluate(async () => {
        try {
          await c.withNewOperation(async () => { const error = new api.CoordinationError("PENDING"); error.message = "sensitive-synthetic-callback"; throw error; });
        } catch (error) { return { code: error.code, message: error.message }; }
      });
      assert.deepEqual(result, { code: "PENDING", message: "A prior operation in this browser is unresolved. Check its status." }, "FORBIDDEN_CALLBACK_ERROR_PAYLOAD");
      for (const shape of ["unknown-code", "throwing-code"]) {
        const other = await a.evaluate(async shape => {
          try {
            await c.withNewOperation(async () => {
              const error = new api.CoordinationError("PENDING");
              if (shape === "unknown-code") error.code = "sensitive-synthetic-code";
              else Object.defineProperty(error, "code", { get() { throw Error("sensitive-synthetic-accessor"); } });
              throw error;
            });
          } catch (error) { return { code: error.code, message: error.message }; }
        }, shape);
        assert.deepEqual(other, { code: "OPERATION", message: "The delegation operation could not complete." }, "FORBIDDEN_CALLBACK_ERROR_PAYLOAD");
      }
    });
    assert.deepEqual(forbidden, [], "FORBIDDEN_NETWORK_OR_NAVIGATION");
  } finally {
    if (browser) { await browser.close(); lifecycle.browserClosed = true; }
    if (browserServer) {
      await browserServer.close();
      lifecycle.browserExitCode = browserServer.process().exitCode; lifecycle.browserSignal = browserServer.process().signalCode;
      assert(browserServer.process().exitCode !== null || browserServer.process().signalCode !== null, "owned browser child must be terminal");
    }
    await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); for (const socket of sockets) socket.destroy(); });
    lifecycle.serverClosed = true;
    const rebound = net.createServer(); await new Promise((resolve, reject) => { rebound.once("error", reject); rebound.listen(lifecycle.serverAddress.port, "127.0.0.1", resolve); });
    await new Promise((resolve, reject) => rebound.close(error => error ? reject(error) : resolve())); lifecycle.portRebound = true;
    fs.writeFileSync(path.join(evidence, "lifecycle.json"), JSON.stringify(lifecycle, null, 2) + "\n");
  }
}
function identities() {
  const dependencies = Object.keys(require.cache).filter(file => file.includes(path.sep + "node_modules" + path.sep) && fs.statSync(file).isFile()).sort().map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  const record = { node: process.version, source: { file: filename, sha256: hash(source) }, compiled: { target: "ES2017", sha256: hash(js), bytes: Buffer.byteLength(js) },
    runner: { file: __filename, sha256: hash(fs.readFileSync(__filename)) }, fixture: { file: fixtureFile, sha256: hash(fs.readFileSync(fixtureFile)) },
    lockSha256: hash(fs.readFileSync(path.join(root, "package-lock.json"))), dependencies, nodeChecks: checks, browserScenarios: browserChecks };
  fs.writeFileSync(path.join(evidence, "identity.json"), JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify({ ...record, dependencies: { loadedFiles: dependencies.length, manifest: path.join(evidence, "identity.json") } }));
}
(async () => {
  try {
    if (!process.argv.includes("--browser-only")) nodeCases();
    if (!process.argv.includes("--node-only")) await browserCases();
    console.log(`PASS coordination ${checks} Node checks, ${browserChecks} native Chromium scenarios`);
  } finally { identities(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
