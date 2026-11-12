#!/usr/bin/env node
"use strict";
// Read-only recovery status verifier over the actual production modules, with a controlled clock, an in-memory
// storage-only window and real Node Web Locks. Wallet, socket and unscripted HTTP access fail and are counted.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), { spawnSync } = require("node:child_process");
const { test } = require("node:test"), { after } = require("./lib/node-test-gate.cjs"), { loadDelegationSource, sha256 } = require("./lib/load-delegation-source.cjs");
const fixture = require("./fixtures/recovery-verifier.json"), vectors = require("./fixtures/stake-builder.json").vectors, chain = require("./fixtures/chain-context.json");
let now = 0, currentFetch, outward = 0, calls = 0, walletAccess = 0; const nativeNow = Date.now, originalFetch = globalThis.fetch, restores = [];
Date.now = () => now; restores.push(() => { Date.now = nativeNow; });
globalThis.fetch = (...args) => { if (!currentFetch) { outward++; throw Error("FORBIDDEN_HTTP"); } calls++; return currentFetch(...args); };
for (const module of [require("node:net"), require("node:tls"), require("node:http"), require("node:https"), require("node:dgram")]) {
  for (const method of ["connect", "createConnection", "request", "get", "createSocket"]) if (typeof module[method] === "function") {
    const original = module[method]; module[method] = () => { outward++; throw Error("FORBIDDEN_SOCKET"); }; restores.push(() => module[method] = original);
  }
}
const store = new Map(), KEY = "easy1staking:delegation-recovery";
const localStorage = Object.freeze({ getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => { store.set(key, String(value)); }, removeItem: key => { store.delete(key); } });
globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
for (const target of [globalThis.window, globalThis]) Object.defineProperty(target, "cardano", { configurable: true, get() { walletAccess++; throw Error("FORBIDDEN_WALLET"); } });
restores.push(() => { delete globalThis.window; delete globalThis.cardano; });
const loader = loadDelegationSource(), coordination = loader.load("coordination"), verifierModule = loader.load("recovery-verifier"), raw = loader.load("source-cbor");
const clone = structuredClone, ZERO_TIME = 1596059091000n, S0 = BigInt(fixture.baseSlot), TTL = S0 + 600n, INDEX = fixture.transactionIndex;
const registered = vectors.find(v => v.registered), unregistered = vectors.find(v => !v.registered), A = registered.stakeKeyHash, POOL = registered.targetPoolHash;
const account = chain.accountBech32, otherPool = raw.poolBech32(fixture.otherPoolHash), id = n => BigInt(n).toString(16).padStart(64, "0");
assert.equal(raw.stakeBech32(A), account, "independent literal reward encoding"); assert.equal(raw.poolBech32(POOL), chain.poolId, "independent literal target encoding");
assert.equal(BigInt(registered.ttl), TTL, "accepted vector TTL is construction tip + 600");
function pythonHash(hex) { const r = spawnSync("python3", ["-c", "import sys,hashlib;print(hashlib.blake2b(bytes.fromhex(sys.stdin.read()),digest_size=32).hexdigest())"], { input: hex, encoding: "utf8" }); assert.equal(r.status, 0); return r.stdout.trim(); }
assert.equal(pythonHash(registered.bodyHex), registered.txId); assert.equal(pythonHash(unregistered.bodyHex), unregistered.txId);
const timeAt = slot => Number(ZERO_TIME + (slot - 4492800n) * 1000n), epochOf = slot => Number(208n + (slot - 4492800n) / 432000n);
const point = slot => ({ slot: Number(slot), height: Number(slot - 100000000n), time: timeAt(slot) / 1000, hash: id(slot) });
const tip = slot => ({ slot: Number(slot), epoch: epochOf(slot), hash: id(slot), height: Number(slot - 100000000n), time: timeAt(slot) / 1000 });
const cred = (hash = A, kind = "00") => "82" + kind + "581c" + hash;
const certs = { "2": (h = A, p = POOL) => "8302" + cred(h) + "581c" + p, "7": (h = A, d = "1a001e8480") => "8307" + cred(h) + d, "11": (h = A, d = "1a001e8480") => "840b" + cred(h) + "581c" + POOL + d,
  "0": () => "8200" + cred(), "9": () => "8309" + cred() + "8200581c" + "ee".repeat(28), script: () => "8302" + cred(A, "01") + "581c" + POOL };
function withCerts(list, base = registered.bodyHex) {
  const at = base.indexOf("04d90102"); assert(at > 0 && base.indexOf("04d90102", at + 1) === -1 && base.endsWith("0f01"), "unique certificate segment");
  return base.slice(0, at) + "04d90102" + (0x80 + list.length).toString(16) + list.join("") + "0f01";
}
assert.equal(withCerts([certs["2"]()]), registered.bodyHex, "independent [2] encoding reproduces the accepted body");
assert.equal(withCerts([certs["11"]()], unregistered.bodyHex), unregistered.bodyHex, "independent [11] encoding reproduces the accepted body");
const NOT_FOUND = Symbol("404"), seenReasons = new Set(), seenOutcomes = new Set();
function scenario(shape = "2", options = {}) {
  const body = options.body ?? (shape === "2" ? registered.bodyHex : shape === "11" ? unregistered.bodyHex : withCerts([certs["7"](), certs["2"]()]));
  const txId = options.txId ?? pythonHash(body), registration = shape !== "2", tipSlot = options.tipSlot ?? S0 + BigInt(fixture.tipOffset);
  const slot = options.slot ?? S0 + BigInt(fixture.inclusionOffset), p = { ...point(slot), ...(options.point || {}) };
  now = timeAt(tipSlot) + 500;
  const s = { txId, shape, registration, tips: [tip(tipSlot)], missing: new Set(), counters: new Map(), requested: [], posts: 0, onCall: null, p };
  s.content = { hash: txId, block: p.hash, block_height: p.height, block_time: p.time, slot: p.slot, index: INDEX, output_amount: [{ unit: "lovelace", quantity: "97826843" }],
    fees: "173157", deposit: registration ? "2000000" : "0", size: 405, invalid_before: null, invalid_hereafter: TTL.toString(), utxo_count: 2, withdrawal_count: 0, mir_cert_count: 0,
    delegation_count: 1, stake_cert_count: registration ? 1 : 0, pool_update_count: 0, pool_retire_count: 0, asset_mint_or_burn_count: 0, redeemer_count: 0, valid_contract: true, treasury_donation: "0" };
  s.cbor = { cbor: "84" + body + fixture.witnessHex + "f5f6" };
  const d = shape === "7,2" ? 1 : 0;
  s.delegationRows = [{ index: d, cert_index: d, address: account, pool_id: chain.poolId, active_epoch: epochOf(slot) + 2 }];
  s.stakeRows = [{ cert_index: 0, address: account, registration: true }];
  s.block = () => ({ time: p.time, height: p.height, hash: p.hash, slot: p.slot, epoch: epochOf(BigInt(p.slot)), epoch_slot: 1, slot_leader: chain.poolId, size: 1024, tx_count: 4, output: "1",
    fees: "1", block_vrf: "vrf_vk1" + "q".repeat(58), op_cert: "ab".repeat(32), op_cert_counter: "1", previous_block: id(p.slot - 1), next_block: null, confirmations: s.tips[0].height - p.height });
  s.account = { stake_address: account, active: true, registered: true, active_epoch: epochOf(slot) + 2, controlled_amount: "97826843", rewards_sum: "0", withdrawals_sum: "0",
    reserves_sum: "0", treasury_sum: "0", withdrawable_amount: "0", pool_id: chain.poolId, drep_id: null };
  const history = q => ({ tx_slot: q.slot, block_time: q.time, block_height: q.height });
  s.history = history;
  s.delegationHistory = [{ active_epoch: epochOf(slot) + 2, tx_hash: txId, amount: "97826843", pool_id: chain.poolId, ...history(p) }];
  s.registrationHistory = registration ? [{ tx_hash: txId, action: "registered", deposit: "2000000", ...history(p) }]
    : [{ tx_hash: fixture.priorRegistrationId, action: "registered", deposit: "2000000", ...history(point(slot - 3000n)) }];
  s.extra = new Map();
  s.route = path => {
    if (path === "/blocks/latest") return s.tips[Math.min((s.counters.get(path) || 1) - 1, s.tips.length - 1)];
    const routes = { ["/txs/" + txId]: s.content, [`/txs/${txId}/cbor`]: s.cbor, [`/txs/${txId}/delegations`]: s.delegationRows, [`/txs/${txId}/stakes`]: s.stakeRows,
      ["/blocks/" + p.hash]: s.block(), ["/accounts/" + account]: s.account, ["/accounts/" + account + "/delegations"]: s.delegationHistory, ["/accounts/" + account + "/registrations"]: s.registrationHistory };
    return s.extra.has(path) ? s.extra.get(path) : routes[path];
  };
  s.fetch = async (url, options) => {
    const u = new URL(url); assert.equal(u.origin + "/api/v0", "https://cardano-mainnet.blockfrost.io/api/v0");
    if (options.method !== "GET") { s.posts++; throw Error("FORBIDDEN_POST"); }
    assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store"); assert.equal(options.referrerPolicy, "no-referrer");
    const p = u.pathname.slice(7), count = (s.counters.get(p) || 0) + 1; s.counters.set(p, count); s.requested.push(p);
    if (s.onCall) { const result = await s.onCall(p, count, options); if (result !== undefined) return result; }
    let value = s.missing.has(p) ? NOT_FOUND : s.route(p);
    assert.notEqual(value, undefined, "actual requested endpoint must have explicit fixture " + p);
    if (value === NOT_FOUND) return new Response('{"status_code":404,"error":"Not Found","message":"SYNTHETIC_PRIVATE_CANARY"}', { status: 404, headers: { "content-type": "application/json" } });
    if (Array.isArray(value) && u.searchParams.has("page")) { const page = Number(u.searchParams.get("page")); value = value.slice((page - 1) * 100, page * 100); }
    return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  };
  s.record = { schemaVersion: 1, networkId: 1, poolId: chain.poolId, txId, invalidHereafterSlot: TTL.toString(), inputRefs: [registered.inputId + "#0"], createdAt: fixture.createdAt, stage: "submitted" };
  s.recordJson = JSON.stringify(s.record); store.clear(); store.set(KEY, s.recordJson);
  return s;
}
function laterTx(s, hash, slot, extra = {}) {
  const q = { ...point(slot), ...(extra.point || {}) };
  s.extra.set("/txs/" + hash, { hash, block: q.hash, block_height: q.height, block_time: q.time, slot: q.slot, index: extra.index ?? 0, valid_contract: true, delegation_count: 0, stake_cert_count: 0,
    withdrawal_count: 0, mir_cert_count: 0, pool_update_count: 0, pool_retire_count: 0, asset_mint_or_burn_count: 0, redeemer_count: 0, ...(extra.content || {}) });
  return q;
}
function laterDelegation(s, { hash = fixture.laterId, slot = s.p.slot + 5, pools = [otherPool], index = 0, point: override } = {}) {
  const q = laterTx(s, hash, BigInt(slot), { index, point: override, content: { delegation_count: pools.length } });
  s.extra.set(`/txs/${hash}/delegations`, pools.map((pool, i) => ({ index: i, cert_index: i, address: account, pool_id: pool, active_epoch: epochOf(BigInt(slot)) + 2 })));
  for (const pool of pools) s.delegationHistory.push({ active_epoch: epochOf(BigInt(slot)) + 2, tx_hash: hash, amount: "97826843", pool_id: pool, ...s.history(q) });
  s.delegationHistory.sort((a, b) => a.tx_slot - b.tx_slot);
  s.account.pool_id = pools[pools.length - 1];
}
function laterRegistration(s, { hash, slot, registration }) {
  const q = laterTx(s, hash, BigInt(slot), { content: { stake_cert_count: 1, deposit: registration ? "2000000" : "0" } });
  s.extra.set(`/txs/${hash}/stakes`, [{ cert_index: 0, address: account, registration }]);
  s.registrationHistory.push({ tx_hash: hash, action: registration ? "registered" : "deregistered", deposit: registration ? "2000000" : null, ...s.history(q) });
  s.registrationHistory.sort((a, b) => a.tx_slot - b.tx_slot);
  s.account.registered = registration; s.account.pool_id = null;
}
async function check(s, options = {}) {
  const coordinator = coordination.createDelegationCoordinator(), verifier = verifierModule.createRecoveryVerifier(fixture.projectId, coordinator, options.runtime);
  currentFetch = s.fetch;
  try {
    const generation = coordinator.beginStatus();
    const result = await coordinator.withRecoveryOperation(s.txId, async lease => {
      const outcome = await verifier.check(lease, { generation, deadline: options.deadline ?? null, signal: options.signal });
      if (options.inside) return options.inside({ lease, outcome, coordinator, generation });
      if (outcome.status === "confirmed") coordinator.resolveConfirmed(lease, outcome.resolution);
      return outcome;
    });
    return { result, coordinator, verifier };
  } finally { currentFetch = undefined; }
}
function note(result) { seenOutcomes.add(result.status); seenReasons.add(result.reason); }
async function confirmed(s, account = "EASY1") {
  const { result, coordinator } = await check(s); note(result);
  assert.equal(result.status, "confirmed", JSON.stringify(result)); assert.equal(result.reason, "CONFIRMED"); assert.equal(result.credential, A); assert.equal(result.stakeAddress, chain.accountBech32);
  assert.equal(result.account, account); assert.equal(store.has(KEY), false, "CONFIRMED_REMOVES_RECORD"); assert.equal(coordinator.getState().status, "absent");
  assert.equal(await coordinator.withNewOperation(async () => "healthy"), "healthy", "known/candidate reset permits a new operation"); coordinator.dispose(); return result;
}
function outcome(name, mutate, status, reason, shape = "2", options = {}) {
  test(name, async () => {
    const s = options.scenario ? options.scenario() : scenario(shape); await mutate(s);
    const { result, coordinator } = await check(s, options.check); note(result); coordinator.dispose();
    assert.equal(result.status, status, JSON.stringify(result)); assert.equal(result.reason, reason, JSON.stringify(result));
    assert.equal(store.get(KEY), s.recordJson, "RECORD_RETAINED_WITHOUT_CONFIRMATION"); assert.equal(result.resolution, undefined);
  });
}
const rebody = (shape, body) => () => scenario(shape, { body });
// Every accepted certificate shape confirms; the exclusive TTL boundary and an old prior-epoch inclusion confirm.
for (const shape of ["2", "7,2", "11"]) test(`certificate shape [${shape}] confirms and removes only after every read agrees`, async () => {
  const s = scenario(shape), r = await confirmed(s); assert.equal(r.blockHeight, String(s.p.height)); assert.equal(r.confirmations, String(s.tips[0].height - s.p.height));
  for (const p of ["/blocks/latest", "/txs/" + s.txId, `/txs/${s.txId}/cbor`, `/txs/${s.txId}/delegations`, "/blocks/" + s.p.hash, "/accounts/" + account]) assert(s.requested.includes(p), p);
  assert.equal(s.requested.includes(`/txs/${s.txId}/stakes`), shape !== "2"); assert.deepEqual(s.requested.slice(0, 2), ["/blocks/latest", "/txs/" + s.txId], "T1 first");
  assert.equal(s.requested[s.requested.length - 1], "/blocks/latest", "T2 last"); assert.equal(s.posts, 0);
});
test("exclusive TTL: slot = TTL - 1 confirms", async () => { await confirmed(scenario("2", { slot: TTL - 1n, tipSlot: TTL + 10n })); });
outcome("exclusive TTL: slot = TTL is inconsistent", () => {}, "inconsistent", "TX_VALIDITY", "2", { scenario: () => scenario("2", { slot: TTL, tipSlot: TTL + 10n }) });
test("a coherent old prior-epoch inclusion confirms (no freshness or same-epoch rule on historical points)", async () => {
  const s = scenario("2", { tipSlot: S0 + 432000n * 2n }); assert(s.tips[0].epoch > epochOf(BigInt(s.p.slot))); await confirmed(s);
});
// a. T1 and transaction content.
outcome("transaction 404 is not-found and never evidence of absence", s => { s.missing.add("/txs/" + s.txId); }, "not-found", "NOT_FOUND");
outcome("stale T1 is unavailable", s => { now += 31000; }, "unavailable", "TIP");
outcome("content hash differs", s => { s.content.hash = id(9); }, "inconsistent", "TX_IDENTITY");
outcome("valid_contract false", s => { s.content.valid_contract = false; }, "inconsistent", "TX_CONTRACT");
outcome("invalid_hereafter differs from record", s => { s.content.invalid_hereafter = (TTL + 1n).toString(); }, "inconsistent", "TX_VALIDITY");
outcome("invalid_hereafter null", s => { s.content.invalid_hereafter = null; }, "inconsistent", "TX_VALIDITY");
outcome("non-integer block_height is unavailable", s => { s.content.block_height = null; }, "unavailable", "PROVIDER");
outcome("slot/time pair off the mainnet mapping", s => { s.content.block_time += 1; }, "inconsistent", "POINT_FIELDS");
for (const [field, value] of [["delegation_count", 2], ["delegation_count", 0], ["stake_cert_count", 2], ["withdrawal_count", 1], ["pool_update_count", 1], ["pool_retire_count", 1],
  ["asset_mint_or_burn_count", 1], ["redeemer_count", 1], ["mir_cert_count", 1]]) outcome(`count ${field}=${value}`, s => { s.content[field] = value; }, "inconsistent", "TX_COUNTS");
outcome("transaction newer than T1 is pending", s => { Object.assign(s.content, { slot: s.tips[0].slot + 1, block_height: s.tips[0].height + 1, block_time: s.tips[0].time + 1 }); }, "pending", "NEWER_THAN_TIP");
// b. Body bytes.
outcome("cbor 404 after the transaction was found is index lag", s => { s.missing.add(`/txs/${s.txId}/cbor`); }, "pending", "INDEX_LAG");
outcome("malformed cbor", s => { s.cbor.cbor = "84ff"; }, "inconsistent", "BODY_ENCODING");
outcome("auxiliary data present", s => { s.cbor.cbor = s.cbor.cbor.slice(0, -2) + "a0"; }, "inconsistent", "BODY_ENCODING");
outcome("phase-2 invalid flag", s => { s.cbor.cbor = s.cbor.cbor.slice(0, -4) + "f4f6"; }, "inconsistent", "BODY_ENCODING");
const wrongBody = registered.bodyHex.replace("021a0002a389", "021a0002a38a");
test("wrong-body victim differs only in the fee byte; its matching twin confirms", async () => {
  assert.equal(wrongBody.length, registered.bodyHex.length); assert.equal([...wrongBody].filter((c, i) => c !== registered.bodyHex[i]).length, 1);
  assert.equal(wrongBody.replace("021a0002a38a", "021a0002a389"), registered.bodyHex); await confirmed(scenario("2"));
});
outcome("body hashes to another ID (inputs, TTL and certificates match)", s => { s.cbor.cbor = "84" + wrongBody + fixture.witnessHex + "f5f6"; }, "inconsistent", "BODY_ID");
outcome("unsupported body field", () => {}, "inconsistent", "BODY_ENCODING", "2", { scenario: rebody("2", "a7" + registered.bodyHex.slice(2, -4) + "05a0" + "0f01") });
outcome("body inputs differ from the record", () => {}, "inconsistent", "BODY_INPUTS", "2", { scenario: rebody("2", registered.bodyHex.replace("3333".repeat(16) + "00", "3434".repeat(16) + "00")) });
outcome("body has an extra input", () => {}, "inconsistent", "BODY_INPUTS", "2", { scenario: rebody("2", registered.bodyHex.replace("00d9010281825820" + "33".repeat(32) + "00", "00d9010282825820" + "33".repeat(32) + "00825820" + "34".repeat(32) + "01")) });
outcome("body TTL differs from the record", () => {}, "inconsistent", "BODY_TTL", "2", { scenario: rebody("2", registered.bodyHex.replace("031a0c07c638", "031a0c07c639")) });
for (const [name, list] of [["[7] alone", [certs["7"]()]], ["duplicate [2,2]", [certs["2"](), certs["2"]()]], ["[11,2]", [certs["11"](), certs["2"]()]], ["legacy [0,2]", [certs["0"](), certs["2"]()]],
  ["vote-bearing [9]", [certs["9"]()]], ["[2] to another pool", [certs["2"](A, fixture.otherPoolHash)]]]) outcome("certificates " + name, () => {}, "inconsistent", "CERTIFICATES", "2", { scenario: rebody("2", withCerts(list)) });
outcome("script credential", () => {}, "inconsistent", "CREDENTIAL", "2", { scenario: rebody("2", withCerts([certs.script()])) });
outcome("mixed credentials [7 A, 2 B]", () => {}, "inconsistent", "CREDENTIAL", "7,2", { scenario: rebody("7,2", withCerts([certs["7"](), certs["2"](fixture.otherStakeKeyHash)])) });
outcome("[11] explicit deposit differs from tx_content.deposit", () => {}, "inconsistent", "DEPOSIT", "11", { scenario: rebody("11", withCerts([certs["11"](A, "1a002dc6c0")], unregistered.bodyHex)) });
outcome("[7,2] explicit deposit differs from tx_content.deposit", s => { s.content.deposit = "3000000"; }, "inconsistent", "DEPOSIT", "7,2");
outcome("[2] with a non-zero deposit", s => { s.content.deposit = "2000000"; }, "inconsistent", "DEPOSIT");
outcome("[2] with a stake certificate count", s => { s.content.stake_cert_count = 1; }, "inconsistent", "TX_COUNTS");
outcome("[11] without a stake certificate count", s => { s.content.stake_cert_count = 0; }, "inconsistent", "TX_COUNTS", "11");
// c. Certificate rows implied by the body.
outcome("delegation rows not yet indexed", s => { s.delegationRows.length = 0; }, "pending", "INDEX_LAG");
outcome("delegation row to another pool", s => { s.delegationRows[0].pool_id = otherPool; }, "inconsistent", "CERTIFICATE_ROWS");
outcome("delegation row with another cert_index", s => { s.delegationRows[0].cert_index = 1; }, "inconsistent", "CERTIFICATE_ROWS", "11");
outcome("delegation row for another address", s => { s.delegationRows[0].address = raw.stakeBech32(fixture.otherStakeKeyHash); }, "inconsistent", "CERTIFICATE_ROWS");
outcome("two delegation rows", s => { s.delegationRows.push(clone(s.delegationRows[0])); }, "inconsistent", "CERTIFICATE_ROWS");
outcome("[7,2] delegation row at the registration index", s => { s.delegationRows[0].cert_index = 0; }, "inconsistent", "CERTIFICATE_ROWS", "7,2");
outcome("stake rows not yet indexed", s => { s.stakeRows.length = 0; }, "pending", "INDEX_LAG", "11");
outcome("stake row is a deregistration", s => { s.stakeRows[0].registration = false; }, "inconsistent", "CERTIFICATE_ROWS", "11");
// d. Inclusion block.
outcome("block not yet indexed", s => { s.missing.add("/blocks/" + s.p.hash); }, "pending", "INDEX_LAG");
for (const field of ["height", "slot", "time", "hash"]) outcome(`block ${field} differs from the transaction`, s => { const b = s.block; s.block = () => { const v = b(); v[field] = field === "hash" ? id(7) : v[field] + 1; return v; }; }, "inconsistent", "BLOCK_IDENTITY");
// e. Account view and histories.
outcome("account not yet indexed", s => { s.missing.add("/accounts/" + account); }, "pending", "INDEX_LAG");
outcome("delegation history lacks the transaction (incomplete history)", s => { s.delegationHistory.length = 0; }, "pending", "INDEX_LAG");
outcome("delegation history names another pool for the transaction", s => { s.delegationHistory[0].pool_id = otherPool; }, "inconsistent", "HISTORY");
outcome("delegation history places the transaction at another slot", s => { s.delegationHistory[0].tx_slot += 1; }, "inconsistent", "HISTORY");
outcome("delegation history repeats the transaction", s => { s.delegationHistory.push(clone(s.delegationHistory[0])); }, "inconsistent", "HISTORY");
outcome("history out of ascending order", s => { s.delegationHistory.push({ ...clone(s.delegationHistory[0]), tx_hash: id(5), ...s.history(point(BigInt(s.p.slot) - 100n)) }); }, "inconsistent", "HISTORY");
outcome("registration history lacks the transaction", s => { s.registrationHistory.length = 0; }, "pending", "INDEX_LAG", "11");
outcome("registration history deposit differs", s => { s.registrationHistory[0].deposit = "1000000"; }, "inconsistent", "HISTORY", "11");
outcome("registration history names a stake-only [2] transaction", s => { s.registrationHistory.push({ tx_hash: s.txId, action: "registered", deposit: "2000000", ...s.history(s.p) }); }, "inconsistent", "HISTORY");
// f. Later events and account reconciliation.
test("later delegation to another pool confirms with the since-delegated state", async () => { const s = scenario(); laterDelegation(s); assert(s.extra.size > 0); await confirmed(s, "other-pool"); });
test("later deregistration confirms with the since-deregistered state", async () => { const s = scenario(); laterRegistration(s, { hash: fixture.laterId, slot: s.p.slot + 5, registration: false }); await confirmed(s, "deregistered"); });
test("later deregistration then re-registration and EASY1 delegation", async () => {
  const s = scenario(); laterRegistration(s, { hash: id(0x81), slot: s.p.slot + 5, registration: false }); laterRegistration(s, { hash: id(0x82), slot: s.p.slot + 6, registration: true });
  laterDelegation(s, { hash: id(0x83), slot: s.p.slot + 7, pools: [chain.poolId] }); await confirmed(s, "EASY1");
});
outcome("unexplained account view (another pool, no later event)", s => { s.account.pool_id = otherPool; }, "inconsistent", "ACCOUNT");
outcome("unexplained deregistered account view", s => { s.account.registered = false; s.account.pool_id = null; }, "inconsistent", "ACCOUNT");
outcome("account view lags behind a reconstructed later delegation", s => { laterDelegation(s); s.account.pool_id = chain.poolId; }, "inconsistent", "ACCOUNT");
outcome("account view for another stake address", s => { s.account.stake_address = raw.stakeBech32(fixture.otherStakeKeyHash); }, "inconsistent", "ACCOUNT");
test("same block: a later transaction index wins", async () => { const s = scenario(); laterDelegation(s, { slot: s.p.slot, index: INDEX + 2 }); await confirmed(s, "other-pool"); });
test("same block: an earlier transaction index precedes the original", async () => { const s = scenario(); laterDelegation(s, { slot: s.p.slot, index: INDEX - 2 }); s.account.pool_id = chain.poolId; await confirmed(s, "EASY1"); });
outcome("same block: an earlier transaction index cannot explain another pool", s => { laterDelegation(s, { slot: s.p.slot, index: INDEX - 2 }); }, "inconsistent", "ACCOUNT");
test("same transaction: cert_index orders the effect (EASY1 last)", async () => { const s = scenario(); laterDelegation(s, { pools: [otherPool, chain.poolId] }); await confirmed(s, "EASY1"); });
test("same transaction: cert_index orders the effect (other pool last)", async () => { const s = scenario(); laterDelegation(s, { pools: [chain.poolId, otherPool] }); await confirmed(s, "other-pool"); });
outcome("same block and same transaction index is a contradiction", s => { laterDelegation(s, { slot: s.p.slot, index: INDEX }); }, "inconsistent", "LATER_EVENT");
outcome("later transaction not yet indexed", s => { laterDelegation(s); s.missing.add("/txs/" + fixture.laterId); }, "pending", "INDEX_LAG");
outcome("later transaction point differs from its history row", s => { laterDelegation(s); s.extra.get("/txs/" + fixture.laterId).slot += 1; s.extra.get("/txs/" + fixture.laterId).block_time += 1; }, "inconsistent", "LATER_EVENT");
outcome("later delegation count differs from its rows", s => { laterDelegation(s); s.extra.get("/txs/" + fixture.laterId).delegation_count = 2; }, "inconsistent", "LATER_EVENT");
outcome("later failed transaction cannot explain an effect", s => { laterDelegation(s); s.extra.get("/txs/" + fixture.laterId).valid_contract = false; }, "inconsistent", "LATER_EVENT");
outcome("later delegation after a deregistration without re-registration", s => {
  laterRegistration(s, { hash: id(0x91), slot: s.p.slot + 5, registration: false }); laterDelegation(s, { hash: id(0x92), slot: s.p.slot + 6 });
}, "inconsistent", "LATER_EVENT");
outcome("more than 16 later transactions is a limit", s => { for (let i = 0; i < 17; i++) laterDelegation(s, { hash: id(0xa00 + i), slot: s.p.slot + 1 + i }); }, "unavailable", "LIMIT");
test("exactly 16 later transactions are within the limit", async () => { const s = scenario(); for (let i = 0; i < 16; i++) laterDelegation(s, { hash: id(0xa00 + i), slot: s.p.slot + 1 + i }); await confirmed(s, "other-pool"); });
outcome("a later transaction's own rows outnumber its history rows", s => {
  laterDelegation(s); const rows = s.extra.get(`/txs/${fixture.laterId}/delegations`); rows.push({ ...clone(rows[0]), index: 1, cert_index: 1, pool_id: chain.poolId }); s.extra.get("/txs/" + fixture.laterId).delegation_count = 2;
}, "inconsistent", "LATER_EVENT");
test("later deregistration then re-registration without delegation confirms as registered but not delegated", async () => {
  const s = scenario(); laterRegistration(s, { hash: id(0x84), slot: s.p.slot + 5, registration: false }); laterRegistration(s, { hash: id(0x85), slot: s.p.slot + 6, registration: true }); await confirmed(s, "undelegated");
});
// g. T2, live tips and historical points.
outcome("T2 regresses below T1", s => { s.tips.push(tip(BigInt(s.tips[0].slot) - 1n)); }, "unavailable", "TIP");
const atTipHeight = (offset) => () => { const t = S0 + BigInt(fixture.tipOffset), q = point(t - BigInt(offset)); return scenario("2", { slot: t - BigInt(offset), point: { height: Number(t - 100000000n) } }); };
outcome("same-height fork: inclusion at T2's height with another hash and an earlier slot", () => {}, "inconsistent", "POINT_RELATION", "2", { scenario: atTipHeight(5) });
test("same-height fork twin: the same earlier slot at a lower height confirms", async () => { const t = S0 + BigInt(fixture.tipOffset); await confirmed(scenario("2", { slot: t - 5n })); });
outcome("same-slot fork: inclusion at T2's slot with another hash", () => {}, "inconsistent", "POINT_RELATION", "2", { scenario: () => scenario("2", { slot: S0 + BigInt(fixture.tipOffset), point: { hash: id(0xf0) } }) });
outcome("reported confirmations exceed T2", s => { const b = s.block; s.block = () => ({ ...b(), confirmations: b().confirmations + 1 }); }, "inconsistent", "POINT_RELATION");
outcome("reported confirmations below T1", s => { const b = s.block; s.block = () => ({ ...b(), confirmations: b().confirmations - 1 }); }, "inconsistent", "POINT_RELATION");
// Each reconstructed later event is a historical point with its own check against T2. Each case advances the tip (T1 != T2) and places the
// event above T1, so the T1 identity rule cannot also reject it; only the relation against T2 can fail.
outcome("a later event above T2's height", s => { const t1 = s.tips[0]; advance(s); laterDelegation(s, { slot: t1.slot + 5, point: { height: s.tips[1].height + 1 } }); }, "inconsistent", "POINT_RELATION");
outcome("a later event at T2's slot in another block", s => { advance(s); laterDelegation(s, { slot: s.tips[1].slot, point: { hash: id(0xf6) } }); }, "inconsistent", "POINT_RELATION");
outcome("later/T2 tip fork: a later event at T2's height in another block, strictly between T1 and T2", s => {
  const t1 = s.tips[0]; advance(s); const t2 = s.tips[1]; laterDelegation(s, { slot: t1.slot + 5, point: { height: t2.height } }); const q = s.extra.get("/txs/" + fixture.laterId);
  assert(t1.slot < q.slot && q.slot < t2.slot && q.block_height === t2.height && q.block !== t2.hash, "strictly between T1 and T2, at T2's height in another block");
}, "inconsistent", "POINT_RELATION");
// At T2's slot and time but strictly between the tips in height, so the equal-height clause cannot also fail: only the equal-slot clause against T2 rejects it.
outcome("later/T2 equal slot: a later event at T2's slot between the tips in another block", s => {
  const t1 = s.tips[0]; advance(s); const t2 = s.tips[1]; laterDelegation(s, { slot: t2.slot, point: { hash: id(0xe9), height: t1.height + 3 } }); const q = s.extra.get("/txs/" + fixture.laterId);
  assert(q.slot === t2.slot && q.block_time === t2.time && t1.height < q.block_height && q.block_height < t2.height && q.block !== t2.hash, "at T2's slot and time, strictly between the tips in height, in another block");
}, "inconsistent", "POINT_RELATION");
// Historical points are also checked pairwise: the inclusion point and every reconstructed later event.
outcome("original-vs-later same-height fork: a later delegation at the inclusion height, 5 slots on", s => { laterDelegation(s, { slot: s.p.slot + 5, point: { height: s.p.height } }); }, "inconsistent", "POINT_PAIR");
outcome("later-vs-later fork at one height", s => { laterDelegation(s, { hash: id(0xb1), slot: s.p.slot + 5 }); laterDelegation(s, { hash: id(0xb2), slot: s.p.slot + 7, point: { height: s.p.height + 5 } }); }, "inconsistent", "POINT_PAIR");
outcome("later-vs-later same slot in different blocks", s => { laterDelegation(s, { hash: id(0xb3), slot: s.p.slot + 5 }); laterDelegation(s, { hash: id(0xb4), slot: s.p.slot + 5, index: 1, point: { hash: id(0xf5) } }); }, "inconsistent", "POINT_PAIR");
// One block hash names one block, among historical points and against T2. Transaction indexes differ, so only the hash rule can fail.
outcome("original/later: a later event reuses the inclusion hash 5 slots and 5 heights on", s => { laterDelegation(s, { slot: s.p.slot + 5, index: INDEX + 1, point: { hash: s.p.hash } }); }, "inconsistent", "POINT_PAIR");
outcome("later/later: two later events share one hash at different coordinates", s => {
  laterDelegation(s, { hash: id(0xc1), slot: s.p.slot + 5, index: 0 }); laterDelegation(s, { hash: id(0xc2), slot: s.p.slot + 7, index: 1, point: { hash: id(s.p.slot + 5) } });
}, "inconsistent", "POINT_PAIR");
outcome("inclusion/T2: the inclusion block reports T2's hash at a lower slot and height", () => {}, "inconsistent", "POINT_RELATION", "2", { scenario: () => advance(scenario("2", { point: { hash: id(S0 + BigInt(fixture.tipOffset) + BigInt(fixture.tipAdvance)) } })) });
// T1 names one block as well. Each case advances the tip (T1 != T2) so only the T1 rule can fail; T2 keeps its own checks.
const advance = s => { const t2 = tip(BigInt(s.tips[0].slot) + BigInt(fixture.tipAdvance)); s.tips.push(t2); now = timeAt(BigInt(t2.slot)) + 500; return s; };
outcome("inclusion/T1: the inclusion block reports T1's hash at a lower slot and height", () => {}, "inconsistent", "POINT_RELATION", "2", { scenario: () => advance(scenario("2", { point: { hash: id(S0 + BigInt(fixture.tipOffset)) } })) });
outcome("later/T1 hash: a later event reports T1's hash at a lower slot and height", s => { advance(s); laterDelegation(s, { slot: s.p.slot + 5, point: { hash: s.tips[0].hash } }); }, "inconsistent", "POINT_RELATION");
outcome("later/T1 height: a later event at T1's height in another block, after T1's slot", s => { const t1 = s.tips[0]; advance(s); laterDelegation(s, { slot: t1.slot + 5, point: { height: t1.height } }); }, "inconsistent", "POINT_RELATION");
test("advancing tip: a coherent later event included strictly between T1 and T2 confirms", async () => {
  const s = advance(scenario()), [t1, t2] = s.tips; laterDelegation(s, { slot: t1.slot + 5 }); const q = s.extra.get("/txs/" + fixture.laterId);
  assert(t1.slot < q.slot && q.slot < t2.slot && t1.height < q.block_height && q.block_height < t2.height, "strictly between T1 and T2"); await confirmed(s, "other-pool");
});
test("one hash at one point: a later event in the inclusion block at another transaction index confirms", async () => { const s = scenario(); laterDelegation(s, { slot: s.p.slot, index: INDEX + 1, point: { hash: s.p.hash } }); await confirmed(s, "other-pool"); });
function sharedBlock(s, index) {
  // Two later transactions in one block: the second also carries another account's certificate first, so cert_index alone keeps the events ordered.
  laterDelegation(s, { hash: id(0xb5), slot: s.p.slot + 5, index: 2 }); laterDelegation(s, { hash: id(0xb6), slot: s.p.slot + 5, index, pools: [chain.poolId] });
  const rows = s.extra.get(`/txs/${id(0xb6)}/delegations`); rows.unshift({ index: 0, cert_index: 0, address: raw.stakeBech32(fixture.otherStakeKeyHash), pool_id: otherPool, active_epoch: rows[0].active_epoch });
  Object.assign(rows[1], { index: 1, cert_index: 1 }); s.extra.get("/txs/" + id(0xb6)).delegation_count = 2;
}
outcome("two transactions at one block and transaction index", s => { sharedBlock(s, 2); }, "inconsistent", "POINT_PAIR");
test("two transactions in one block at different transaction indexes confirm", async () => { const s = scenario(); sharedBlock(s, 3); await confirmed(s, "EASY1"); });
test("historicalPairs is pure: one block per height, slot and hash, ordered heights, distinct placements", () => {
  const at = (slot, height, hash, txId, index = 0n) => ({ point: { slot, height, time: BigInt(timeAt(slot) / 1000), hash }, txId, index });
  const code = list => { try { verifierModule.historicalPairs(list); return "OK"; } catch (e) { return e.reason; } }, base = 4492800n + 2000000n, x = at(base, 50n, id(1), id(0x11), 3n);
  assert.equal(code([x, at(base + 5n, 55n, id(2), id(0x12))]), "OK"); assert.equal(code([x, at(base, 50n, id(1), id(0x12), 4n)]), "OK", "same block, another index");
  assert.equal(code([x, at(base + 5n, 50n, id(2), id(0x12))]), "POINT_PAIR", "equal height, another block"); assert.equal(code([x, at(base, 51n, id(2), id(0x12))]), "POINT_PAIR", "equal slot, another block");
  assert.equal(code([x, at(base, 50n, id(1), id(0x12), 3n)]), "POINT_PAIR", "two transactions at one block and index"); assert.equal(code([x, at(base + 5n, 49n, id(2), id(0x12))]), "POINT_PAIR", "later slot at a lower height");
  assert.equal(code([x, at(base - 5n, 51n, id(2), id(0x12))]), "POINT_PAIR", "earlier slot at a higher height"); assert.equal(code([x, at(base + 5n, 55n, id(2), id(0x11))]), "POINT_PAIR", "one transaction at two points");
  assert.equal(code([x, at(base + 5n, 55n, id(2), id(0x12)), at(base + 9n, 55n, id(3), id(0x13))]), "POINT_PAIR", "later-vs-later at one height");
  assert.equal(code([x, at(base + 5n, 55n, id(1), id(0x12), 4n)]), "POINT_PAIR", "one hash at two coordinates");
});
test("historicalPoint is pure: fields, then every relation against T2", () => {
  const t = { slot: 2000000n + 4492800n, hash: id(1), epoch: 212n, observedAt: 0, height: 50n, time: BigInt(timeAt(2000000n + 4492800n) / 1000) };
  const ok = { slot: t.slot - 10n, height: 40n, time: t.time - 10n, hash: id(2) }, code = p => { try { verifierModule.historicalPoint(p, t); return "OK"; } catch (e) { return e.reason; } };
  assert.equal(code(ok), "OK"); assert.equal(code({ ...ok, time: ok.time + 1n }), "POINT_FIELDS"); assert.equal(code({ ...ok, hash: "x" }), "POINT_FIELDS");
  assert.equal(code({ ...ok, height: 51n }), "POINT_RELATION"); assert.equal(code({ ...ok, height: 50n }), "POINT_RELATION"); assert.equal(code({ ...t }), "OK");
  assert.equal(code({ ...t, hash: id(3) }), "POINT_RELATION"); assert.equal(code({ ...ok, slot: t.slot + 1n, time: t.time + 1n, height: 49n }), "POINT_RELATION");
  assert.equal(code({ ...ok, hash: t.hash }), "POINT_RELATION", "T2's hash at a lower slot and height");
  assert.equal(code({ ...ok, confirmations: 10n, floor: 50n }), "OK"); assert.equal(code({ ...ok, confirmations: 11n, floor: 50n }), "POINT_RELATION"); assert.equal(code({ ...ok, confirmations: 9n, floor: 50n }), "POINT_RELATION");
  assert.equal(code({ ...ok, slot: ok.slot - 432000n * 3n, time: ok.time - 432000n * 3n }), "OK", "old prior-epoch historical point");
});
test("tipIdentity is pure: one hash, slot and height name the tip's block, ordered alike, with no upper bound", () => {
  const t = { slot: 2000000n + 4492800n, hash: id(1), epoch: 212n, observedAt: 0, height: 50n, time: BigInt(timeAt(2000000n + 4492800n) / 1000) };
  const at = (slot, height, hash) => ({ slot, height, time: BigInt(timeAt(slot) / 1000), hash }), ok = at(t.slot - 10n, 40n, id(2));
  const code = (...points) => { try { verifierModule.tipIdentity(t, points); return "OK"; } catch (e) { return e.reason; } };
  assert.equal(code(), "OK"); assert.equal(code(ok), "OK"); assert.equal(code({ ...t }), "OK", "the tip's own block");
  assert.equal(code(at(t.slot - 10n, 40n, t.hash)), "POINT_RELATION", "equal hash at a lower slot and height");
  assert.equal(code({ ...t, time: t.time + 1n }), "POINT_RELATION", "equal hash, slot and height at another time");
  assert.equal(code(at(t.slot, 51n, id(3))), "POINT_RELATION", "equal slot in another block (heights ordered)");
  assert.equal(code(at(t.slot + 5n, 50n, id(3))), "POINT_RELATION", "equal height in another block (slots ordered)");
  assert.equal(code(at(t.slot - 10n, 51n, id(3))), "POINT_RELATION", "lower slot at a higher height"); assert.equal(code(at(t.slot + 5n, 49n, id(3))), "POINT_RELATION", "higher slot at a lower height");
  assert.equal(code(ok, at(t.slot - 10n, 40n, t.hash)), "POINT_RELATION", "any point of the list");
  const newer = at(t.slot + 5n, 55n, id(4)); assert.equal(code(newer), "OK", "no upper bound: newer in slot and height"); assert.equal(code(at(t.slot + 432000n * 3n, 5000n, id(5))), "OK", "far above the tip");
  assert.throws(() => verifierModule.historicalPoint(newer, t), e => e.reason === "POINT_RELATION", "historicalPoint would cap the same point at the tip");
});
// h. Unavailable outcomes.
outcome("provider error is unavailable", s => { s.onCall = p => p === "/txs/" + s.txId ? new Response('{"error":"SYNTHETIC_PRIVATE_CANARY"}', { status: 500, headers: { "content-type": "application/json" } }) : undefined; }, "unavailable", "PROVIDER");
outcome("read timeout is unavailable", s => { s.onCall = p => p === `/txs/${s.txId}/cbor` ? new Promise(() => {}) : undefined; }, "unavailable", "TIMEOUT", "2", { check: { runtime: { readTimeoutMs: 30 } } });
outcome("cancelled session is unavailable", () => {}, "unavailable", "CANCELLED", "2", { check: { signal: AbortSignal.abort() } });
// Resolution authority: forged, reused, inactive, stale, changed, expired, disposed and late results never remove the record.
const codeOf = fn => { try { fn(); return "ACCEPTED"; } catch (error) { return error.code ?? error.name; } };
test("issuer is single-use: only the verifier holds it", async () => {
  const s = scenario(), coordinator = coordination.createDelegationCoordinator(); verifierModule.createRecoveryVerifier(fixture.projectId, coordinator);
  assert.equal(codeOf(() => coordinator.resolutionIssuer()), "OPERATION"); assert.throws(() => verifierModule.createRecoveryVerifier(fixture.projectId, coordinator), e => e.code === "OPERATION");
  coordinator.dispose(); assert.equal(store.get(KEY), s.recordJson);
});
test("forged and cloned resolutions are refused; the authentic one removes", async () => {
  const s = scenario(), seen = await check(s, { inside: ({ lease, outcome, coordinator }) => {
    assert.equal(outcome.status, "confirmed");
    const forged = [codeOf(() => coordinator.resolveConfirmed(lease, {})), codeOf(() => coordinator.resolveConfirmed(lease, Object.freeze({}))), codeOf(() => coordinator.resolveConfirmed(lease, structuredClone(outcome.resolution))), codeOf(() => coordinator.resolveConfirmed(lease, null))];
    const retained = store.get(KEY) === s.recordJson; coordinator.resolveConfirmed(lease, outcome.resolution);
    return { forged, retained, reuse: codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)) };
  } });
  assert.deepEqual(seen.result, { forged: ["RESOLUTION", "RESOLUTION", "RESOLUTION", "RESOLUTION"], retained: true, reuse: "RESOLUTION" }); assert.equal(store.has(KEY), false); seen.coordinator.dispose();
});
test("inactive lease cannot resolve", async () => {
  const s = scenario(); let saved; const seen = await check(s, { inside: ({ lease, outcome }) => { saved = { lease, outcome }; return "returned"; } });
  assert.equal(codeOf(() => seen.coordinator.resolveConfirmed(saved.lease, saved.outcome.resolution)), "LEASE"); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
});
test("stale status generation cannot resolve", async () => {
  const s = scenario(), seen = await check(s, { inside: ({ lease, outcome, coordinator }) => { coordinator.beginStatus(); return codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)); } });
  assert.equal(seen.result, "RESOLUTION"); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
});
test("a changed record cannot be resolved; a removed record is LOST", async () => {
  const s = scenario(), changed = JSON.stringify({ ...s.record, stage: "unknown" });
  const seen = await check(s, { inside: ({ lease, outcome, coordinator }) => { store.set(KEY, changed); return codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)); } });
  assert.equal(seen.result, "RESOLUTION"); assert.equal(store.get(KEY), changed); seen.coordinator.dispose();
  const t = scenario(), lost = await check(t, { inside: ({ lease, outcome, coordinator }) => { store.delete(KEY); return codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)); } });
  assert.equal(lost.result, "LOST"); assert.equal(lost.coordinator.getState().status, "unknown", "LOST is never silently healed"); assert.equal(lost.coordinator.getState().txId, t.txId); lost.coordinator.dispose();
});
test("an authentic but expired proof under a still-active lease cannot resolve", async () => {
  const s = scenario(), seen = await check(s, { deadline: now + 1000, inside: ({ lease, outcome, coordinator }) => { now += 1000; return codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)); } });
  assert.equal(seen.result, "RESOLUTION"); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
  const t = scenario(), manual = await check(t, { inside: ({ lease, outcome, coordinator }) => { now += 30000; return codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)); } });
  assert.equal(manual.result, "RESOLUTION", "the issuer deadline is bounded by the 30 s session"); assert.equal(store.get(KEY), t.recordJson); manual.coordinator.dispose();
});
test("a result delivered after dispose has no effect", async () => {
  const s = scenario(); let inner;
  const seen = await check(s, { inside: ({ lease, outcome, coordinator }) => { coordinator.dispose(); inner = codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)); return inner; } }).catch(error => ({ result: error.code }));
  assert.equal(inner, "LEASE"); assert.equal(seen.result, "CANCELLED", "dispose cancels the recovery operation"); assert.equal(store.get(KEY), s.recordJson);
});
test("a check completing beyond the poll budget obtains no resolution", async () => {
  const s = scenario(); s.onCall = (p, count) => { if (p === "/blocks/latest" && count === 2) now += 2000; };
  await assert.rejects(check(s, { deadline: now + 1000 }), e => e.code === "RESOLUTION"); assert.equal(store.get(KEY), s.recordJson);
});
test("ended status work revokes an issued resolution", async () => {
  const s = scenario(), seen = await check(s, { inside: ({ lease, outcome, coordinator, generation }) => { coordinator.endStatus(generation); return codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)); } });
  assert.equal(seen.result, "RESOLUTION"); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
});
// Manual dismissal after expiry (W7): a deliberate check (dismissal: true) whose T1 is at or past the exclusive TTL, an explicit not-found and a
// complete usable observation of every recorded input offer a single-use dismissal. New API is reached only inside test bodies.
const FIRST = registered.inputId + "#0", SECOND = "34".repeat(32) + "#1";
const output = (index, consumed = null, extra = {}) => ({ address: "addr1" + "q".repeat(98), amount: [{ unit: "lovelace", quantity: "5000000" }], output_index: index, data_hash: null,
  inline_datum: null, collateral: false, reference_script_hash: null, consumed_by_tx: consumed, ...extra });
// Every input gets complete usable rows, plus a decoy output at the next index already consumed by another transaction.
function expired(tipSlot = TTL + 1n, refs = [FIRST]) {
  const s = scenario("2", { tipSlot }); s.missing.add("/txs/" + s.txId);
  s.record = { ...s.record, inputRefs: refs }; s.recordJson = JSON.stringify(s.record); store.set(KEY, s.recordJson);
  for (const ref of refs) { const [h, i] = ref.split("#"); s.extra.set(`/txs/${h}/utxos`, { hash: h, inputs: [], outputs: [output(Number(i) + 1, id(12)), output(Number(i))] }); }
  return s;
}
const rowsOf = (s, ref) => s.extra.get(`/txs/${ref.split("#")[0]}/utxos`), rowOf = (s, ref) => rowsOf(s, ref).outputs.find(o => o.output_index === Number(ref.split("#")[1]));
const utxosPath = ref => `/txs/${ref.split("#")[0]}/utxos`;
// One bounded check with the dismissal request; `inside` runs under the same lease and must not throw (API calls go through codeOf).
// `dismissal: OMIT` sends no dismissal key at all, as the automatic status poll does.
const OMIT = Symbol("no dismissal key");
async function review(s, options = {}) {
  const coordinator = options.coordinator ?? coordination.createDelegationCoordinator();
  const verifier = options.verifier ?? verifierModule.createRecoveryVerifier(fixture.projectId, coordinator, options.runtime);
  currentFetch = s.fetch;
  try {
    const generation = options.generation ?? coordinator.beginStatus();
    const result = await coordinator.withRecoveryOperation(s.txId, async lease => {
      const request = { generation, deadline: options.deadline ?? null };
      if (options.dismissal !== OMIT) request.dismissal = options.dismissal ?? true;
      const outcome = await verifier.check(lease, request);
      return options.inside ? options.inside({ lease, outcome, coordinator, verifier, generation }) : outcome;
    });
    return { result, coordinator, verifier, generation };
  } finally { currentFetch = undefined; }
}
// One check with exactly the given request beside the generation: the controller's status poll sends { generation, deadline, signal }.
async function direct(s, request) {
  const coordinator = coordination.createDelegationCoordinator(), verifier = verifierModule.createRecoveryVerifier(fixture.projectId, coordinator);
  currentFetch = s.fetch;
  try { const generation = coordinator.beginStatus(); return await coordinator.withRecoveryOperation(s.txId, lease => verifier.check(lease, { generation, ...request })); }
  finally { currentFetch = undefined; coordinator.dispose(); }
}
function eligibility(name, setup, status, reason, options = {}) {
  test(name, async () => {
    const s = setup(); const { result, coordinator } = await review(s, options); note(result); coordinator.dispose();
    assert.equal(result.status, status, JSON.stringify(result)); assert.equal(result.reason, reason, JSON.stringify(result));
    assert.equal(store.get(KEY), s.recordJson, "RECORD_RETAINED_WITHOUT_DISMISSAL");
    if (reason === "EXPIRED_UNSEEN") assert.equal(typeof result.resolution, "object"); else assert.equal(result.resolution, undefined);
    if (options.then) options.then(result, s);
  });
}
const noRows = s => assert(!s.requested.some(p => p.endsWith("/utxos")), "no input rows read");
eligibility("E1: tip at TTL - 1 is not-found:NOT_FOUND and reads no input rows", () => expired(TTL - 1n), "not-found", "NOT_FOUND", { then: (r, s) => noRows(s) });
eligibility("E2: tip at TTL offers the dismissal", () => expired(TTL), "not-found", "EXPIRED_UNSEEN", { then: (r, s) => {
  assert.deepEqual(s.requested, ["/blocks/latest", "/txs/" + s.txId, utxosPath(FIRST), "/blocks/latest"]); assert.equal(r.spentElsewhere, false); assert.equal(r.witnessed, false);
} });
eligibility("E3: tip at TTL + 1 offers the dismissal", () => expired(TTL + 1n), "not-found", "EXPIRED_UNSEEN", { then: r => { assert.equal(r.spentElsewhere, false); assert.equal(r.witnessed, false); } });
eligibility("E4: local time past expiry with the tip at TTL - 1 is NOT_FOUND", () => { const s = expired(TTL - 1n); now += 19500; assert(now > timeAt(TTL)); return s; }, "not-found", "NOT_FOUND",
  { then: (r, s) => noRows(s) });
test("E5: the automatic poll (no dismissal) past expiry is NOT_FOUND with no rows and no resolution", async () => {
  // Only dismissal === true requests eligibility: (i) no key, as the real poll sends; (ii) an explicit false; (iii) truthy values other than true.
  const poll = async (s, options) => { const { result, coordinator } = await review(s, options); coordinator.dispose(); return result; };
  const cases = [["(i) no dismissal key", s => poll(s, { dismissal: OMIT })],
    ["(i) the status-poll request { generation, deadline, signal }", s => direct(s, { deadline: now + 30000, signal: new AbortController().signal })],
    ["(ii) dismissal: false", s => poll(s, { dismissal: false })],
    ...["true", 1, {}].map(value => [`(iii) dismissal: ${JSON.stringify(value)}`, s => poll(s, { dismissal: value })])];
  for (const [label, run] of cases) {
    const s = expired(TTL + 1n), r = await run(s); note(r);
    assert.equal(r.status + ":" + r.reason, "not-found:NOT_FOUND", label + " " + JSON.stringify(r));
    assert.deepEqual(s.requested, ["/blocks/latest", "/txs/" + s.txId], label);
    assert.equal(Object.prototype.hasOwnProperty.call(r, "resolution"), false, label + ": no resolution"); assert.equal(store.get(KEY), s.recordJson, label + ": record retained");
  }
});
eligibility("E6: stale T1 is unavailable:TIP", () => { const s = expired(TTL + 1n); now += 31000; return s; }, "unavailable", "TIP");
eligibility("E7: malformed T1 (epoch inconsistent with slot) is unavailable:TIP", () => { const s = expired(TTL + 1n); s.tips[0].epoch += 1; return s; }, "unavailable", "TIP");
eligibility("E8: T2 at T1's slot with another hash is unavailable:TIP", () => { const s = expired(TTL + 1n); s.tips.push({ ...tip(TTL + 1n), hash: id(77) }); return s; }, "unavailable", "TIP");
eligibility("E9: T2 below T1 is unavailable:TIP", () => { const s = expired(TTL + 2n); s.tips.push(tip(TTL + 1n)); return s; }, "unavailable", "TIP");
test("E10: a transaction found after expiry confirms with a confirmed resolution and no offer", async () => {
  const s = scenario("2", { slot: TTL - 1n, tipSlot: TTL + 10n });
  const seen = await review(s, { inside: ({ lease, outcome, coordinator }) => ({ outcome, resolve: codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)) }) });
  note(seen.result.outcome); assert.equal(seen.result.outcome.status, "confirmed", JSON.stringify(seen.result.outcome)); assert.equal(seen.result.outcome.reason, "CONFIRMED");
  assert.equal(Object.prototype.hasOwnProperty.call(seen.result.outcome, "spentElsewhere"), false, "no offer"); assert.equal(seen.result.resolve, "ACCEPTED", "a confirmed resolution");
  assert.equal(store.has(KEY), false); seen.coordinator.dispose();
});
eligibility("E11: a 404 with the input consumed by the ID is inconsistent:SPENT_BY_ID", () => { const s = expired(); rowOf(s, FIRST).consumed_by_tx = s.txId; return s; }, "inconsistent", "SPENT_BY_ID",
  { then: r => assert.equal(r.witnessed, true) });
eligibility("E12: an input consumed by another transaction offers with spentElsewhere", () => { const s = expired(); rowOf(s, FIRST).consumed_by_tx = id(13); return s; }, "not-found", "EXPIRED_UNSEEN",
  { then: r => { assert.equal(r.spentElsewhere, true); assert.equal(r.witnessed, false); } });
eligibility("E13: one input consumed by the ID and one by another is SPENT_BY_ID", () => {
  const s = expired(TTL + 1n, [FIRST, SECOND]); rowOf(s, FIRST).consumed_by_tx = s.txId; rowOf(s, SECOND).consumed_by_tx = id(13); return s;
}, "inconsistent", "SPENT_BY_ID");
eligibility("E14: input 1 consumed by the ID while input 2's rows are a 404 is SPENT_BY_ID", () => {
  const s = expired(TTL + 1n, [FIRST, SECOND]); rowOf(s, FIRST).consumed_by_tx = s.txId; s.missing.add(utxosPath(SECOND)); return s;
}, "inconsistent", "SPENT_BY_ID");
eligibility("E14R: input 1's rows a 404 and input 2 consumed by the ID is SPENT_BY_ID after both rows reads and T2", () => {
  const s = expired(TTL + 1n, [FIRST, SECOND]); s.missing.add(utxosPath(FIRST)); rowOf(s, SECOND).consumed_by_tx = s.txId; return s;
}, "inconsistent", "SPENT_BY_ID", { then: (r, s) => { assert.deepEqual(s.requested, ["/blocks/latest", "/txs/" + s.txId, utxosPath(FIRST), utxosPath(SECOND), "/blocks/latest"]); assert.equal(r.witnessed, true); } });
eligibility("E15: a missing consumed_by_tx key is unavailable:INPUT_ROWS", () => { const s = expired(); delete rowOf(s, FIRST).consumed_by_tx; return s; }, "unavailable", "INPUT_ROWS");
eligibility("E16: no output at the index is unavailable:INPUT_ROWS", () => { const s = expired(); rowsOf(s, FIRST).outputs = rowsOf(s, FIRST).outputs.filter(o => o.output_index !== 0); return s; }, "unavailable", "INPUT_ROWS");
eligibility("E17: two outputs at the index are unavailable:INPUT_ROWS", () => { const s = expired(); rowsOf(s, FIRST).outputs.push(output(0)); return s; }, "unavailable", "INPUT_ROWS");
eligibility("E18: a mismatched rows hash is unavailable:INPUT_ROWS", () => { const s = expired(); rowsOf(s, FIRST).hash = id(14); return s; }, "unavailable", "INPUT_ROWS");
test("E19: a malformed consumed_by_tx (a number, and a 63-hex string) is unavailable:INPUT_ROWS", async () => {
  for (const value of [5, "ab".repeat(31) + "a"]) {
    const s = expired(); rowOf(s, FIRST).consumed_by_tx = value; const { result, coordinator } = await review(s); note(result); coordinator.dispose();
    assert.equal(result.status + ":" + result.reason, "unavailable:INPUT_ROWS", JSON.stringify(value) + " " + JSON.stringify(result)); assert.equal(store.get(KEY), s.recordJson);
  }
});
eligibility("E20: a collateral output at the index is unavailable:INPUT_ROWS", () => { const s = expired(); rowOf(s, FIRST).collateral = true; return s; }, "unavailable", "INPUT_ROWS");
eligibility("E21: a rows 404 is unavailable:INPUT_ROWS", () => { const s = expired(); s.missing.add(utxosPath(FIRST)); return s; }, "unavailable", "INPUT_ROWS");
eligibility("E22: two inputs, the second without rows, is unavailable:INPUT_ROWS", () => { const s = expired(TTL + 1n, [FIRST, SECOND]); rowsOf(s, SECOND).outputs = []; return s; }, "unavailable", "INPUT_ROWS");
eligibility("E23: a rows HTTP 500 is unavailable:PROVIDER", () => {
  const s = expired(); s.onCall = p => p === utxosPath(FIRST) ? new Response('{"error":"SYNTHETIC_PRIVATE_CANARY"}', { status: 500, headers: { "content-type": "application/json" } }) : undefined; return s;
}, "unavailable", "PROVIDER");
eligibility("E24: a rows read timeout is unavailable:TIMEOUT", () => { const s = expired(); s.onCall = p => p === utxosPath(FIRST) ? new Promise(() => {}) : undefined; return s; }, "unavailable", "TIMEOUT",
  { runtime: { readTimeoutMs: 30 } });
// Positive witness: a found lookup (TX_IDENTITY passed) stays witnessed whatever follows; nothing before it is.
eligibility("E25: found, then a cbor 404, is pending:INDEX_LAG with witnessed", () => { const s = scenario("2", { tipSlot: TTL + 10n, slot: TTL - 1n }); s.missing.add(`/txs/${s.txId}/cbor`); return s; },
  "pending", "INDEX_LAG", { then: r => assert.equal(r.witnessed, true) });
eligibility("E26: found with invalid_hereafter differing from the record is inconsistent:TX_VALIDITY with witnessed", () => { const s = scenario(); s.content.invalid_hereafter = (TTL + 1n).toString(); return s; },
  "inconsistent", "TX_VALIDITY", { then: r => assert.equal(r.witnessed, true) });
eligibility("E27: found with another content hash is inconsistent:TX_IDENTITY without witness", () => { const s = scenario(); s.content.hash = id(9); return s; },
  "inconsistent", "TX_IDENTITY", { then: r => assert.equal(r.witnessed, false) });
eligibility("E28: found, then an HTTP 500 on the cbor read, is unavailable:PROVIDER with witnessed", () => {
  const s = scenario(); s.onCall = p => p === `/txs/${s.txId}/cbor` ? new Response('{"error":"SYNTHETIC_PRIVATE_CANARY"}', { status: 500, headers: { "content-type": "application/json" } }) : undefined; return s;
}, "unavailable", "PROVIDER", { then: r => assert.equal(r.witnessed, true) });
test("E29: NOT_FOUND, EXPIRED_UNSEEN and confirmed outcomes carry exactly their documented keys and no provider value", async () => {
  const shapes = [];
  for (const [make, options] of [[() => expired(TTL - 1n), {}], [() => expired(TTL + 1n), {}], [() => scenario(), { inside: ({ lease, outcome, coordinator }) => { codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)); return outcome; } }]]) {
    const s = make(), { result, coordinator } = await review(s, options); note(result); coordinator.dispose(); shapes.push(result);
    assert(!JSON.stringify(result).includes("SYNTHETIC_PRIVATE_CANARY")); assert.equal(result.txId, s.txId);
  }
  assert.deepEqual(shapes.map(r => r.status + ":" + r.reason), ["not-found:NOT_FOUND", "not-found:EXPIRED_UNSEEN", "confirmed:CONFIRMED"]);
  assert.deepEqual(Reflect.ownKeys(shapes[0]).sort(), ["reason", "status", "txId", "witnessed"]);
  assert.deepEqual(Reflect.ownKeys(shapes[1]).sort(), ["reason", "resolution", "spentElsewhere", "status", "txId", "witnessed"]);
  assert.deepEqual(Reflect.ownKeys(shapes[2]).sort(), ["account", "blockHeight", "confirmations", "credential", "reason", "resolution", "stakeAddress", "status", "txId", "witnessed"]);
  assert.deepEqual(shapes.map(r => r.witnessed), [false, false, true]); assert.equal(typeof shapes[1].spentElsewhere, "boolean");
  for (const r of shapes.slice(1)) { assert(Object.isFrozen(r.resolution)); assert.deepEqual(Reflect.ownKeys(r.resolution), [], "an opaque resolution carries no payload"); }
});
// Dismissal authority: offered from a dismissible resolution, consumed once by resolveDismissed with a fresh recheck's resolution.
async function offered(s) {
  const first = await review(s, { inside: ({ lease, outcome, coordinator }) => ({ outcome, authority: outcome.reason === "EXPIRED_UNSEEN" ? coordinator.offerDismissal(lease, outcome.resolution) : null }) });
  note(first.result.outcome); assert.equal(first.result.outcome.reason, "EXPIRED_UNSEEN", JSON.stringify(first.result.outcome)); assert.equal(typeof first.result.authority, "object");
  return { coordinator: first.coordinator, verifier: first.verifier, generation: first.generation, authority: first.result.authority };
}
// A confirm recheck under a new lease; `act` gets the fresh EXPIRED_UNSEEN outcome and returns codeOf results only.
async function confirmLease(first, s, act, generation = first.generation) {
  const seen = await review(s, { coordinator: first.coordinator, verifier: first.verifier, generation,
    inside: ({ lease, outcome, coordinator }) => ({ outcome, value: outcome.reason === "EXPIRED_UNSEEN" ? act({ lease, outcome, coordinator }) : null }) });
  note(seen.result.outcome); assert.equal(seen.result.outcome.reason, "EXPIRED_UNSEEN", JSON.stringify(seen.result.outcome)); return seen.result.value;
}
test("A1: resolveConfirmed refuses a dismissible resolution; offerDismissal refuses a confirmed one", async () => {
  const s = expired(), seen = await review(s, { inside: ({ lease, outcome, coordinator }) => ({ outcome, code: codeOf(() => coordinator.resolveConfirmed(lease, outcome.resolution)) }) });
  note(seen.result.outcome); assert.equal(seen.result.outcome.reason, "EXPIRED_UNSEEN"); assert.equal(seen.result.code, "RESOLUTION"); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
  const t = scenario(), found = await review(t, { inside: ({ lease, outcome, coordinator }) => ({ outcome, code: codeOf(() => coordinator.offerDismissal(lease, outcome.resolution)) }) });
  assert.equal(found.result.outcome.status, "confirmed"); assert.equal(found.result.code, "RESOLUTION"); assert.equal(store.get(KEY), t.recordJson); found.coordinator.dispose();
});
test("A2: an offer in lease 1, then a recheck and resolveDismissed in lease 2, removes the record and permits a new operation", async () => {
  const s = expired(), first = await offered(s);
  assert.equal(store.get(KEY), s.recordJson, "the offer removes nothing");
  const code = await confirmLease(first, s, ({ lease, outcome, coordinator }) => codeOf(() => coordinator.resolveDismissed(lease, first.authority, outcome.resolution)));
  assert.equal(code, "ACCEPTED"); assert.equal(store.has(KEY), false, "DISMISSAL_REMOVES_RECORD"); assert.equal(localStorage.getItem(KEY), null, "reads back null");
  assert.equal(first.coordinator.getState().status, "absent"); assert.equal(await first.coordinator.withNewOperation(async () => "healthy"), "healthy"); first.coordinator.dispose();
});
test("A3: a used authority is refused with no second removal effect", async () => {
  const s = expired(), first = await offered(s), del = store.delete.bind(store); let removals = 0; store.delete = key => { if (key === KEY) removals++; return del(key); };
  try {
    const codes = await confirmLease(first, s, ({ lease, outcome, coordinator }) => {
      const once = codeOf(() => coordinator.resolveDismissed(lease, first.authority, outcome.resolution)); store.set(KEY, s.recordJson);
      return [once, codeOf(() => coordinator.resolveDismissed(lease, first.authority, outcome.resolution))];
    });
    assert.deepEqual(codes, ["ACCEPTED", "RESOLUTION"]); assert.equal(removals, 1, "exactly one removal"); assert.equal(store.get(KEY), s.recordJson, "the reuse removes nothing");
  } finally { delete store.delete; first.coordinator.dispose(); }
});
test("A4: an authority from an earlier status generation is refused with a valid fresh resolution", async () => {
  const s = expired(), first = await offered(s), next = first.coordinator.beginStatus(); assert.equal(next, first.generation + 1);
  const code = await confirmLease(first, s, ({ lease, outcome, coordinator }) => codeOf(() => coordinator.resolveDismissed(lease, first.authority, outcome.resolution)), next);
  assert.equal(code, "RESOLUTION"); assert.equal(store.get(KEY), s.recordJson); first.coordinator.dispose();
});
test("A5: a stage-only record change between offer and confirm is refused", async () => {
  const s = expired(), first = await offered(s), changed = JSON.stringify({ ...s.record, stage: "unknown" }); store.set(KEY, changed);
  const code = await confirmLease(first, s, ({ lease, outcome, coordinator }) => codeOf(() => coordinator.resolveDismissed(lease, first.authority, outcome.resolution)));
  assert.equal(code, "RESOLUTION"); assert.equal(store.get(KEY), changed); first.coordinator.dispose();
});
test("A6: a resolution past its deadline under the still-active lease is refused", async () => {
  const s = expired(), first = await offered(s);
  const code = await confirmLease(first, s, ({ lease, outcome, coordinator }) => { now += 30000; return codeOf(() => coordinator.resolveDismissed(lease, first.authority, outcome.resolution)); });
  assert.equal(code, "RESOLUTION"); assert.equal(store.get(KEY), s.recordJson); first.coordinator.dispose();
});
test("A7: an inactive lease cannot dismiss", async () => {
  const s = expired(), first = await offered(s); const saved = await confirmLease(first, s, ({ lease, outcome }) => ({ lease, resolution: outcome.resolution }));
  assert.equal(codeOf(() => first.coordinator.resolveDismissed(saved.lease, first.authority, saved.resolution)), "LEASE"); assert.equal(store.get(KEY), s.recordJson); first.coordinator.dispose();
});
test("A8: dispose after the offer refuses the confirm and retains the record", async () => {
  const s = expired(); let lease1; const first = await review(s, { inside: ({ lease, outcome, coordinator }) => { lease1 = lease;
    return { outcome, authority: outcome.reason === "EXPIRED_UNSEEN" ? coordinator.offerDismissal(lease, outcome.resolution) : null }; } });
  note(first.result.outcome); assert.equal(first.result.outcome.reason, "EXPIRED_UNSEEN"); first.coordinator.dispose();
  await assert.rejects(review(s, { coordinator: first.coordinator, verifier: first.verifier, generation: first.generation }), e => e.code === "CANCELLED");
  assert.equal(codeOf(() => first.coordinator.resolveDismissed(lease1, first.result.authority, null)), "LEASE"); assert.equal(store.get(KEY), s.recordJson);
});
test("A9: a record removed by another agent is LOST, unknown and never healed", async () => {
  const s = expired(), first = await offered(s);
  const code = await confirmLease(first, s, ({ lease, outcome, coordinator }) => { store.delete(KEY); return codeOf(() => coordinator.resolveDismissed(lease, first.authority, outcome.resolution)); });
  assert.equal(code, "LOST"); assert.equal(first.coordinator.getState().status, "unknown"); assert.equal(first.coordinator.getState().txId, s.txId); first.coordinator.dispose();
});
test("A10: forged, cloned and null authorities are refused; the authentic one removes", async () => {
  const s = expired(), first = await offered(s);
  const codes = await confirmLease(first, s, ({ lease, outcome, coordinator }) => {
    const forged = [{}, Object.freeze({}), structuredClone(first.authority), null].map(a => codeOf(() => coordinator.resolveDismissed(lease, a, outcome.resolution)));
    return { forged, retained: store.get(KEY) === s.recordJson, authentic: codeOf(() => coordinator.resolveDismissed(lease, first.authority, outcome.resolution)) };
  });
  assert.deepEqual(codes, { forged: ["RESOLUTION", "RESOLUTION", "RESOLUTION", "RESOLUTION"], retained: true, authentic: "ACCEPTED" }); assert.equal(store.has(KEY), false); first.coordinator.dispose();
});
test("A11: another coordinator's authority is refused", async () => {
  const s = expired(), other = await offered(s);
  const seen = await review(s, { inside: ({ lease, outcome, coordinator }) => ({ outcome, code: outcome.reason === "EXPIRED_UNSEEN" ? codeOf(() => coordinator.resolveDismissed(lease, other.authority, outcome.resolution)) : null }) });
  note(seen.result.outcome); assert.equal(seen.result.outcome.reason, "EXPIRED_UNSEEN"); assert.equal(seen.result.code, "RESOLUTION"); assert.equal(store.get(KEY), s.recordJson);
  seen.coordinator.dispose(); other.coordinator.dispose();
});
test("A12: a dismissible resolution minted in lease 1 is refused under lease 2", async () => {
  const s = expired(); let spare;
  const first = await review(s, { inside: async ({ lease, outcome, coordinator, verifier, generation }) => {
    const authority = outcome.reason === "EXPIRED_UNSEEN" ? coordinator.offerDismissal(lease, outcome.resolution) : null;
    spare = await verifier.check(lease, { generation, deadline: null, dismissal: true }); return { outcome, authority };
  } });
  note(first.result.outcome); assert.equal(first.result.outcome.reason, "EXPIRED_UNSEEN"); note(spare); assert.equal(spare.reason, "EXPIRED_UNSEEN", JSON.stringify(spare));
  const code = await review(s, { coordinator: first.coordinator, verifier: first.verifier, generation: first.generation,
    inside: ({ lease, coordinator }) => codeOf(() => coordinator.resolveDismissed(lease, first.result.authority, spare.resolution)) });
  assert.equal(code.result, "RESOLUTION"); assert.equal(store.get(KEY), s.recordJson); first.coordinator.dispose();
});
// Clause pins: each offerDismissal / resolveDismissed clause, and the first-input-failure rule, is the only thing that can fail its test.
test("R1: the resolution consumed by offerDismissal cannot drive resolveDismissed in the same lease", async () => {
  const s = expired(); let authority;
  const seen = await review(s, { inside: ({ lease, outcome, coordinator }) => [outcome.reason, codeOf(() => { authority = coordinator.offerDismissal(lease, outcome.resolution); }),
    codeOf(() => coordinator.resolveDismissed(lease, authority, outcome.resolution))] });
  assert.deepEqual(seen.result, ["EXPIRED_UNSEEN", "ACCEPTED", "RESOLUTION"]); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
});
test("R2: a confirmed resolution cannot drive resolveDismissed", async () => {
  const s = expired(), first = await offered(s); s.missing.delete("/txs/" + s.txId);
  const seen = await review(s, { coordinator: first.coordinator, verifier: first.verifier, generation: first.generation,
    inside: ({ lease, outcome, coordinator }) => ({ status: outcome.status, code: codeOf(() => coordinator.resolveDismissed(lease, first.authority, outcome.resolution)) }) });
  assert.deepEqual(seen.result, { status: "confirmed", code: "RESOLUTION" }); assert.equal(store.get(KEY), s.recordJson); first.coordinator.dispose();
});
test("R3: among two failing inputs the first in record order decides the reason, in both orders", async () => {
  const fail = () => new Response('{"error":"SYNTHETIC_PRIVATE_CANARY"}', { status: 500, headers: { "content-type": "application/json" } });
  for (const [failing, missing, expected] of [[FIRST, SECOND, "unavailable:PROVIDER"], [SECOND, FIRST, "unavailable:INPUT_ROWS"]]) {
    const s = expired(TTL + 1n, [FIRST, SECOND]); s.onCall = p => p === utxosPath(failing) ? fail() : undefined; s.missing.add(utxosPath(missing));
    const { result, coordinator } = await review(s); note(result); coordinator.dispose();
    assert.equal(result.status + ":" + result.reason, expected, JSON.stringify(result)); assert.equal(store.get(KEY), s.recordJson);
    assert.deepEqual(s.requested, ["/blocks/latest", "/txs/" + s.txId, utxosPath(FIRST), utxosPath(SECOND), "/blocks/latest"], "both inputs read");
  }
});
test("R4: offerDismissal refuses a lease-1 resolution under lease 2", async () => {
  const s = expired(); let saved;
  const first = await review(s, { inside: ({ outcome }) => { saved = outcome.resolution; return outcome.reason; } });
  const seen = await review(s, { coordinator: first.coordinator, verifier: first.verifier, generation: first.generation,
    inside: ({ lease, outcome, coordinator }) => [first.result, outcome.reason, codeOf(() => coordinator.offerDismissal(lease, saved))] });
  assert.deepEqual(seen.result, ["EXPIRED_UNSEEN", "EXPIRED_UNSEEN", "RESOLUTION"]); assert.equal(store.get(KEY), s.recordJson); first.coordinator.dispose();
});
test("R5: offerDismissal refuses after the status generation moved", async () => {
  const s = expired(), seen = await review(s, { inside: ({ lease, outcome, coordinator }) => { coordinator.beginStatus(); return [outcome.reason, codeOf(() => coordinator.offerDismissal(lease, outcome.resolution))]; } });
  assert.deepEqual(seen.result, ["EXPIRED_UNSEEN", "RESOLUTION"]); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
});
test("R6: offerDismissal refuses past the resolution deadline", async () => {
  const s = expired(), seen = await review(s, { inside: ({ lease, outcome, coordinator }) => { now += 30000; return [outcome.reason, codeOf(() => coordinator.offerDismissal(lease, outcome.resolution))]; } });
  assert.deepEqual(seen.result, ["EXPIRED_UNSEEN", "RESOLUTION"]); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
});
test("R7: one dismissible resolution yields at most one authority", async () => {
  const s = expired(), seen = await review(s, { inside: ({ lease, outcome, coordinator }) =>
    [codeOf(() => coordinator.offerDismissal(lease, outcome.resolution)), codeOf(() => coordinator.offerDismissal(lease, outcome.resolution))] });
  assert.deepEqual(seen.result, ["ACCEPTED", "RESOLUTION"]); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
});
test("R8: offerDismissal refuses after a stage-only record change", async () => {
  const s = expired(), changed = JSON.stringify({ ...s.record, stage: "unknown" });
  const seen = await review(s, { inside: ({ lease, outcome, coordinator }) => { store.set(KEY, changed); return [outcome.reason, codeOf(() => coordinator.offerDismissal(lease, outcome.resolution))]; } });
  assert.deepEqual(seen.result, ["EXPIRED_UNSEEN", "RESOLUTION"]); assert.equal(store.get(KEY), changed); seen.coordinator.dispose();
});
test("R9: resolveDismissed refuses an older-generation resolution while the authority is current", async () => {
  const s = expired();
  const seen = await review(s, { inside: async ({ lease, outcome, coordinator, verifier }) => {
    const old = outcome.resolution, g = coordinator.beginStatus(), fresh = await verifier.check(lease, { generation: g, deadline: null, dismissal: true }); let authority;
    return [outcome.reason, fresh.reason, codeOf(() => { authority = coordinator.offerDismissal(lease, fresh.resolution); }), codeOf(() => coordinator.resolveDismissed(lease, authority, old))];
  } });
  assert.deepEqual(seen.result, ["EXPIRED_UNSEEN", "EXPIRED_UNSEEN", "ACCEPTED", "RESOLUTION"]); assert.equal(store.get(KEY), s.recordJson); seen.coordinator.dispose();
});
test("R10: resolveDismissed refuses a resolution for an earlier record while the authority binds the current one", async () => {
  const s = expired(), changed = JSON.stringify({ ...s.record, stage: "unknown" });
  const seen = await review(s, { inside: async ({ lease, outcome, coordinator, verifier, generation }) => {
    const old = outcome.resolution; store.set(KEY, changed); const fresh = await verifier.check(lease, { generation, deadline: null, dismissal: true }); let authority;
    return [outcome.reason, fresh.reason, codeOf(() => { authority = coordinator.offerDismissal(lease, fresh.resolution); }), codeOf(() => coordinator.resolveDismissed(lease, authority, old))];
  } });
  assert.deepEqual(seen.result, ["EXPIRED_UNSEEN", "EXPIRED_UNSEEN", "ACCEPTED", "RESOLUTION"]); assert.equal(store.get(KEY), changed); seen.coordinator.dispose();
});
test("R11: three inputs, two unusable then one spent by the recovery ID, still read every input and give SPENT_BY_ID", async () => {
  const THIRD = "56".repeat(32) + "#0", s = expired(TTL + 1n, [FIRST, SECOND, THIRD]); s.missing.add(utxosPath(FIRST)); s.missing.add(utxosPath(SECOND)); rowOf(s, THIRD).consumed_by_tx = s.txId;
  const { result, coordinator } = await review(s); note(result); coordinator.dispose();
  assert.equal(result.status + ":" + result.reason, "inconsistent:SPENT_BY_ID", JSON.stringify(result));
  assert.deepEqual(s.requested, ["/blocks/latest", "/txs/" + s.txId, utxosPath(FIRST), utxosPath(SECOND), utxosPath(THIRD), "/blocks/latest"]);
  assert.equal(store.get(KEY), s.recordJson, "RECORD_RETAINED");
});
test("every outcome and reason code was produced", () => {
  assert.deepEqual([...seenOutcomes].sort(), [...fixture.outcomes].sort()); assert.deepEqual([...seenReasons].sort(), [...fixture.reasonCodes].sort());
});
after(() => {
  assert.equal(outward, 0, "no outward HTTP or socket"); assert.equal(walletAccess, 0, "status work never touches a wallet");
  globalThis.fetch = originalFetch; restores.forEach(f => f());
  const identity = loader.identity(); loader.close();
  console.log(JSON.stringify({ productionModules: identity.production.map(m => m.file), loadedDependencies: identity.dependencies.length, outward, walletAccess, controlledFetchCalls: calls,
    fixtureSha256: sha256(fs.readFileSync(path.join(__dirname, "fixtures/recovery-verifier.json"))), runnerSha256: sha256(fs.readFileSync(__filename)), reasons: [...seenReasons].sort() }));
});
