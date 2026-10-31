#!/usr/bin/env node
"use strict";
// Generates a private route; npm/build and the repository safety gate stay with the caller.
const fs = require("node:fs"), path = require("node:path"), net = require("node:net");
const assert = require("node:assert/strict"), { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events"), { createHash } = require("node:crypto");
const source = path.resolve(__dirname, ".."), repo = path.dirname(source);
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/browser-sdk.json")));
const originals = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/stake-builder.json"))).vectors;
const sha = b => createHash("sha256").update(b).digest("hex");
const args = process.argv.slice(2), mode = args.shift(), options = {};
while (args.length) { const key = args.shift(); assert(key.startsWith("--") && args.length, "Expected --option value"); options[key.slice(2)] = args.shift(); }
function absolute(name) { assert(options[name] && path.isAbsolute(options[name]), `Provide absolute --${name}`); return options[name]; }
const target = path.join(absolute("fixture"), "easy1staking"), output = absolute("output");
assert.notEqual(path.resolve(target), source, "Use an isolated fixture, never the product checkout");
assert.match(process.version, /^v24\./, "Use Node 24");
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const manifest = path.join(output, "generated.json"), route = path.join(target, "src/app/browser-sdk-proof");
const pageSource = "\"use client\";\nimport { useEffect } from \"react\";\nimport inputs from \"./inputs.json\";\nimport type { GuardContext } from \"@/lib/site/delegation/types\";\nfunction context(f: typeof inputs[number]): GuardContext {\n const slot=BigInt(f.constructionSlot),now=1596059091000+Number(slot-BigInt(4492800))*1000;\n const tip={slot,hash:\"aa\".repeat(32),epoch:BigInt(664),observedAt:now};\n const input={txId:f.inputId,index:BigInt(0),addressHex:f.addressHex,lovelace:BigInt(f.funding),assets:{},datum:null,referenceScript:null};\n return {networkId:1,revision:1,changeAddressHex:f.addressHex,stakeKeyHash:f.stakeKeyHash,bindingObservedAt:now,registration:f.registered?\"registered\":\"unregistered\",currentPoolHash:null,registrationObservedAt:now,constructionTip:{...tip},currentTip:{...tip},slotConfig:{zeroTime:BigInt(1596059091000),zeroSlot:BigInt(4492800),slotLength:1000},parameters:{identity:\"b1848e36b120c1f2276f0435482d2dfa6e6ac15445faef6612012a054641d57a\",epoch:BigInt(664),observedAt:now,minFeeCoefficient:BigInt(44),minFeeConstant:BigInt(155381),stakeDeposit:BigInt(2000000),coinsPerUTxOByte:BigInt(4310),maxTxSize:BigInt(16384),maxValueSize:BigInt(5000)},wallet:{complete:true,observedAt:now,utxos:[input]},provider:{observedAt:now,utxos:[{...input,unspent:true}]},now};\n}\nexport default function Proof() {\n useEffect(()=>{ (async()=>{\n  try {\n   const builder=await import(\"@/lib/site/delegation/builder\");\n   const guard=await import(\"@/lib/site/delegation/guard\");\n   const results=inputs.map(f=>{const c=context(f),r=builder.buildStakeTransaction(c);guard.validateBeforeSigning(r.review,c);\n    let negative=\"\";try{guard.validateBeforeSigning(r.review,{...c,revision:2});}catch(e){negative=(e as {code:string}).code;}\n    return {name:f.name,unsignedHex:r.unsignedHex,bodyHex:r.review.bodyHex,txId:r.review.txId,fee:String(r.review.fee),deposit:String(r.review.deposit),negative};});\n   (window as unknown as {proof:unknown}).proof={ok:true,results};\n  }catch(e){(window as unknown as {proof:unknown}).proof={ok:false,error:String(e)};}\n })(); },[]);\n return <main>Private offline SDK construction proof</main>;\n}\n";
function originalIdentity() {
  const files = spawnSync("git", ["ls-files", "-z", "--", "easy1staking/src", "easy1staking/package.json", "easy1staking/package-lock.json", "easy1staking/next.config.mjs", "easy1staking/tsconfig.json", "easy1staking/tailwind.config.ts", "easy1staking/postcss.config.mjs"], { cwd: repo, encoding: "utf8" });
  assert.equal(files.status, 0); const identity = {};
  for (const name of files.stdout.split("\0").filter(Boolean)) {
    const relative = path.relative("easy1staking", name), a = fs.readFileSync(path.join(source, relative)), b = fs.readFileSync(path.join(target, relative));
    assert(a.equals(b), `SOURCE_IDENTITY ${name}`); identity[name] = sha(a);
  }
  return identity;
}
function prepare() {
  const identity = originalIdentity(); assert(!fs.existsSync(route), "Fixture route already exists; clean up explicitly");
  fs.mkdirSync(route, { recursive: true });
  const files = { "inputs.json": JSON.stringify(fixture.cases.map(c => c.input)), "page.tsx": pageSource };
  const generated = Object.entries(files).map(([name, content]) => { const file = path.join(route, name); fs.writeFileSync(file, content); return { file, sha256: sha(Buffer.from(content)) }; });
  fs.writeFileSync(manifest, JSON.stringify({ target, generated, identity }, null, 2)); console.log(`PREPARED ${route}`);
}
function cleanup() {
  const state = JSON.parse(fs.readFileSync(manifest)); assert.equal(state.target, target);
  for (const entry of state.generated) { assert.equal(path.dirname(entry.file), route); assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256, "Refusing to delete changed generated source"); }
  for (const entry of state.generated) fs.unlinkSync(entry.file);
  fs.rmdirSync(route); fs.unlinkSync(manifest); console.log("GENERATED_FIXTURE_REMOVED");
}
function children(pid) {
  let direct; try { direct = fs.readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8").trim().split(/\s+/).filter(Boolean).map(Number); } catch { return []; }
  return direct.flatMap(child => [child, ...children(child)]);
}
async function bind(port = 0) { const s = net.createServer(); s.listen(port, "127.0.0.1"); await once(s, "listening"); const chosen = s.address().port; await new Promise(r => s.close(r)); return chosen; }
async function verify() {
  const report = { status: "RUNNING", source: originalIdentity(), node: process.version, chunks: [], outward: [], errors: [], cleanup: {} };
  const state = JSON.parse(fs.readFileSync(manifest)); assert.equal(state.target, target);
  for (const entry of state.generated) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256, "GENERATED_IDENTITY");
  const dependencyFiles = new Set(["typescript/package.json", "next/package.json", "@evolution-sdk/evolution/package.json", "@noble/hashes/package.json", "effect/package.json"]);
  for (const name of fs.readFileSync(path.join(source, "src/lib/site/delegation/builder.ts"), "utf8").matchAll(/from "(@evolution-sdk[^";]+)"/g)) dependencyFiles.add(path.relative(path.join(target, "node_modules"), require.resolve(name[1], { paths: [target] })));
  dependencyFiles.add(path.relative(path.join(target, "node_modules"), require.resolve("@noble/hashes/blake2.js", { paths: [target] })));
  report.dependencies = Object.fromEntries([...dependencyFiles].sort().map(name => ["node_modules/" + name, sha(fs.readFileSync(path.join(target, "node_modules", name)))]));
  report.tools = { playwright: absolute("playwright"), chromium: absolute("chromium"), node: process.execPath };
  report.buildId = fs.readFileSync(path.join(target, ".next/BUILD_ID"), "utf8").trim();
  const port = await bind(), origin = `http://127.0.0.1:${port}`; report.port = port;
  const env = { PATH: path.dirname(process.execPath) + ":/usr/bin:/bin", HOME: output, NEXT_TELEMETRY_DISABLED: "1" };
  let server, context, failure; const pending = [], profile = path.join(output, "profile");
  assert(!fs.existsSync(profile), "Use an empty owned browser profile");
  try {
    const log = fs.openSync(path.join(output, "server.log"), "w");
    server = spawn(process.execPath, [path.join(target, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: target, env, stdio: ["ignore", log, log] }); fs.closeSync(log); report.serverPid = server.pid;
    let ready = false;
    for (let i = 0; i < 150; i++) {
      assert.equal(server.exitCode, null, "SERVER_EXIT");
      try { const response = await fetch(origin + "/browser-sdk-proof"); if (response.status === 200) { ready = true; break; } } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    assert(ready, "SERVER_READY");
    const { chromium } = require(report.tools.playwright);
    context = await chromium.launchPersistentContext(profile, { executablePath: report.tools.chromium, env, headless: true, serviceWorkers: "block", args: ["--disable-background-networking", "--disable-component-update", "--no-first-run"] });
    report.browser = context.browser().version();
    await context.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (options["deny-client"] && url.pathname === options["deny-client"]) { report.capabilityDenied = { path: url.pathname, sha256: sha(fs.readFileSync(path.join(target, ".next", url.pathname.replace("/_next/", "")))) }; return route.abort(); }
      if (url.origin === origin && request.method() === "GET") return route.continue();
      report.outward.push({ url: request.url(), method: request.method() }); return route.abort();
    });
    await context.addInitScript(() => {
      const effects = [], controls = [], assets = [], originalFetch = window.fetch.bind(window);
      const deny = name => (..._args) => { effects.push(name); throw Error("EFFECT_" + name); };
      window.fetch = (input, init) => { const u = new URL(typeof input === "string" ? input : input.url || String(input), location.href); if (u.origin === location.origin && (!init || !init.method || init.method === "GET")) { assets.push(u.pathname); return originalFetch(input, init); } return deny("fetch")(); };
      window.XMLHttpRequest = function () { return deny("xhr")(); }; window.WebSocket = function () { return deny("socket")(); }; window.EventSource = function () { return deny("events")(); }; navigator.sendBeacon = deny("beacon");
      window.cardano = { fixture: { enable: deny("wallet"), signTx: deny("sign"), submitTx: deny("submit") } };
      for (const key of ["setItem", "removeItem", "clear"]) Storage.prototype[key] = deny("storage");
      Object.defineProperty(window, "indexedDB", { value: { open: deny("indexedDB") } }); window.gtag = deny("analytics");
      const probes = [() => window.fetch("https://invalid.example"), () => new XMLHttpRequest(), () => new WebSocket("wss://invalid.example"), () => new EventSource("https://invalid.example"), () => navigator.sendBeacon("https://invalid.example"), () => window.cardano.fixture.enable(), () => window.cardano.fixture.signTx(), () => window.cardano.fixture.submitTx(), () => localStorage.setItem("probe", "probe"), () => indexedDB.open("probe"), () => window.gtag("probe")];
      for (const probe of probes) { try { probe(); } catch {} controls.push(effects.pop()); }
      window.browserSdkMonitor = { effects, controls, assets };
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(String(error)));
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js")) pending.push((async () => {
        const bytes = await response.body(), name = url.pathname.replace("/_next/", ""), disk = fs.readFileSync(path.join(target, ".next", name));
        assert(bytes.equals(disk), "CLIENT_CHUNK_IDENTITY"); report.chunks.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
      })());
    });
    await page.goto(origin + "/browser-sdk-proof");
    try { await page.waitForFunction(() => window.proof !== undefined, {}, { timeout: 30000 }); } catch { throw Error("BROWSER_CAPABILITY: client fixture did not execute"); }
    report.actual = await page.evaluate(() => ({ proof: window.proof, monitor: window.browserSdkMonitor }));
    await Promise.all(pending);
    assert(report.actual.proof.ok, "BROWSER_CAPABILITY: " + JSON.stringify(report.actual.proof));
    assert.deepEqual(report.actual.monitor.controls, ["fetch", "xhr", "socket", "events", "beacon", "wallet", "sign", "submit", "storage", "indexedDB", "analytics"], "TRIPWIRE_CONTROL");
    assert.deepEqual(report.actual.monitor.effects, [], "OUTWARD_EFFECT"); assert.deepEqual(report.outward, [], "OUTWARD_HTTP"); assert.deepEqual(report.errors, [], "BROWSER_ERRORS");
    assert.equal(report.actual.proof.results.length, fixture.cases.length);
    for (const [index, item] of report.actual.proof.results.entries()) {
      const expected = fixture.cases[index].expected, original = originals.find(v => v.name === item.name);
      assert.equal(item.txId, expected.txId, "BROWSER_BODY_ID");
      for (const field of ["unsignedHex", "bodyHex"]) assert.equal(item[field], original[field], "BROWSER_ORIGINAL_" + field);
      for (const field of ["fee", "deposit"]) assert.equal(item[field], expected[field], "BROWSER_" + field.toUpperCase());
      assert.equal(item.negative, "BINDING", "REAL_GUARD_CHANGED_REVISION");
      const python = spawnSync("python3", ["-c", "import hashlib,sys;print(hashlib.blake2b(bytes.fromhex(sys.argv[1]),digest_size=32).hexdigest())", item.bodyHex], { encoding: "utf8", env });
      assert.equal(python.status, 0); assert.equal(python.stdout.trim(), item.txId, "PYTHON_ORIGINAL_BODY_ID");
    }
    assert(report.chunks.length > 5, "ACTUAL_CLIENT_CHUNKS"); report.status = "PASS";
  } catch (error) { failure = error; report.status = "FAIL"; report.failure = String(error); }
  finally {
    report.childPids = children(process.pid);
    if (context) await context.close();
    if (server) { if (server.exitCode === null) { const exit = once(server, "exit"); server.kill("SIGTERM"); report.cleanup.serverExit = await exit; } else report.cleanup.serverExit = [server.exitCode, server.signalCode]; }
    await Promise.allSettled(pending);
    if (fs.existsSync(profile)) fs.rmSync(profile, { recursive: true });
    const deadline = Date.now() + 5000;
    let alive;
    do { alive = report.childPids.filter(pid => { try { process.kill(pid, 0); return true; } catch { return false; } }); if (alive.length) await new Promise(r => setTimeout(r, 50)); } while (alive.length && Date.now() < deadline);
    report.cleanup.remainingPids = alive; report.cleanup.portRebound = await bind(port); report.cleanup.profileRemoved = !fs.existsSync(profile);
    if (alive.length) { failure ||= Error("CHILD_CLEANUP"); report.status = "FAIL"; }
    fs.writeFileSync(path.join(output, "browser-results.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: report.status, buildId: report.buildId, chunks: report.chunks.length, cleanup: report.cleanup, failure: report.failure, report: path.join(output, "browser-results.json") }, null, 2));
  }
  if (failure) throw failure;
}
(async () => { if (mode === "prepare") prepare(); else if (mode === "verify") await verify(); else if (mode === "cleanup") cleanup(); else throw Error("Use prepare, verify or cleanup"); })().catch(error => { console.error(error); process.exitCode = 1; });
