"use strict";
// Fail-closed node:test after() hooks for suites run directly (`node scripts/check-*.cjs`). Under the pinned Node 24.22.1 a failing
// top-level after() hook is printed as a failing test, yet the summary keeps `fail 0` and the process exits 0, so a guard in the hook
// cannot redden a gate. This wrapper registers the same hook and latches a non-zero exit code when it throws (assertion or any error),
// then rethrows so the runner still reports it. Tests, their names, order and expectations are untouched; a healthy run is unchanged.
const nodeTest = require("node:test");
let failed = false;
function latch() {
  if (failed) return;
  failed = true; process.exitCode = 1;
  // The exit listener re-asserts the code in case anything later resets process.exitCode before the process ends.
  process.once("exit", () => { process.exitCode = 1; });
}
function after(fn) {
  return nodeTest.after(async (...args) => {
    try { return await fn(...args); } catch (error) { latch(); throw error; }
  });
}
module.exports = { after };
