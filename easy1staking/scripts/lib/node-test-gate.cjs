"use strict";
// Fail-closed node:test after() hooks for suites run directly (`node scripts/check-*.cjs`). Under the pinned Node 24.22.1 a failing
// top-level after() hook is printed as a failing test, yet the summary keeps `fail 0` and the process exits 0, so a guard in the hook
// cannot redden a gate. This wrapper registers the same hook and latches a non-zero exit code when it throws (assertion or any error),
// then rethrows so the runner still reports it. Tests, their names, order and expectations are untouched; a healthy run is unchanged.
// It takes exactly one hook function and refuses hook options rather than dropping them. At process exit, a run whose helper hook failed
// or never settled ends at once with code 1 (process.exit inside an exit listener), so no exit listener registered later can reset it.
const nodeTest = require("node:test");
let failed = false, pending = 0, watching = false;
function watch() {
  if (watching) return;
  watching = true;
  process.once("exit", () => { if (failed || pending !== 0) process.exit(1); });
}
function latch() { failed = true; process.exitCode = 1; }
function after(fn, ...options) {
  if (typeof fn !== "function" || options.length !== 0) throw new TypeError("node-test-gate after() takes exactly one hook function; hook options are not supported");
  watch();
  return nodeTest.after(async (...args) => {
    pending++;
    try { return await fn(...args); } catch (error) { latch(); throw error; } finally { pending--; }
  });
}
module.exports = { after };
