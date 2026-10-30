#!/usr/bin/env node
// Exercise production TypeScript in a fresh in-memory CommonJS module graph.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const ts = require("typescript");
const app = path.resolve(__dirname, "..");
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = (id) => {
    // This import is Next's build-time boundary marker, with no runtime logic.
    if (id === "server-only") return {};
    if (id.startsWith(".")) return load(path.resolve(path.dirname(file), id + ".ts"));
    return require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const model = load(path.join(app, "src/lib/site/pool-facts.ts"));
const { createPoolSnapshotOwner } = load(path.join(app, "src/lib/site/pool-snapshot.ts"));
const raw = () => ({ pool_id: model.EASY1_POOL_ID, hex: model.EASY1_POOL_HEX, active_stake: "1000001", live_stake: "990000000000", live_saturation: 1.234, blocks_minted: 0, margin_cost: 0, fixed_cost: "1" });
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
function harness(fetcher, readShared) {
  let now = 900_000;
  let key = "synthetic-not-a-credential";
  const calls = [];
  const deps = { readShared, now: () => now, projectId: () => key, fetch: async (url, options) => {
    calls.push({ url, options });
    return fetcher ? fetcher(url, options) : response(url.endsWith("/epochs/latest") ? { epoch: 0 } : raw());
  } };
  return { get: createPoolSnapshotOwner(deps), calls, time: (value) => { now = value; }, key: (value) => { key = value; } };
}

test("fixed EASY1 bech32 checksum and 28-byte payload independently match hex", () => {
  assert.equal(model.EASY1_POOL_ID, "pool1yr0cv3dtmhcfgqa6yetvmf769ngk89e6tepecmjrmjl2jzcw2lm");
  assert.equal(model.EASY1_POOL_HEX, "20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9");
  const id = model.EASY1_POOL_ID;
  const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const [hrp, data] = [id.slice(0, id.lastIndexOf("1")), id.slice(id.lastIndexOf("1") + 1)];
  assert.equal(hrp, "pool");
  const values = [...data].map((c) => alphabet.indexOf(c));
  assert(values.every((v) => v >= 0));
  const expanded = [...hrp].map((c) => c.charCodeAt(0) >> 5).concat([0], [...hrp].map((c) => c.charCodeAt(0) & 31));
  let check = 1;
  for (const value of [...expanded, ...values]) {
    const top = check >>> 25;
    check = ((check & 0x1ffffff) << 5) ^ value;
    [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3].forEach((g, i) => { if ((top >>> i) & 1) check ^= g; });
  }
  assert.equal(check, 1);
  const bits = values.slice(0, -6).map((v) => v.toString(2).padStart(5, "0")).join("");
  const bytes = bits.slice(0, 224).match(/.{8}/g).map((b) => parseInt(b, 2));
  assert.equal(Buffer.from(bytes).toString("hex"), model.EASY1_POOL_HEX);
  assert(!/1/.test(bits.slice(224)));
});

test("exact currency, active versus live stake and independent zero fee fields", () => {
  for (const [input, expected] of [["0", "0"], ["1", "0.000001"], ["1000001", "1.000001"], ["9007199254740993123456", "9,007,199,254,740,993.123456"]]) {
    assert.equal(model.formatLovelace(input), expected);
    assert.equal(model.normalizePool({ ...raw(), active_stake: input, fixed_cost: input }).activeStake, expected);
    assert.equal(model.normalizePool({ ...raw(), fixed_cost: input }).fixedCost, expected);
  }
  assert.deepEqual(model.normalizePool(raw()), { activeStake: "1.000001", saturation: "123.4", blocks: "0", margin: "0", fixedCost: "0.000001" });
  assert.equal(model.normalizePool({ ...raw(), margin_cost: null }).fixedCost, "0.000001");
  assert.equal(model.normalizePool({ ...raw(), fixed_cost: null }).margin, "0");
});

test("invalid identity invalidates everything; malformed and missing fields remain independent", () => {
  for (const value of [null, undefined, [], {}, "error", { error: "missing" }, { ...raw(), pool_id: "other" }, { ...raw(), hex: "other" }]) assert.equal(model.normalizePool(value), null);
  const badCurrency = [undefined, null, -1, 1, NaN, Infinity, {}, [], "", "-1", "1.1", "1e6", " 1", "0x01"];
  for (const value of badCurrency) {
    assert.equal(model.normalizePool({ ...raw(), active_stake: value }).activeStake, null);
    assert.equal(model.normalizePool({ ...raw(), fixed_cost: value }).fixedCost, null);
    assert.equal(model.normalizePool({ ...raw(), active_stake: value }).blocks, "0");
  }
  for (const value of [null, undefined, -1, NaN, Infinity, "0", {}, []]) {
    assert.equal(model.normalizePool({ ...raw(), live_saturation: value }).saturation, null);
    assert.equal(model.normalizePool({ ...raw(), margin_cost: value }).margin, null);
  }
  for (const value of [null, undefined, -1, 0.1, NaN, Infinity, "0", Number.MAX_SAFE_INTEGER + 1]) assert.equal(model.normalizePool({ ...raw(), blocks_minted: value }).blocks, null);
  for (const [value, expected] of [[0, "0"], [1, "100"], [1.234, "123.4"], [0.00001, "0.001"], [1e21, "100000000000000000000000"]]) assert.equal(model.normalizePool({ ...raw(), live_saturation: value }).saturation, expected);
  assert.equal(model.normalizePool({ ...raw(), margin_cost: 1 }).margin, "100");
  assert.equal(model.normalizePool({ ...raw(), margin_cost: 1.001 }).margin, null);
  for (const value of [null, [], {}, { epoch: "0" }, { epoch: -1 }, { epoch: 0.1 }, { epoch: Infinity }, { epoch: Number.MAX_SAFE_INTEGER + 1 }]) assert.equal(model.normalizeEpoch(value), null);
  assert.equal(model.normalizeEpoch({ epoch: 0 }), 0);
});

test("age boundary, future timestamps, reversal and invalid clocks never present current facts", () => {
  const snapshot = { facts: model.normalizePool(raw()), fetchedAt: 900_000, epoch: 0 };
  assert.equal(model.isCurrentSnapshot(snapshot, 900_000), true);
  assert.equal(model.isCurrentSnapshot(snapshot, 1_199_999), true);
  for (const now of [1_200_000, 1_200_001, 899_999, NaN, Infinity, 900_000.5, 9e15]) assert.equal(model.isCurrentSnapshot(snapshot, now), false);
  for (const fetchedAt of [null, NaN, Infinity, 900_001, 899_999.5]) assert.equal(model.isCurrentSnapshot({ ...snapshot, fetchedAt }, 900_000), false);
});

test("shared concurrent cache calls fixed GET endpoints once, retains actual pool observation time", async () => {
  const h = harness();
  const [home, pool] = await Promise.all([h.get(), h.get()]);
  assert.deepEqual(home, pool);
  assert.equal(home.fetchedAt, 900_000);
  assert.equal(home.epoch, 0);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls.map((c) => c.url), [`https://cardano-mainnet.blockfrost.io/api/v0/pools/${model.EASY1_POOL_ID}`, "https://cardano-mainnet.blockfrost.io/api/v0/epochs/latest"]);
  for (const { options } of h.calls) { assert.equal(options.cache, "no-store"); assert(options.signal instanceof AbortSignal); assert.equal(options.headers.project_id, "synthetic-not-a-credential"); }
  h.time(1_199_999);
  assert.equal((await h.get()).fetchedAt, 900_000);
  assert.equal(h.calls.length, 2);
  h.time(1_200_000);
  assert.equal((await h.get()).fetchedAt, 1_200_000);
  assert.equal(h.calls.length, 4);
});

test("expiry followed by provider failure never serves or restamps stale facts, then recovers", async () => {
  let fail = false;
  const h = harness((url) => { if (fail) throw new Error("synthetic outage"); return response(url.endsWith("/epochs/latest") ? { epoch: 123 } : raw()); });
  await h.get();
  h.time(1_200_000); fail = true;
  assert.deepEqual(await h.get(), { facts: null, epoch: null, fetchedAt: null });
  assert.deepEqual(await h.get(), { facts: null, epoch: null, fetchedAt: null });
  assert.equal(h.calls.length, 6);
  fail = false; h.time(1_200_100);
  assert.equal((await h.get()).fetchedAt, 1_200_100);
});

test("missing configuration, key changes, schema/HTTP errors and independent epoch failures", async () => {
  const missing = harness(); missing.key(undefined);
  assert.deepEqual(await missing.get(), { facts: null, epoch: null, fetchedAt: null });
  assert.equal(missing.calls.length, 0);
  for (const body of [null, [], {}, { error: "missing" }, { pool_id: model.EASY1_POOL_ID, hex: model.EASY1_POOL_HEX }, { ...raw(), hex: "other" }]) {
    const h = harness(() => response(body));
    assert.equal((await h.get()).facts, null);
    await h.get(); assert.equal(h.calls.length, 4);
  }
  for (const status of [404, 429, 500]) {
    const h = harness(() => response({}, status));
    assert.equal((await h.get()).fetchedAt, null);
  }
  const h = harness((url) => url.endsWith("/epochs/latest") ? Promise.reject(new Error("epoch failed")) : response(raw()));
  assert.deepEqual(await h.get(), { facts: model.normalizePool(raw()), epoch: null, fetchedAt: 900_000 });
  h.key("other-synthetic-config"); await h.get(); assert.equal(h.calls.length, 4);
  h.time(899_999); await h.get(); assert.equal(h.calls.length, 6);
});

test("slow epoch does not restamp pool completion or accept an expired pool response", async () => {
  let finish;
  const epoch = new Promise((resolve) => { finish = resolve; });
  const h = harness((url) => url.endsWith("/epochs/latest") ? epoch : response(raw()));
  const result = h.get();
  await new Promise(setImmediate);
  h.time(910_000); finish(response({ epoch: 1 }));
  assert.equal((await result).fetchedAt, 900_000);
  let finishExpired;
  const expired = harness((url) => url.endsWith("/epochs/latest") ? new Promise((r) => { finishExpired = r; }) : response(raw()));
  const expiredResult = expired.get(); await new Promise(setImmediate);
  expired.time(1_200_000); finishExpired(response({ epoch: 1 }));
  assert.equal((await expiredResult).facts, null);
});

test("persistent adapter entries must pass age, clock and bucket checks on every read", async () => {
  const valid = { facts: model.normalizePool(raw()), fetchedAt: 900_000, epoch: 0 };
  for (const fetchedAt of [600_000, 899_999, 900_001, NaN, Infinity]) {
    const h = harness(null, async () => ({ ...valid, fetchedAt }));
    assert.equal((await h.get()).facts, null);
    assert.equal(h.calls.length, 0);
  }
  const calls = [];
  const h = harness(null, async (key, bucket, load) => { calls.push({ key, bucket }); return load(); });
  await h.get(); h.time(1_200_000); await h.get();
  assert.deepEqual(calls.map((c) => c.bucket), [3, 4]);
  assert.equal(h.calls.length, 4);
  h.time(NaN); assert.equal((await h.get()).facts, null);
  h.time(899_999); assert.equal((await h.get()).fetchedAt, 899_999);
  const failed = harness(null, async () => { throw new Error("synthetic cache failure"); });
  assert.equal((await failed.get()).fetchedAt, null);
});

test("transport including response body has a ten-second ceiling even if fetch ignores abort", async () => {
  const h = harness(() => ({ ok: true, json: () => new Promise(() => {}) }));
  const started = performance.now();
  assert.equal((await h.get()).fetchedAt, null);
  assert(performance.now() - started < 11_500);
  assert(h.calls.every((c) => c.options.signal.aborted));
});
