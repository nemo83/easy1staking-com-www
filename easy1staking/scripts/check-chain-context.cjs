#!/usr/bin/env node
"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { test } = require("node:test"), { after } = require("./lib/node-test-gate.cjs"), { loadDelegationSource, sha256 } = require("./lib/load-delegation-source.cjs");
const fixture = require("./fixtures/chain-context.json"), vectors = require("./fixtures/stake-builder.json").vectors;
let currentFetch, outward = 0, calls = 0; const originalFetch = globalThis.fetch, restores = [];
globalThis.fetch = (...args) => { if (!currentFetch) { outward++; throw Error("FORBIDDEN_HTTP"); } calls++; return currentFetch(...args); };
const loader = loadDelegationSource(), chain = loader.load("chain-context"), json = loader.load("provider-json"), raw = loader.load("source-cbor"), codec = loader.load("wallet-codec"), reader = loader.load("blockfrost-reader");
const builder = loader.load("builder"), guard = loader.load("guard");
const slot = BigInt(fixture.slot), now = 1596059091000 + Number(slot - 4492800n) * 1000;
const clone = structuredClone, id = n => n.toString(16).padStart(64, "0"), address = raw.addressBech32(fixture.addressHex), account = fixture.accountBech32;
assert.equal(raw.stakeBech32(fixture.stakeKeyHash), account, "independent literal reward encoding");
assert.equal(raw.poolBech32(fixture.poolHash), fixture.poolId, "independent literal target encoding");
for (const module of [require("node:net"), require("node:tls"), require("node:http"), require("node:https"), require("node:dgram")]) {
  for (const method of ["connect", "createConnection", "request", "get", "createSocket"]) if (typeof module[method] === "function") {
    const original = module[method]; module[method] = () => { outward++; throw Error("FORBIDDEN_SOCKET"); }; restores.push(() => module[method] = original);
  }
}
for (const name of ["cardano", "localStorage", "sessionStorage"]) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, get() { outward++; throw Error("FORBIDDEN_WALLET_STORAGE"); } });
  restores.push(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
}
function point(s, index = 0) { return { slot: Number(s), block_height: Number(s - 100000000n), block_time: (1596059091000 + Number(s - 4492800n) * 1000) / 1000, block: s === slot ? fixture.tipHash : id(Number(s)), index }; }
function scenario(registered = true) {
  const input = { txId: fixture.fundingId, index: 0n, addressHex: fixture.addressHex, lovelace: 100000000n, assets: {}, datum: null, referenceScript: null };
  const state = { phase: "observed", walletId: "synthetic", revision: 1, acquisitionGeneration: 1, handleGeneration: 1, error: null,
    observation: { binding: codec.bindWallet(1, fixture.addressHex, []), inputs: { complete: true, utxos: [input] }, bindingObservedAt: now, rewardsObservedAt: now, inputsObservedAt: now, finalBindingObservedAt: now } };
  const txs = {}, routes = new Map(), counters = new Map();
  const tx = (hash, at, extra = {}) => { txs[hash] = { hash, valid_contract: true, ...point(at), stake_cert_count: 0, delegation_count: 0, pool_update_count: 0, pool_retire_count: 0, ...extra }; return txs[hash]; };
  tx(fixture.fundingId, slot - 1000n); tx(fixture.poolRegistrationId, slot - 4000n, { pool_update_count: 1 });
  if (registered) tx(fixture.registrationId, slot - 3000n, { stake_cert_count: 1 });
  routes.set("/blocks/latest", { slot: Number(slot), epoch: 664, hash: fixture.tipHash, height: Number(slot - 100000000n), time: now / 1000 });
  routes.set("/epochs/latest", { epoch: 664 });
  routes.set("/epochs/664/parameters", { epoch: 664, protocol_major_ver: 11, protocol_minor_ver: 0, min_fee_a: 44, min_fee_b: 155381, key_deposit: "2000000", coins_per_utxo_size: "4310", max_tx_size: 16384, max_val_size: "5000", a0: 0.3 });
  routes.set("/accounts/" + account, { stake_address: account, registered, active: false, active_epoch: registered ? 664 : null, pool_id: null });
  const history = hash => ({ tx_hash: hash, tx_slot: txs[hash].slot, block_height: txs[hash].block_height, block_time: txs[hash].block_time });
  routes.set("/accounts/" + account + "/registrations", registered ? [{ ...history(fixture.registrationId), action: "registered", deposit: "1000000" }] : []);
  routes.set("/accounts/" + account + "/delegations", []);
  routes.set("/pools/" + fixture.poolHash, { pool_id: fixture.poolId, hex: fixture.poolHash, registration: [fixture.poolRegistrationId], retirement: [], margin_cost: 0.05 });
  routes.set("/pools/" + fixture.poolHash + "/metadata", { pool_id: fixture.poolId, hex: fixture.poolHash, ticker: "EASY1" });
  routes.set("/pools/" + fixture.poolHash + "/updates", [{ tx_hash: fixture.poolRegistrationId, cert_index: 0, action: "registered" }]);
  routes.set("/pools/retired", []); routes.set("/pools/retiring", []);
  routes.set(`/txs/${fixture.poolRegistrationId}/pool_updates`, [{ cert_index: 0, pool_id: fixture.poolId, active_epoch: 664 }]);
  routes.set(`/txs/${fixture.registrationId}/stakes`, [{ cert_index: 0, address: account, registration: true }]);
  const row = { address, tx_hash: input.txId, output_index: 0, tx_index: 999, amount: [{ unit: "lovelace", quantity: input.lovelace.toString() }], block: txs[input.txId].block, data_hash: null, inline_datum: null, reference_script_hash: null };
  routes.set("/addresses/" + address + "/utxos", [row]);
  routes.set(`/txs/${input.txId}/utxos`, { hash: input.txId, inputs: [], outputs: [{ ...clone(row), collateral: false }] });
  const s = { state, routes, txs, counters, tx, history, row, input, clock: now, requested: [], intercept: null, onCall: null };
  s.fetch = async (url, options) => {
    assert.equal(typeof url, "string"); const u = new URL(url); assert.equal(u.origin + "/api/v0", reader.MAINNET_SOURCE);
    assert.equal(options.method, "GET"); assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store"); assert.equal(options.referrerPolicy, "no-referrer");
    assert.deepEqual(Object.keys(options.headers).sort(), ["accept", "project_id"]); assert(options.signal instanceof AbortSignal);
    const p = u.pathname.slice(7), count = (counters.get(p) || 0) + 1; counters.set(p, count); s.requested.push(p); s.onCall?.(p, count);
    let value = routes.has(p) ? routes.get(p) : p.startsWith("/txs/") ? txs[p.slice(5)] : undefined;
    assert.notEqual(value, undefined, "actual requested endpoint must have explicit fixture " + p);
    if (s.intercept) { const result = await s.intercept(p, count, value, options, u); if (result !== undefined) return result; }
    if (Array.isArray(value) && u.searchParams.has("page")) { const page = Number(u.searchParams.get("page")); value = value.slice((page - 1) * 100, page * 100); }
    return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  };
  return s;
}
async function assess(s = scenario(), options = {}) {
  currentFetch = s.fetch;
  try { return await chain.assessChainContext(s.state, "SYNTHETIC_PUBLIC_IDENTIFIER", { runtime: { now: () => s.clock, ...options.runtime }, ...options }); }
  finally { currentFetch = undefined; }
}
async function ready(s = scenario(), options) { const r = await assess(s, options); assert.equal(r.status, "ready", json.canonical(r)); return r; }
function refusal(name, mutate, code) {
  test(name, async () => { const s = scenario(); await mutate(s); const r = await assess(s); if (r.status === "ready") { let builderOutcome = "issued-review"; try { builder.buildStakeTransaction(r.context); } catch (error) { builderOutcome = error.code || "fixed-refusal"; } console.log(JSON.stringify({ controlUnexpectedReady: name, builderOutcome })); } assert.equal(r.status, "refused", "FORBIDDEN_ACCEPTANCE " + name); if (code) assert.equal(r.code, code); });
}
function accountRow(s) { return s.routes.get("/accounts/" + account); }
function params(s) { return s.routes.get("/epochs/664/parameters"); }
function inputRows(s) { return [s.row, s.routes.get(`/txs/${fixture.fundingId}/utxos`).outputs[0]]; }
function delegation(s, pool = fixture.poolId, combined = false) {
  const t = s.txs[fixture.registrationId]; t.delegation_count = 1;
  s.routes.set(`/txs/${fixture.registrationId}/delegations`, [{ cert_index: combined ? 0 : 1, index: 0, address: account, pool_id: pool, active_epoch: 666 }]);
  s.routes.set("/accounts/" + account + "/delegations", [{ ...s.history(fixture.registrationId), pool_id: pool, amount: "0", active_epoch: 666 }]); accountRow(s).pool_id = pool; accountRow(s).active = true;
}
function retirement(s, cancel = false) {
  s.tx(fixture.poolRetirementId, slot - 2000n, { pool_retire_count: 1 });
  s.routes.set(`/txs/${fixture.poolRetirementId}/pool_retires`, [{ cert_index: 0, pool_id: fixture.poolId, retiring_epoch: 666 }]);
  s.routes.get("/pools/" + fixture.poolHash + "/updates").push({ tx_hash: fixture.poolRetirementId, cert_index: 0, action: "deregistered" });
  s.routes.get("/pools/" + fixture.poolHash).retirement.push(fixture.poolRetirementId);
  if (cancel) {
    const cancelId = id(8888); s.tx(cancelId, slot - 1500n, { pool_update_count: 1 });
    s.routes.set(`/txs/${cancelId}/pool_updates`, [{ cert_index: 0, pool_id: fixture.poolId, active_epoch: 665 }]);
    s.routes.get("/pools/" + fixture.poolHash + "/updates").push({ tx_hash: cancelId, cert_index: 0, action: "registered" }); s.routes.get("/pools/" + fixture.poolHash).registration.push(cancelId);
  }
}
for (const registered of [true, false]) test(`actual ${registered ? "registered" : "never-registered"} context builds previous independent literal bytes and issued Review`, async () => {
  const r = await ready(scenario(registered)), c = r.context, v = vectors.find(v => v.registered === registered);
  assert.equal(c.parameters.identity, fixture.parameterIdentity); assert.equal(c.bindingObservedAt, now); assert.equal(c.wallet.observedAt, now);
  const built = builder.buildStakeTransaction(c); assert.equal(built.review.bodyHex, v.bodyHex); assert.equal(built.review.txId, v.txId); guard.validateBeforeSigning(built.review, c);
  assert.throws(() => guard.validateBeforeSigning({ ...built.review }, c));
  assert(Object.isFrozen(r) && Object.isFrozen(c) && Object.isFrozen(c.provider.utxos[0]) && Object.isFrozen(c.provider.utxos[0].assets));
});
test("actual accepted wallet-session produces the consumed immutable observation", async () => {
  const s = scenario(), session = loader.load("wallet-session").createWalletSession(() => ({ enable: async () => ({ getNetworkId: async () => 1, getChangeAddress: async () => fixture.addressHex, getRewardAddresses: async () => [], getUtxos: async () => ["82825820" + fixture.fundingId + "00825839" + fixture.addressHex + "1a05f5e100"] }) }), { now: () => now });
  await session.connect("synthetic"); assert.equal(session.getState().phase, "observed"); s.state = session.getState(); const result = await ready(s); assert.equal(result.context.registration, "registered"); guard.validateBeforeSigning(builder.buildStakeTransaction(result.context).review, result.context); session.dispose();
});

test("known already-EASY1 returns acknowledgment without GuardContext", async () => { const s = scenario(); delegation(s, fixture.poolId, true); const r = await assess(s); assert.equal(r.status, "already-EASY1", json.canonical(r)); assert.equal(r.context, undefined); });
test("combined same-index certificate histories are legitimate", async () => { const s = scenario(); delegation(s, raw.poolBech32(fixture.otherHash), true); assert.equal((await ready(s)).context.currentPoolHash, fixture.otherHash); });
test("future effective pool parameter update cancels previous retirement immediately", async () => { const s = scenario(); retirement(s, true); await ready(s); });
test("formerly deregistered coherent account is known unregistered", async () => {
  const s = scenario(), dereg = id(123); s.tx(dereg, slot - 2000n, { stake_cert_count: 1 }); s.routes.set(`/txs/${dereg}/stakes`, [{ cert_index: 0, address: account, registration: false }]);
  s.routes.get("/accounts/" + account + "/registrations").push({ ...s.history(dereg), action: "deregistered", deposit: null }); accountRow(s).registered = false;
  assert.equal((await ready(s)).context.registration, "unregistered");
});
test("multiple legitimate same-transaction registration actions use certificate order", async () => {
  const s = scenario(), reg = s.routes.get("/accounts/" + account + "/registrations")[0];
  s.routes.set("/accounts/" + account + "/registrations", [reg, { ...reg, action: "deregistered", deposit: null }, { ...reg }]);
  s.txs[fixture.registrationId].stake_cert_count = 3; s.routes.set(`/txs/${fixture.registrationId}/stakes`, [{ cert_index: 0, address: account, registration: true }, { cert_index: 1, address: account, registration: false }, { cert_index: 2, address: account, registration: true }]); await ready(s);
});
test("full input correspondence retains BigInt assets without numeric loss", async () => {
  const s = scenario(), unit = fixture.otherHash + "abcd"; s.input.assets[unit] = 9007199254740993n;
  inputRows(s).forEach(r => r.amount.push({ unit, quantity: "9007199254740993" })); const r = await ready(s);
  assert.equal(r.context.provider.utxos[0].assets[unit], 9007199254740993n); const built = builder.buildStakeTransaction(r.context); guard.validateBeforeSigning(built.review, r.context);
});
for (const datum of ["82005820" + "ab".repeat(32), "8201d818449f1800ff"]) test("original datum correlation " + datum.slice(0, 8), async () => {
  const s = scenario(); s.input.datum = datum; const expected = raw.datumContent(datum); inputRows(s).forEach(r => { r.data_hash = expected.hash; r.inline_datum = expected.inline; }); const r = await ready(s); guard.validateBeforeSigning(builder.buildStakeTransaction(r.context).review, r.context);
});
for (const script of ["9f1800821800581c" + "11".repeat(28) + "ff", "82014100", "82024100", "82034100"]) test("original native/Plutus script hash is corroborated and funding protected " + script.slice(0, 8), async () => {
  const s = scenario(); s.input.referenceScript = "d818" + raw.byteEnvelope(script); assert.equal(raw.referenceHash(s.input.referenceScript), fixture.scriptHashes[script]); inputRows(s).forEach(r => r.reference_script_hash = fixture.scriptHashes[script]);
  const extra = clone(s.input); extra.txId = id(12345); extra.referenceScript = null; s.state.observation.inputs.utxos.push(extra); s.tx(extra.txId, slot - 900n);
  const row = { ...clone(s.row), tx_hash: extra.txId, block: s.txs[extra.txId].block, reference_script_hash: null }; s.routes.get("/addresses/" + address + "/utxos").push(row); s.routes.set(`/txs/${extra.txId}/utxos`, { hash: extra.txId, outputs: [{ ...clone(row), collateral: false }] });
  const r = await ready(s); assert.equal(r.context.provider.utxos.find(i => i.txId === s.input.txId).referenceScript, s.input.referenceScript);
  const b = builder.buildStakeTransaction(r.context); assert.deepEqual(b.review.inputRefs, [extra.txId + "#0"]); guard.validateBeforeSigning(b.review, r.context);
});
function issued(r) { const built = builder.buildStakeTransaction(r.context); guard.validateBeforeSigning(built.review, r.context); return built; }
async function otherwiseRefused(s, name, options, code = "COHERENCE") {
  const r = await assess(s, options);
  if (r.status === "ready") { const b = issued(r); console.log(JSON.stringify({ controlUnexpectedReady: name, builderOutcome: "issued-review-pre-sign-recognized", txId: b.review.txId })); }
  assert.equal(r.status, "refused", "FORBIDDEN_ACCEPTANCE " + name); assert.equal(r.code, code);
}
for (const [name, datum, mismatch] of [
  ["non-null hash datum correspondence", fixture.correspondence.hashDatum, r => r.data_hash = fixture.correspondence.wrongDatumHash],
  ["non-null original inline correspondence", fixture.correspondence.inlineDatum, r => r.inline_datum = fixture.correspondence.differentInline],
]) test(name + " with matching built neighbor", async () => {
  const s = scenario(); s.input.datum = datum; const expected = raw.datumContent(datum);
  inputRows(s).forEach(r => { r.data_hash = expected.hash; r.inline_datum = expected.inline; }); issued(await ready(s));
  inputRows(s).forEach(mismatch); await otherwiseRefused(s, name, undefined, "INPUT");
});
for (const script of Object.keys(fixture.scriptHashes)) test("non-null reference correspondence " + script.slice(0, 8) + " with protected built neighbor", async () => {
  const s = scenario(); s.input.referenceScript = "d818" + raw.byteEnvelope(script); inputRows(s).forEach(r => r.reference_script_hash = fixture.scriptHashes[script]);
  const extra = { ...clone(s.input), txId: id(12345), referenceScript: null }; s.state.observation.inputs.utxos.push(extra); s.tx(extra.txId, slot - 900n);
  const row = { ...clone(s.row), tx_hash: extra.txId, block: s.txs[extra.txId].block, reference_script_hash: null };
  s.routes.get("/addresses/" + address + "/utxos").push(row); s.routes.set(`/txs/${extra.txId}/utxos`, { hash: extra.txId, outputs: [{ ...clone(row), collateral: false }] });
  const built = issued(await ready(s)); assert.deepEqual(built.review.inputRefs, [extra.txId + "#0"]);
  inputRows(s).forEach(r => r.reference_script_hash = fixture.correspondence.wrongReferenceHash);
  await otherwiseRefused(s, "non-null reference correspondence " + script.slice(0, 8), undefined, "INPUT");
});
for (const point of fixture.pointCases) test("complete point relationship " + point.name, async () => {
  const s = scenario(); s.onCall = (p, n) => { if (p === "/blocks/latest" && n === 2) {
    const t = s.routes.get(p); t.slot += point.slot; t.time += point.slot; t.height += point.height; s.clock += point.slot * 1000;
    if (point.hash === "new") t.hash = id(999);
  } };
  if (point.ready) issued(await ready(s)); else await otherwiseRefused(s, point.name);
});
for (const trace of fixture.observedTipTraces) test("observed tip trace " + trace.id, async () => {
  const s = scenario(), t = s.routes.get("/blocks/latest");
  function setPoint(offset, label, height = offset) {
    t.slot = Number(slot) + offset; t.time = now / 1000 + offset; t.height = Number(slot - 100000000n) + height;
    t.hash = label.repeat(64).toLowerCase();
  }
  const priorOf = r => ({ constructionTip: r.context.constructionTip, currentTip: r.context.currentTip, identity: r.provenance.identity });
  let prior, construction;
  if (trace.slots.length === 4) {
    setPoint(trace.slots[0], trace.hashes[0]); const first = await ready(s); issued(first); construction = clone(first.context.constructionTip);
    prior = priorOf(first);
    if (trace.slots[1] !== trace.slots[0] || trace.hashes[1] !== trace.hashes[0]) {
      const malformed = trace.id.startsWith("malformed-prior-");
      s.clock = now + 2000; setPoint(malformed ? 2 : trace.slots[1], malformed ? "B" : trace.hashes[1]);
      const second = await ready(s, { prior }); issued(second); prior = priorOf(second);
      assert.deepEqual(second.context.constructionTip, construction);
      if (malformed) prior = { ...prior, currentTip: { ...prior.currentTip, slot: slot + BigInt(trace.slots[1]), hash: trace.hashes[1].repeat(64).toLowerCase() } };
    }
    if (trace.extraPriorHeights) prior = { ...prior, constructionTip: { ...prior.constructionTip, height: BigInt(trace.extraPriorHeights[0]) }, currentTip: { ...prior.currentTip, height: BigInt(trace.extraPriorHeights[1]) } };
  }
  // All histories/funding are at least 1000 slots earlier. The clock remains
  // monotonic even for a contradictory tip, with every wallet/read age < 30s.
  s.clock = now + 8000;
  let reads = 0; s.onCall = p => { if (p === "/blocks/latest") { const n = trace.slots.length - 2 + reads++; setPoint(trace.slots[n], trace.hashes[n], trace.heights[reads - 1]); } };
  const r = await assess(s, prior ? { prior } : undefined); assert.equal(reads, 2);
  if (r.status === "ready") {
    let builderOutcome;
    try { issued(r); builderOutcome = "issued-review-pre-sign-recognized"; } catch (error) { builderOutcome = error.code || "fixed-refusal"; }
    console.log(JSON.stringify({ observedTipTrace: trace.id, source: "ready", builderOutcome }));
    if (trace.ready) {
      assert.equal(builderOutcome, "issued-review-pre-sign-recognized");
      assert.deepEqual(r.context.constructionTip, construction || { slot: slot + BigInt(trace.slots[0]), hash: trace.hashes[0].repeat(64).toLowerCase(), epoch: 664n, observedAt: now + 8000 });
      assert.equal(r.context.wallet.observedAt, now);
    }
  }
  if (trace.ready) assert.equal(r.status, "ready", json.canonical(r));
  else {
    assert.equal(r.status, "refused", "FORBIDDEN_ACCEPTANCE observed tip trace " + trace.id); assert.equal(r.code, "COHERENCE");
    assert.equal(r.message, new json.SourceError("COHERENCE").message); assert.equal(r.context, undefined); assert.equal(r.provenance, undefined);
  }
});
for (const reused of ["construction", "current"]) test("prior " + reused + " hash cannot identify a new slot", async () => {
  const s = scenario(), initial = await ready(s); issued(initial);
  const t = s.routes.get("/blocks/latest"), priorOf = r => ({ constructionTip: r.context.constructionTip, currentTip: r.context.currentTip, identity: r.provenance.identity });
  s.clock += 1000; t.slot++; t.time++; t.height++; t.hash = id(999);
  const second = await ready(s, { prior: priorOf(initial) }); issued(second);
  s.clock += 1000; t.slot++; t.time++; t.height++; t.hash = reused === "construction" ? fixture.tipHash : id(999);
  await otherwiseRefused(s, "prior " + reused + " reused hash", { prior: priorOf(second) });
});
test("refresh preserves exact original construction tip and permits normal tip progress", async () => {
  const s = scenario(), first = await ready(s), built = builder.buildStakeTransaction(first.context), t = s.routes.get("/blocks/latest");
  s.clock += 1000; t.slot++; t.time++; t.height++; t.hash = id(999);
  const r = await ready(s, { prior: { constructionTip: first.context.constructionTip, currentTip: first.context.currentTip, identity: first.provenance.identity } });
  assert.deepEqual(r.context.constructionTip, first.context.constructionTip); assert.equal(r.context.currentTip.slot, slot + 1n); assert.equal(r.context.wallet.observedAt, now); guard.validateBeforeSigning(built.review, r.context);
});
test("source-produced 24-key context reaches actual builder witness boundary", async () => {
  const s = scenario(); s.state.observation.inputs.utxos = []; s.routes.set("/addresses/" + address + "/utxos", []);
  const outputs = [];
  for (let i = 1; i <= 23; i++) {
    const addr = "01" + i.toString(16).padStart(56, "0") + fixture.stakeKeyHash;
    const input = { ...clone(s.input), index: BigInt(i), addressHex: addr, lovelace: 57000n }; s.state.observation.inputs.utxos.push(input);
    const row = { ...clone(s.row), address: raw.addressBech32(addr), output_index: i, amount: [{ unit: "lovelace", quantity: "57000" }] };
    s.routes.set("/addresses/" + row.address + "/utxos", [row]); outputs.push({ ...row, collateral: false });
  }
  s.routes.set(`/txs/${fixture.fundingId}/utxos`, { hash: fixture.fundingId, outputs });
  const r = await ready(s), built = builder.buildStakeTransaction(r.context); assert.equal(built.review.expectedKeyHashes.length, 24); assert.equal(built.review.inputRefs.length, 23); guard.validateBeforeSigning(built.review, r.context);
});
test("same-slot transactions follow exact block transaction indices", async () => {
  const s = scenario(), dereg = id(123), rereg = id(124), at = slot - 3000n;
  s.tx(dereg, at, { index: 1, stake_cert_count: 1 }); s.tx(rereg, at, { index: 2, stake_cert_count: 1 });
  s.routes.set(`/txs/${dereg}/stakes`, [{ cert_index: 0, address: account, registration: false }]); s.routes.set(`/txs/${rereg}/stakes`, [{ cert_index: 0, address: account, registration: true }]);
  s.routes.get("/accounts/" + account + "/registrations").push({ ...s.history(dereg), action: "deregistered", deposit: null }, { ...s.history(rereg), action: "registered", deposit: "1000000" }); await ready(s);
});
test("independent original inline hash literal", () => assert.equal(raw.datumContent("8201d818449f1800ff").hash, fixture.inlineDatumHash));
test("100 exact membership rows require empty page 2", async () => { const s = scenario(); s.routes.get("/addresses/" + address + "/utxos").push(...Array.from({ length: 99 }, (_, i) => ({ ...clone(s.row), tx_hash: id(1000 + i) }))); await ready(s); assert.equal(s.counters.get("/addresses/" + address + "/utxos"), 2); });
test("source reader bounds actual body stream before allocation", async () => {
  const r = reader.createBlockfrostRead("synthetic"); let cancelled = 0;
  currentFetch = () => new Response(new ReadableStream({ start(c) { c.enqueue(Buffer.alloc(4194305, 32)); }, cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } });
  await assert.rejects(r.get("/blocks/latest"), e => e.code === "LIMIT"); r.close(); currentFetch = undefined; assert.equal(cancelled, 1);
});
test("late headers cannot start body work after cancellation", async () => {
  const s = scenario(), controller = new AbortController(); let reads = 0;
  s.intercept = async p => { if (p !== "/accounts/" + account) return; await new Promise(r => setTimeout(r, 20)); return { redirected: false, url: "", status: 200, headers: new Headers({ "content-type": "application/json" }), get body() { reads++; return new ReadableStream(); } }; };
  setTimeout(() => controller.abort(), 5); const r = await assess(s, { signal: controller.signal }); assert.equal(r.code, "CANCELLED"); await new Promise(r => setTimeout(r, 30)); assert.equal(reads, 0);
});
test("source is re-acquired between operations without cached current views", async () => { const s = scenario(); await ready(s); await ready(s); assert.equal(s.counters.get("/accounts/" + account), 4); assert.equal(s.counters.get("/blocks/latest"), 4); });

refusal("wrong wallet network", s => s.state.observation.binding = { ...s.state.observation.binding, networkId: 0 });
refusal("negative revision", s => s.state.revision = -1, "WALLET");
refusal("duplicate complete-wallet outref", s => s.state.observation.inputs.utxos.push(clone(s.input)));
refusal("same-slot history transaction block mismatch", s => { s.txs[fixture.registrationId].slot = Number(slot); s.txs[fixture.registrationId].block_time = now / 1000; s.txs[fixture.registrationId].block_height = Number(slot - 100000000n); }, "COHERENCE");
refusal("missing observation", s => s.state.observation = null, "WALLET");
refusal("malformed reward binding", s => s.state.observation.binding = { ...s.state.observation.binding, stakeKeyHash: fixture.otherHash });
refusal("incomplete wallet", s => s.state.observation.inputs.complete = false, "WALLET");
refusal("wallet input unknown optional content", s => delete s.input.datum, "WALLET");
refusal("stale wallet read start", s => s.state.observation.inputsObservedAt -= 30001, "STALE");
refusal("future wallet start", s => s.state.observation.finalBindingObservedAt++, "STALE");
refusal("out-of-order wallet read starts", s => s.state.observation.rewardsObservedAt = now - 1, undefined);
refusal("wrong account credential", s => accountRow(s).stake_address = raw.stakeBech32(fixture.otherHash), "COHERENCE");
refusal("active never substitutes for missing registered", s => { delete accountRow(s).registered; accountRow(s).active = true; });
refusal("registered without registration history", s => s.routes.set("/accounts/" + account + "/registrations", []), "COHERENCE");
refusal("false account conflicts with history", s => accountRow(s).registered = false, "COHERENCE");
refusal("current pool conflicts with history", s => accountRow(s).pool_id = fixture.poolId, "COHERENCE");
refusal("duplicate registration row exceeds actual multiplicity", s => s.routes.get("/accounts/" + account + "/registrations").push(clone(s.routes.get("/accounts/" + account + "/registrations")[0])), "COHERENCE");
refusal("wrong certificate account", s => s.routes.get(`/txs/${fixture.registrationId}/stakes`)[0].address = raw.stakeBech32(fixture.otherHash), "COHERENCE");
refusal("registration history wrong position", s => s.routes.get("/accounts/" + account + "/registrations")[0].tx_slot++, "COHERENCE");
refusal("transaction metadata beyond tip", s => s.txs[fixture.registrationId].slot = Number(slot + 1n), "COHERENCE");
refusal("account changed at bracket end", s => s.onCall = (p, n) => { if (p === "/accounts/" + account && n === 2) accountRow(s).registered = false; }, "COHERENCE");
refusal("scheduled retirement blocks", s => retirement(s), "INELIGIBLE");
refusal("effective retirement blocks", s => { retirement(s); s.routes.get(`/txs/${fixture.poolRetirementId}/pool_retires`)[0].retiring_epoch = 664; }, "INELIGIBLE");
refusal("unknown newer pool metadata event", s => s.routes.get("/pools/" + fixture.poolHash).retirement.push(id(123)), "COHERENCE");
refusal("current retiring list disagreement", s => s.routes.set("/pools/retiring", [{ pool_id: fixture.poolId, epoch: 666 }]), "INELIGIBLE");
refusal("pool certificate wrong hash", s => s.routes.get(`/txs/${fixture.poolRegistrationId}/pool_updates`)[0].pool_id = raw.poolBech32(fixture.otherHash), "COHERENCE");
refusal("pool identity wrong", s => s.routes.get("/pools/" + fixture.poolHash).hex = fixture.otherHash, "COHERENCE");
refusal("ticker mismatch", s => s.routes.get("/pools/" + fixture.poolHash + "/metadata").ticker = "OTHER", "COHERENCE");
for (const key of ["min_fee_a", "min_fee_b", "key_deposit", "coins_per_utxo_size", "max_tx_size", "max_val_size", "epoch", "protocol_major_ver", "protocol_minor_ver"]) refusal("required parameter " + key, s => delete params(s)[key], "PARAMETERS");
refusal("unsupported future protocol", s => params(s).protocol_major_ver = 12, "PARAMETERS");
refusal("wrong parameter numeric schema type", s => params(s).min_fee_a = "44", "PARAMETERS");
refusal("wrong parameter string schema type", s => params(s).key_deposit = 2000000, "PARAMETERS");
refusal("no obsolete word-cost fallback", s => { delete params(s).coins_per_utxo_size; params(s).coins_per_utxo_word = "34482"; }, "PARAMETERS");
refusal("parameters changed at end", s => s.onCall = (p, n) => { if (p === "/epochs/664/parameters" && n === 2) params(s).min_fee_a++; }, "COHERENCE");
refusal("epoch changed", s => s.onCall = (p, n) => { if (p === "/epochs/latest" && n === 2) s.routes.get(p).epoch++; }, "COHERENCE");
refusal("same slot different tip hash", s => s.onCall = (p, n) => { if (p === "/blocks/latest" && n === 2) s.routes.get(p).hash = id(999); }, "COHERENCE");
refusal("backwards tip", s => s.onCall = (p, n) => { if (p === "/blocks/latest" && n === 2) { s.routes.get(p).slot--; s.routes.get(p).time--; } }, "COHERENCE");
refusal("tip and slot time disagree", s => s.routes.get("/blocks/latest").time--, "COHERENCE");
refusal("local clock ahead of chain", s => s.clock += 30001, "STALE");
refusal("provider clock moves backwards", s => s.onCall = () => s.clock--);
refusal("missing positive unspent membership", s => s.routes.set("/addresses/" + address + "/utxos", []), "INPUT");
refusal("explicit spent output", s => inputRows(s)[1].consumed_by_tx = id(123), "INPUT");
refusal("provider changed lovelace", s => inputRows(s).forEach(r => r.amount[0].quantity = "100000001"), "INPUT");
refusal("provider changed output index", s => s.row.output_index = 1, "INPUT");
refusal("provider changed address", s => s.row.address = raw.addressBech32("01" + fixture.otherHash + fixture.stakeKeyHash), "INPUT");
// Regression for the SDK address decoder: since Evolution 0.5.10 a valid-bech32 57-byte provider address whose header or prefix does not match is refused by the SDK
// decoder (RESPONSE) before this site's round trip (INPUT) runs. It is refused either way and never accepted; the codes are those observed on 0.5.14.
const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function bech32Of(hrp, hex) {
  const words = []; let acc = 0, bits = 0;
  for (const byte of Buffer.from(hex, "hex")) { acc = (acc << 8 | byte) & 0xffff; bits += 8; while (bits >= 5) { bits -= 5; words.push(acc >> bits & 31); } }
  if (bits > 0) words.push(acc << 5 - bits & 31);
  let check = 1;
  const step = value => { const top = check >>> 25; check = (check & 0x1ffffff) << 5 ^ value; [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3].forEach((g, i) => { if (top >>> i & 1) check ^= g; }); };
  for (const c of hrp) step(c.charCodeAt(0) >> 5); step(0); for (const c of hrp) step(c.charCodeAt(0) & 31);
  for (const w of words) step(w); for (let i = 0; i < 6; i++) step(0);
  const mod = check ^ 1;
  return hrp + "1" + words.map(w => BECH32[w]).join("") + [0, 1, 2, 3, 4, 5].map(i => BECH32[mod >>> 5 * (5 - i) & 31]).join("");
}
test("a provider address with a mismatched header or prefix is refused, never accepted", async () => {
  assert.equal(bech32Of("addr", fixture.addressHex), address, "INDEPENDENT_BECH32");
  const body = fixture.addressHex.slice(2);
  for (const [hrp, header, code] of [["addr", "41", "RESPONSE"], ["addr", "81", "RESPONSE"], ["addr", "c1", "RESPONSE"], ["addr", "51", "RESPONSE"], ["addr", "00", "RESPONSE"],
    ["addr", "11", "RESPONSE"], ["addr1x", "01", "RESPONSE"], ["addr1", "01", "RESPONSE"], ["addr_test", "01", "INPUT"]]) {
    const s = scenario(), mismatched = bech32Of(hrp, header + body); inputRows(s).forEach(r => r.address = mismatched);
    const r = await assess(s);
    assert.equal(r.status, "refused", hrp + " " + header + " " + json.canonical(r)); assert.equal(r.code, code, hrp + " " + header);
  }
});
for (const key of ["data_hash", "inline_datum", "reference_script_hash"]) refusal("missing explicit provider optional " + key, s => delete s.row[key]);
refusal("unobserved provider datum", s => s.row.data_hash = id(123), "INPUT");
refusal("unknown reference script hash", s => s.row.reference_script_hash = fixture.otherHash, "INPUT");
refusal("duplicate native asset unit", s => inputRows(s).forEach(r => r.amount.push({ ...r.amount[0] })), "INPUT");
refusal("no missing lovelace defaults", s => inputRows(s).forEach(r => r.amount = []), "INPUT");
refusal("negative value", s => inputRows(s).forEach(r => r.amount[0].quantity = "-1"));
refusal("fractional currency string", s => inputRows(s).forEach(r => r.amount[0].quantity = "100000000.0"));
refusal("complete empty inputs yields no usable context", s => s.state.observation.inputs.utxos = [], "NO_FUNDS");
for (const status of [400, 401, 403, 404, 418, 429, 500]) refusal("valid account body HTTP" + status + " is never registration evidence", s => s.intercept = p => p === "/accounts/" + account ? new Response(JSON.stringify(accountRow(s)), { status, headers: { "content-type": "application/json" } }) : undefined);
for (const [name, response] of [["wrong content type", () => new Response("{}", { headers: { "content-type": "text/html" } })], ["invalid UTF8", () => new Response(new Uint8Array([0xc0, 0xaf]), { headers: { "content-type": "application/json" } })], ["trailing JSON", () => new Response("{}x", { headers: { "content-type": "application/json" } })], ["invalid length", () => new Response("{}", { headers: { "content-type": "application/json", "content-length": "NaN" } })]]) refusal(name, s => s.intercept = p => p === "/accounts/" + account ? response() : undefined);
refusal("redirected response", s => s.intercept = p => { if (p !== "/accounts/" + account) return; const r = new Response("{}", { headers: { "content-type": "application/json" } }); Object.defineProperty(r, "redirected", { value: true }); return r; }, "RESPONSE");
refusal("unsafe numeric lexeme cannot round into valid coefficient", s => s.intercept = p => p === "/epochs/664/parameters" ? new Response(JSON.stringify(params(s)).replace('"min_fee_a":44', '"min_fee_a":44.0000000000000000000000001'), { headers: { "content-type": "application/json" } }) : undefined, "PARAMETERS");
test("lossless numeric lexemes and harmless unused decimal", () => { const p = json.parseProviderJson('{"integer":9007199254740993,"unused":0.05}'); assert.equal(json.integer(p.integer, 9223372036854775807n), 9007199254740993n); assert.equal(p.unused.lexeme, "0.05"); });
for (const [name, input] of [["decoded duplicate keys", '{"a":0,"\\u0061":1}'], ["prototype alias duplicate", '{"__proto__":0,"__proto__":1}'], ["trailing comma", '[0,]'], ["leading zero", '01'], ["unterminated string", '"x'], ["illegal escape", '"\\x"']]) test("JSON refuses " + name, () => assert.throws(() => json.parseProviderJson(input), json.SourceError));
test("prototype-shaped keys are inert own data", () => { const p = json.parseProviderJson('{"__proto__":{"polluted":true}}'); assert.equal(Object.getPrototypeOf(p), null); assert.equal({}.polluted, undefined); });
for (const [name, supported, excessive] of [
  ["depth", () => '['.repeat(32) + '0' + ']'.repeat(32), () => '['.repeat(33) + '0' + ']'.repeat(33)],
  ["entries", () => '[' + Array(8192).fill('0').join(',') + ']', () => '[' + Array(8193).fill('0').join(',') + ']'],
  ["string", () => JSON.stringify('x'.repeat(262144)), () => JSON.stringify('x'.repeat(262145))],
  ["nodes", () => '[' + Array(16).fill('[' + Array(8190).fill('0').join(',') + ']').join(',') + ']', () => '[' + Array(16).fill('[' + Array(8192).fill('0').join(',') + ']').join(',') + ']'],
  ["bytes", () => '0' + ' '.repeat(4194303), () => '0' + ' '.repeat(4194304)],
]) test("otherwise-valid JSON resource " + name + " supported neighbor and excessive", () => { json.parseProviderJson(supported()); assert.throws(() => json.parseProviderJson(excessive()), json.SourceError, "FORBIDDEN_ACCEPTANCE " + name); });
test("input membership pagination 100/101 rows reaches complete short page", async () => {
  const s = scenario(), rows = s.routes.get("/addresses/" + address + "/utxos"); rows.unshift(...Array.from({ length: 100 }, (_, i) => ({ ...clone(s.row), tx_hash: id(1000 + i) })));
  await ready(s); assert.equal(s.counters.get("/addresses/" + address + "/utxos"), 2);
});
refusal("repeated membership pages never establish full provenance", s => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ ...clone(s.row), tx_hash: id(1000 + i) })); rows[0] = s.row;
  s.routes.set("/addresses/" + address + "/utxos", rows); s.intercept = (p, n) => p === "/addresses/" + address + "/utxos" && n === 2 ? new Response(JSON.stringify(rows.slice(0, 1)), { headers: { "content-type": "application/json" } }) : undefined;
}, "COHERENCE");
refusal("history pagination failure after valid first page stays unknown", s => {
  s.routes.set("/accounts/" + account + "/registrations", Array.from({ length: 100 }, () => clone(s.routes.get("/accounts/" + account + "/registrations")[0])));
  s.intercept = (p, n) => p.endsWith("/registrations") && n === 2 ? new Response("[]", { status: 429, headers: { "content-type": "application/json" } }) : undefined;
}, "QUOTA");
test("delayed well-formed body succeeds within deadline", async () => {
  const s = scenario(); s.intercept = p => p === "/accounts/" + account ? new Response(new ReadableStream({ start(c) { setTimeout(() => { c.enqueue(Buffer.from(JSON.stringify(accountRow(s)))); c.close(); }, 5); } }), { headers: { "content-type": "application/json" } }) : undefined;
  await ready(s, { runtime: { now: () => s.clock, readTimeoutMs: 100 } });
});
for (const exposed of [true, false]) test("decoded compressed-semantic body accepts bounded wire hint; encoding exposed=" + exposed, async () => {
  const s = scenario(); s.intercept = p => { if (p !== "/accounts/" + account) return; const headers = { "content-type": "application/json", "content-length": "17", ...(exposed ? { "content-encoding": "gzip" } : {}) }; const response = new Response(JSON.stringify(accountRow(s)), { headers }); assert(Buffer.byteLength(JSON.stringify(accountRow(s))) > 17); return response; }; await ready(s);
});

test("headers do not disable real default ten-second body deadline", { timeout: 12000 }, async () => {
  const s = scenario(); let cancelled = 0; s.intercept = p => p === "/accounts/" + account ? new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } }) : undefined;
  const start = Date.now(), r = await assess(s); assert.equal(r.code, "TIMEOUT"); assert(Date.now() - start >= 9900 && Date.now() - start < 11500); assert.equal(cancelled, 1);
});
test("late well-formed body cannot publish past shorter body deadline", async () => {
  const s = scenario(); let aborted = false; s.intercept = (p, n, v, options) => p === "/accounts/" + account ? new Response(new ReadableStream({ start(c) { options.signal.addEventListener("abort", () => aborted = true); setTimeout(() => { try { c.enqueue(Buffer.from(JSON.stringify(v))); c.close(); } catch {} }, 40); } }), { headers: { "content-type": "application/json" } }) : undefined;
  const r = await assess(s, { runtime: { now: () => s.clock, readTimeoutMs: 10 } }); assert.equal(r.code, "TIMEOUT"); await new Promise(r => setTimeout(r, 50)); assert(aborted); assert.equal(r.status, "refused");
});
test("total deadline includes multiple individually healthy delayed reads", async () => {
  const s = scenario(); s.intercept = async (p, n, v) => { await new Promise(r => setTimeout(r, 4)); return new Response(JSON.stringify(v), { headers: { "content-type": "application/json" } }); };
  const r = await assess(s, { runtime: { now: () => s.clock, readTimeoutMs: 100, totalTimeoutMs: 15 } }); assert.equal(r.code, "TIMEOUT");
});
test("external cancellation aborts body and discards late results", async () => {
  const s = scenario(), controller = new AbortController(); let cancelled = 0;
  s.intercept = p => p === "/accounts/" + account ? new Response(new ReadableStream({ start() { setTimeout(() => controller.abort(), 5); }, cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } }) : undefined;
  const r = await assess(s, { signal: controller.signal }); assert.equal(r.code, "CANCELLED"); assert.equal(cancelled, 1);
});
test("no HTTP on reader construction and no caller path/network override", async () => {
  let requests = 0; currentFetch = () => { requests++; throw Error("HTTP"); }; const r = reader.createBlockfrostRead("opaque-browser-id"); assert.equal(requests, 0); await assert.rejects(r.get("https://elsewhere.invalid")); r.close(); currentFetch = undefined;
});
test("fixed errors exclude raw provider exceptions and identifier", async () => { const s = scenario(); s.fetch = () => { throw Error("RAW_CANARY_IDENTIFIER_PAYLOAD"); }; const r = await assess(s); assert.equal(r.code, "TRANSPORT"); assert(!JSON.stringify(r).includes("CANARY")); });
test("reader and assessment preserve healthy fixed-code callback failures", async () => {
  const r = reader.createBlockfrostRead("synthetic"); currentFetch = () => { throw new json.SourceError("QUOTA"); };
  try { await assert.rejects(r.get("/blocks/latest"), e => e.code === "QUOTA" && e.message === new json.SourceError("QUOTA").message); }
  finally { r.close(); currentFetch = undefined; }
  const s = scenario(); Object.defineProperty(s.state, "phase", { get() { throw new json.SourceError("QUOTA"); } });
  const result = await assess(s); assert.deepEqual(result, { status: "refused", code: "QUOTA", message: new json.SourceError("QUOTA").message });
});
test("public reader never exposes its retained timeout error object", async () => {
  const response = new Response(new ReadableStream(), { headers: { "content-type": "application/json" } });
  const r = reader.createBlockfrostRead("synthetic", undefined, { now: () => now, readTimeoutMs: 100, totalTimeoutMs: 5 }); currentFetch = () => response;
  try {
    await assert.rejects(r.get("/blocks/latest"), e => { assert.equal(e.code, "TIMEOUT"); e.message = "SYNTHETIC_RETAINED_ERROR_PAYLOAD"; e.code = "SYNTHETIC_RETAINED_CODE"; return true; });
    await assert.rejects(r.get("/blocks/latest"), e => e.code === "TIMEOUT" && e.message === new json.SourceError("TIMEOUT").message);
    assert.throws(() => r.check(), e => e.code === "TIMEOUT" && e.message === new json.SourceError("TIMEOUT").message);
  } finally { r.close(); currentFetch = undefined; }
});
for (const kind of ["tampered-known", "unknown-code", "non-string-code", "throwing-code", "single-code-read"]) {
  function suppliedError() {
    const error = new json.SourceError("QUOTA"); error.message = "SYNTHETIC_ERROR_PAYLOAD"; error.cause = "SYNTHETIC_ERROR_CAUSE"; let reads = 0;
    if (kind !== "tampered-known") Object.defineProperty(error, "code", { get() {
      reads++; if (kind === "throwing-code") throw Error("SYNTHETIC_CODE_GETTER");
      return kind === "single-code-read" ? reads === 1 ? "QUOTA" : "SYNTHETIC_ERROR_PAYLOAD" : kind === "non-string-code" ? { toString() { throw Error("SYNTHETIC_COERCION"); } } : "SYNTHETIC_ERROR_PAYLOAD";
    } });
    return { error, reads: () => reads };
  }
  function fixedResult(value, expected) {
    assert.equal(value.code, expected); assert.equal(value.message, new json.SourceError(expected).message);
    assert(!JSON.stringify(value).includes("SYNTHETIC_")); assert.equal(value.cause, undefined);
  }
  const known = kind === "tampered-known" || kind === "single-code-read";
  test("reader fixed error boundary " + kind, async () => {
    const supplied = suppliedError(), r = reader.createBlockfrostRead("synthetic"); currentFetch = () => { throw supplied.error; };
    try { await assert.rejects(r.get("/blocks/latest"), error => { fixedResult(error, known ? "QUOTA" : "TRANSPORT"); assert.notEqual(error, supplied.error); return true; }); }
    finally { r.close(); currentFetch = undefined; }
    assert.equal(supplied.reads(), kind === "tampered-known" ? 0 : 1);
  });
  test("assessment fixed error boundary " + kind, async () => {
    const supplied = suppliedError(), s = scenario(); Object.defineProperty(s.state, "phase", { get() { throw supplied.error; } });
    const r = await assess(s); assert.equal(r.status, "refused"); fixedResult(r, known ? "QUOTA" : "RESPONSE");
    assert.equal(supplied.reads(), kind === "tampered-known" ? 0 : 1);
  });
  test("public reader clock fixed error boundary " + kind, () => {
    const supplied = suppliedError();
    assert.throws(() => reader.createBlockfrostRead("synthetic", undefined, { now() { throw supplied.error; } }), error => {
      fixedResult(error, known ? "QUOTA" : "STALE"); assert.notEqual(error, supplied.error); return true;
    });
    assert.equal(supplied.reads(), kind === "tampered-known" ? 0 : 1);
  });
  test("clock callback fixed error boundary " + kind, async () => {
    const supplied = suppliedError(), s = scenario(), r = await assess(s, { runtime: { now() { throw supplied.error; } } });
    assert.equal(r.status, "refused"); fixedResult(r, known ? "QUOTA" : "STALE"); assert.equal(supplied.reads(), kind === "tampered-known" ? 0 : 1);
  });
}
test("missing configuration performs zero calls", async () => { const s = scenario(), before = calls; currentFetch = s.fetch; const r = await chain.assessChainContext(s.state, ""); currentFetch = undefined; assert.equal(r.code, "CONFIGURATION"); assert.equal(calls, before); });
after(() => {
  assert.equal(outward, 0); globalThis.fetch = originalFetch; restores.forEach(f => f());
  const identity = loader.identity(); loader.close();
  const emit = process.argv.indexOf("--emit"); if (emit !== -1) {
    const dir = process.argv[emit + 1]; assert(path.isAbsolute(dir) && fs.statSync(dir).isDirectory());
    fs.writeFileSync(path.join(dir, "chain-context-identity.json"), JSON.stringify({ ...identity, fixtureSha256: sha256(fs.readFileSync(path.join(__dirname, "fixtures/chain-context.json"))), runnerSha256: sha256(fs.readFileSync(__filename)), outward, controlledFetchCalls: calls }, null, 2) + "\n");
  }
  console.log(JSON.stringify({ productionModules: identity.production.length, loadedDependencies: identity.dependencies.length, outward, controlledFetchCalls: calls, fixtureSha256: sha256(JSON.stringify(fixture)) }));
});
