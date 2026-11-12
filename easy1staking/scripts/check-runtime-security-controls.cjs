#!/usr/bin/env node
"use strict";
// Controls for the runtime-security guard: each control runs a byte-identical copy of the unchanged scripts/check-runtime-security.cjs
// against a synthetic temporary lock (and, in installed mode, synthetic installed metadata) and checks its verdict. They pin the stable()
// rule and the installed-metadata check for optional copies. This is not an audit. Plain node:assert and an explicit exit code; never
// node:test. Run from easy1staking/: node scripts/check-runtime-security-controls.cjs
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const assert = require("node:assert/strict"), { isDeepStrictEqual } = require("node:util"), { spawnSync } = require("node:child_process");
const source = path.join(__dirname, "check-runtime-security.cjs"), guard = fs.readFileSync(source);
const repositoryLock = fs.readFileSync(path.join(__dirname, "..", "package-lock.json"));
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
// Minimal lock M: the guard's own floors.
const minimal = () => ({ name: "controls", lockfileVersion: 3, packages: { "": { name: "controls" },
  "node_modules/@babel/runtime": { version: "7.26.10" }, "node_modules/@evolution-sdk/evolution": { version: "0.5.14" },
  "node_modules/nanoid": { version: "3.3.18" }, "node_modules/postcss": { version: "8.5.23" }, "node_modules/source-map-js": { version: "1.2.2" },
  "node_modules/websocket-driver": { version: "0.7.5" }, "node_modules/yaml": { version: "1.10.3" } } });
const withPlatform = version => { const lock = minimal(); lock.packages["node_modules/@effect/platform"] = { version }; return lock; };
/** Installed metadata matching every locked package, with optional per-name version overrides. */
const metadata = (lock, overrides = {}) => Object.fromEntries(Object.entries(lock.packages).filter(([location]) => location !== "")
  .map(([location, entry]) => { const name = location.split("node_modules/").pop(); return [name, overrides[name] ?? entry.version]; }));

function runGuard({ lock, lockOnly, installed = {} }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-security-controls-"));
  try {
    const copy = path.join(root, "scripts", "check-runtime-security.cjs");
    fs.mkdirSync(path.dirname(copy)); fs.writeFileSync(copy, guard);
    assert.equal(digest(fs.readFileSync(copy)), digest(guard), "GUARD_COPY_IDENTICAL");
    const lockBytes = Buffer.isBuffer(lock) ? lock : Buffer.from(JSON.stringify(lock));
    fs.writeFileSync(path.join(root, "package-lock.json"), lockBytes);
    for (const [name, version] of Object.entries(installed)) {
      const dir = path.join(root, "node_modules", name); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version }));
    }
    const r = spawnSync(process.execPath, [copy, ...(lockOnly ? ["--lock-only"] : [])], { cwd: root, encoding: "utf8", timeout: 30000 });
    const summaries = (r.stdout || "").split("\n").filter(line => line.startsWith("{"));
    return { exit: r.status, signal: r.signal, error: r.error ? String(r.error.code || r.error.message) : null,
      summary: summaries.length === 1 ? JSON.parse(summaries[0]) : null, fail: (r.stderr || "").split("\n").filter(line => line.startsWith("FAIL ")),
      lockIdentical: digest(fs.readFileSync(path.join(root, "package-lock.json"))) === digest(lockBytes) };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

const platformLock = withPlatform("0.97.1");
const controls = [
  ["K0", { lock: minimal(), lockOnly: true }, r => r.exit === 0 && r.fail.length === 0 && isDeepStrictEqual(r.summary?.absentOptional, ["@effect/platform", "undici"])],
  // 0.98.0-rc.0 has the reviewed major and passes atLeast (98 > 97 decides first), so only stable() rejects it.
  ["K1", { lock: withPlatform("0.98.0-rc.0"), lockOnly: true },
    r => r.exit === 1 && isDeepStrictEqual(r.fail, ["FAIL node_modules/@effect/platform: @effect/platform@0.98.0-rc.0 requires stable >=0.97.1 within reviewed major 0"])],
  ["K2", { lock: withPlatform("0.98.0"), lockOnly: true }, r => r.exit === 0 && r.fail.length === 0],
  ["K3", { lock: platformLock, lockOnly: false, installed: metadata(platformLock, { "@effect/platform": "0.97.2" }) },
    r => r.exit === 1 && isDeepStrictEqual(r.fail, ["FAIL node_modules/@effect/platform: installed name/version differs from lock (@effect/platform@0.97.2)"])],
  ["K4", { lock: platformLock, lockOnly: false, installed: metadata(platformLock) }, r => r.exit === 0 && r.fail.length === 0],
  ["K5", { lock: repositoryLock, lockOnly: true }, r => r.exit === 0 && r.fail.length === 0 && r.lockIdentical],
];
const results = controls.map(([name, setup, holds]) => { const r = runGuard(setup); return { name, exit: r.exit, fail: r.fail, ok: holds(r) }; });
console.log("RUNTIME_SECURITY_CONTROLS " + JSON.stringify({ controls: results }));
assert.deepEqual(results.filter(r => !r.ok).map(r => r.name), [], "RUNTIME_SECURITY_CONTROLS");
