#!/usr/bin/env node
"use strict";
// Meta-check for the node:test hook gate: a suite run directly must take after() from scripts/lib/node-test-gate.cjs, never from
// node:test, because a failing top-level after() hook from node:test does not redden the exit code (see lib/node-test-gate.cjs).
// Plain node:assert and an explicit exit code; never node:test. Run from easy1staking/: node scripts/check-node-test-gate.cjs
// It reads comment-stripped source text, so it checks declarations, not behaviour; obfuscated or dynamic requires are not detected.
// Also not detected: chained members such as require(...).test.after or nt.test.after.
// Binding lists are read as text, not parsed: a default initializer is cut at its first "=", one level of nested braces inside a destructuring
// list is tolerated and dropped, and a "default" key counts as node:test's test export. Not detected: deeper nesting, a pattern nested under
// the test or it key (such as { test: { after } }), computed keys and rest elements.
// A list assigned from node:test or a namespace is also read flat, so a nested pattern with its own default, such as { k: { test: t } = nt }, is read too.
// A node:test require may be wrapped in parentheses and whitespace, such as nt = ( (require(...)) ), wherever a node:test require is read;
// closing parentheses are not paired, so f(require(...)).after also reads as a member (a false RED), and a parenthesised helper require is
// not read as the helper. Also not detected: other alias chains (const h = nt, t = nt.test, (nt).after, { after } = (nt)), a hook key
// destructured under another name from a test or it alias in a separate statement (const { after: hook } = test), a node:test require
// bound inside a sequence, conditional or logical expression such as nt = (0, require(...)) or bound through module.require, the second
// name of import d, * as ns, and import(). A member taken directly on such a require, such as (0, require(...)).after or
// module.require(...).after, still reads as a member, and a name bound from (require(...), other) is learned as a namespace although it
// holds the other value (a false RED). Unsupported textual routes, also not detected: a namespace held in a container, such as
// const [g] = [require(...)]; a namespace named outside ASCII (a namespace is read only when its name matches [A-Za-z_$][A-Za-z0-9_$]*);
// and string literals that contain braces inside a binding list, such as { test: t = "}" }.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const scripts = __dirname, self = path.join(scripts, "check-node-test-gate.cjs"), helper = path.join(scripts, "lib", "node-test-gate.cjs");
// The module names are assembled, so this file's own source never matches its detectors.
const MODULE = ["node", "test"].join(":"), HELPER = "./lib/node-test-gate" + ".cjs", HOOK = "af" + "ter", LOAD = "requ" + "ire";
const esc = s => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), Q = "[\"'`]", ident = "[A-Za-z_$][\\w$]*";
const quoted = name => Q + esc(name) + Q, required = name => LOAD + "\\s*\\(\\s*" + quoted(name) + "\\s*\\)";
// node:test's require, optionally wrapped in parentheses and whitespace, such as (require(...)) or ( (require(...)) ).
const requiredModule = "(?:\\(\\s*)*" + required(MODULE) + "(?:\\s*\\))*";
const member = "\\s*(?:\\?\\.\\s*(?:" + HOOK + "(?![\\w$])|\\[\\s*" + quoted(HOOK) + "\\s*\\])|\\.\\s*" + HOOK + "(?![\\w$])|\\[\\s*" + quoted(HOOK) + "\\s*\\])";
// A destructuring list, captured, that may hold one level of nested braces, such as { mock: { fn }, test }.
const list = "\\{((?:[^{}]|\\{[^{}]*\\})*)\\}";
const keywords = new Set(["return", "typeof", "case", "do", "else", "in", "of", "void", "yield", "await", "delete", "instanceof", "new", "throw"]);

/** Removes // and block comments outside string, template and regular-expression literals. */
function strip(text) {
  let out = "", i = 0, prev = "", word = "";
  while (i < text.length) {
    const c = text[i], d = text[i + 1];
    if (c === "/" && d === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { const end = text.indexOf("*/", i + 2); i = end < 0 ? text.length : end + 2; out += " "; continue; }
    if (c === "\"" || c === "'" || c === "`") {
      let j = i + 1; while (j < text.length && text[j] !== c) { if (text[j] === "\\") j++; j++; }
      out += text.slice(i, j + 1); prev = c; word = ""; i = j + 1; continue;
    }
    if (c === "/" && (prev === "" || "(,=:[!&|?{};+-*%<>~^".includes(prev) || keywords.has(word))) {
      let j = i + 1, inClass = false;
      while (j < text.length && text[j] !== "\n" && (inClass || text[j] !== "/")) { if (text[j] === "\\") j++; else if (text[j] === "[") inClass = true; else if (text[j] === "]") inClass = false; j++; }
      out += text.slice(i, j + 1); prev = "/"; word = ""; i = j + 1; continue;
    }
    out += c;
    if (/[\w$]/.test(c)) { word = /[\w$]/.test(prev) ? word + c : c; prev = c; } else if (!/\s/.test(c)) { prev = c; word = ""; }
    i++;
  }
  return out;
}
/** A destructuring or import list as [key, local] pairs, read as text: one level of nested braces is dropped, then a default is cut at "=". */
const entries = inside => inside.replace(/\{[^{}]*\}/g, "{}").split(",").map(part => part.split("=")[0].trim().split(/\s*:\s*|\s+as\s+/).map(s => s.replace(/["'`]/g, "").trim()));
const hasKey = (inside, key) => entries(inside).some(([k]) => k === key);
/** Local names bound to node:test's test, it or default export: `test`, `test: t`, `test as t`, `test = x`, `test: t = x`, `it`, `default as t`. */
const aliasNames = inside => entries(inside).filter(([key]) => key === "test" || key === "it" || key === "default").map(([key, local]) => local || key);
/** Shapes that take after() from node:test, or call it bare without binding it from the helper, on comment-stripped code. */
function violations(code) {
  const found = [], add = shape => { if (!found.includes(shape)) found.push(shape); };
  const requiresModule = new RegExp(required(MODULE)).test(code) || new RegExp("\\b(?:from|import)\\s*" + quoted(MODULE)).test(code);
  if (!requiresModule) return { requiresModule, helperUser: false, found };
  // Every list is read twice: with one level of nesting, and flat, so a nested pattern with its own default is also read on its own.
  for (const m of code.matchAll(new RegExp(list + "\\s*=\\s*" + requiredModule, "g"))) if (hasKey(m[1], HOOK)) add("destructured " + HOOK + " from " + MODULE);
  for (const m of code.matchAll(new RegExp("\\{([^{}]*)\\}\\s*=\\s*" + requiredModule, "g"))) if (hasKey(m[1], HOOK)) add("destructured " + HOOK + " from " + MODULE);
  if (new RegExp(requiredModule + member).test(code)) add("member " + HOOK + " of " + LOAD + "(" + MODULE + ")");
  const names = new Set();
  for (const m of code.matchAll(new RegExp("(?<![\\w$.])(" + ident + ")\\s*=\\s*" + requiredModule, "g"))) names.add(m[1]);
  for (const m of code.matchAll(new RegExp("\\bimport\\s*\\*\\s*as\\s+(" + ident + ")\\s+from\\s*" + quoted(MODULE), "g"))) names.add(m[1]);
  for (const m of code.matchAll(new RegExp("\\bimport\\s+(" + ident + ")\\s*(?:,\\s*(?:\\{[^{}]*\\}|\\*\\s*as\\s+" + ident + "))?\\s*from\\s*" + quoted(MODULE), "g"))) names.add(m[1]);
  for (const m of code.matchAll(new RegExp("\\bimport\\s*(?:" + ident + "\\s*,\\s*)?\\{([^{}]*)\\}\\s*from\\s*" + quoted(MODULE), "g"))) if (hasKey(m[1], HOOK)) add("imported " + HOOK + " from " + MODULE);
  for (const name of names) {
    if (new RegExp("(?<![\\w$.])" + esc(name) + member).test(code)) add("namespace " + name + "." + HOOK);
    for (const m of code.matchAll(new RegExp(list + "\\s*=\\s*" + esc(name) + "(?![\\w$])", "g"))) if (hasKey(m[1], HOOK)) add("destructured " + HOOK + " from namespace " + name);
    for (const m of code.matchAll(new RegExp("\\{([^{}]*)\\}\\s*=\\s*" + esc(name) + "(?![\\w$])", "g"))) if (hasKey(m[1], HOOK)) add("destructured " + HOOK + " from namespace " + name);
  }
  // test.after and it.after are node:test's after(): a local binding of the test or it export is checked like a namespace.
  const aliases = new Set();
  for (const m of code.matchAll(new RegExp(list + "\\s*=\\s*" + requiredModule, "g"))) aliasNames(m[1]).forEach(a => aliases.add(a));
  for (const m of code.matchAll(new RegExp("\\{([^{}]*)\\}\\s*=\\s*" + requiredModule, "g"))) aliasNames(m[1]).forEach(a => aliases.add(a));
  for (const m of code.matchAll(new RegExp("\\bimport\\s*(?:" + ident + "\\s*,\\s*)?\\{([^{}]*)\\}\\s*from\\s*" + quoted(MODULE), "g"))) aliasNames(m[1]).forEach(a => aliases.add(a));
  for (const name of names) for (const m of code.matchAll(new RegExp(list + "\\s*=\\s*" + esc(name) + "(?![\\w$])", "g"))) aliasNames(m[1]).forEach(a => aliases.add(a));
  for (const name of names) for (const m of code.matchAll(new RegExp("\\{([^{}]*)\\}\\s*=\\s*" + esc(name) + "(?![\\w$])", "g"))) aliasNames(m[1]).forEach(a => aliases.add(a));
  for (const alias of aliases) if (new RegExp("(?<![\\w$.])" + esc(alias) + member).test(code)) add("alias " + alias + "." + HOOK);
  const helperUser = [...code.matchAll(new RegExp("\\{([^{}]*)\\}\\s*=\\s*" + required(HELPER), "g"))].some(m => hasKey(m[1], HOOK));
  if (new RegExp("(?<![\\w$.])" + HOOK + "\\s*\\(").test(code) && !helperUser) add("bare " + HOOK + "( without the helper");
  return { requiresModule, helperUser, found };
}

// DETECTOR_RESPONDS: every planted shape is flagged; the helper's correct use and a comment-only line are not.
const call = name => LOAD + "(\"" + name + "\")";
const planted = [
  ["const { test, " + HOOK + " } = " + call(MODULE) + ";", "destructured " + HOOK + " from " + MODULE],
  ["const { " + HOOK + ": hook } = " + call(MODULE) + ";", "destructured " + HOOK + " from " + MODULE],
  ["const hook = " + call(MODULE) + "." + HOOK + ";", "member " + HOOK + " of " + LOAD + "(" + MODULE + ")"],
  ["const hook = " + call(MODULE) + "[\"" + HOOK + "\"];", "member " + HOOK + " of " + LOAD + "(" + MODULE + ")"],
  ["const nt = " + call(MODULE) + "; nt." + HOOK + "(() => {});", "namespace nt." + HOOK],
  ["const nt = " + call(MODULE) + "; nt[\"" + HOOK + "\"](() => {});", "namespace nt." + HOOK],
  ["const a = 1, nt = " + call(MODULE) + "; const { " + HOOK + " } = nt;", "destructured " + HOOK + " from namespace nt"],
  ["import { test, " + HOOK + " } from \"" + MODULE + "\";", "imported " + HOOK + " from " + MODULE],
  ["import * as nt from \"" + MODULE + "\"; nt." + HOOK + "(() => {});", "namespace nt." + HOOK],
  ["import nt from \"" + MODULE + "\"; nt." + HOOK + "(() => {});", "namespace nt." + HOOK],
  ["const { test } = " + call(MODULE) + "; " + HOOK + "(() => {});", "bare " + HOOK + "( without the helper"],
  ["const { test } = " + call(MODULE) + "; test." + HOOK + "(() => {});", "alias test." + HOOK],
  ["const { test: t } = " + call(MODULE) + "; t." + HOOK + "(() => {});", "alias t." + HOOK],
  ["const { it } = " + call(MODULE) + "; it[\"" + HOOK + "\"](() => {});", "alias it." + HOOK],
  ["import { test as t } from \"" + MODULE + "\"; t." + HOOK + "(() => {});", "alias t." + HOOK],
  ["const nt = " + call(MODULE) + "; const { it: i } = nt; i." + HOOK + "(() => {});", "alias i." + HOOK],
  ["const nt = " + call(MODULE) + "; nt?." + HOOK + "(() => {});", "namespace nt." + HOOK],
  ["const { test = null } = " + call(MODULE) + "; test." + HOOK + "(() => {});", "alias test." + HOOK],
  ["const { test: t = undefined } = " + call(MODULE) + "; t." + HOOK + "(() => {});", "alias t." + HOOK],
  ["const { mock: { fn }, test } = " + call(MODULE) + "; test." + HOOK + "(() => {});", "alias test." + HOOK],
  ["import { default as t } from \"" + MODULE + "\"; t." + HOOK + "(() => {});", "alias t." + HOOK],
  ["const { mock: { fn }, " + HOOK + " } = " + call(MODULE) + ";", "destructured " + HOOK + " from " + MODULE],
  ["const nt = " + call(MODULE) + "; const { mock: { fn }, it: i = null } = nt; i." + HOOK + "(() => {});", "alias i." + HOOK],
  ["const nt = " + call(MODULE) + "; const { mock: { fn }, " + HOOK + " } = nt;", "destructured " + HOOK + " from namespace nt"],
  ["const { k: { " + HOOK + ": hook } = " + call(MODULE) + " } = " + call(MODULE) + ";", "destructured " + HOOK + " from " + MODULE],
  ["const nt = " + call(MODULE) + "; const { k: { " + HOOK + ": hook } = nt } = nt;", "destructured " + HOOK + " from namespace nt"],
  ["const { k: { test: t } = " + call(MODULE) + " } = " + call(MODULE) + "; t." + HOOK + "(() => {});", "alias t." + HOOK],
  ["const nt = " + call(MODULE) + "; const { k: { test: t } = nt } = nt; t." + HOOK + "(() => {});", "alias t." + HOOK],
  ["function f() { return 1; }\nconst { " + HOOK + " } = " + call(MODULE) + ";", "destructured " + HOOK + " from " + MODULE],
  ["function f() { return 1; } const { " + HOOK + ", mock: { fn } } = " + call(MODULE) + ";", "destructured " + HOOK + " from " + MODULE],
  ["const g = (" + call(MODULE) + "); let { test: t = g } = " + call(MODULE) + "; t = g." + HOOK + "; t(() => {});", "namespace g." + HOOK],
  ["const g = (" + call(MODULE) + "); const nt = " + call(MODULE) + "; let { test: t = g } = nt; t = g." + HOOK + ";", "namespace g." + HOOK],
  ["const g = (" + call(MODULE) + "); let { it: i = g } = " + call(MODULE) + "; i = g?." + HOOK + ";", "namespace g." + HOOK],
  ["const g = (" + call(MODULE) + "); let { test: t = g } = " + call(MODULE) + "; t = g[\"" + HOOK + "\"];", "namespace g." + HOOK],
  ["const g = (" + call(MODULE) + "); g." + HOOK + "(() => {});", "namespace g." + HOOK],
  ["const g = (" + call(MODULE) + "); const h = g." + HOOK + "; h(() => {});", "namespace g." + HOOK],
  ["const g = ((" + call(MODULE) + ")); g." + HOOK + "(() => {});", "namespace g." + HOOK],
  ["const g = ( " + call(MODULE) + " ); g." + HOOK + "(() => {});", "namespace g." + HOOK],
  ["const g = (" + call(MODULE) + "); const { " + HOOK + " } = g;", "destructured " + HOOK + " from namespace g"],
  ["const g = (" + call(MODULE) + "); const { test: t } = g; t." + HOOK + "(() => {});", "alias t." + HOOK],
  ["const hook = ( " + call(MODULE) + " )." + HOOK + ";", "member " + HOOK + " of " + LOAD + "(" + MODULE + ")"],
  ["const { " + HOOK + " } = (" + call(MODULE) + ");", "destructured " + HOOK + " from " + MODULE],
  ["const { " + HOOK + ", mock: { fn } } = (" + call(MODULE) + ");", "destructured " + HOOK + " from " + MODULE],
  ["const { k: { " + HOOK + ": hook } = (" + call(MODULE) + ") } = (" + call(MODULE) + ");", "destructured " + HOOK + " from " + MODULE],
  ["const { mock: { fn }, test: t } = (" + call(MODULE) + "); t." + HOOK + "(() => {});", "alias t." + HOOK],
  ["const { k: { test: t } = (" + call(MODULE) + ") } = (" + call(MODULE) + "); t." + HOOK + "(() => {});", "alias t." + HOOK],
];
const clean = [
  "const { test } = " + call(MODULE) + ", { " + HOOK + " } = " + call(HELPER) + "; " + HOOK + "(() => {});",
  "const { test } = " + call(MODULE) + ", { " + HOOK + " } = " + call(HELPER) + ";\n// const { " + HOOK + " } = " + call(MODULE) + "\n" + HOOK + "(() => {});",
  "const { test } = " + call(MODULE) + ", { " + HOOK + " } = " + call(HELPER) + "; const contest = { " + HOOK + "() {} }; contest." + HOOK + "(); test.skip(\"x\", () => {}); " + HOOK + "(() => {});",
  "const { mock: { fn, " + HOOK + ": spy } } = " + call(MODULE) + ", { " + HOOK + " } = " + call(HELPER) + "; " + HOOK + "(() => {});",
  "const { test: t = null } = " + call(MODULE) + ", { " + HOOK + " } = " + call(HELPER) + "; const contest = { " + HOOK + "() {} }; contest." + HOOK + "(); t.skip(\"x\", () => {}); " + HOOK + "(() => {});",
  "const { test } = " + call(MODULE) + ", g = (" + call("./other.cjs") + "); g." + HOOK + "(() => {}); test(\"t\", () => {});",
  "const g = (" + call(MODULE) + "), { " + HOOK + " } = " + call(HELPER) + "; g.test(\"t\", () => {}); " + HOOK + "(() => {});",
];
for (const [snippet, shape] of planted) {
  const result = violations(strip(snippet));
  assert(result.requiresModule && result.found.includes(shape), "DETECTOR_RESPONDS " + shape + " :: " + snippet);
}
for (const snippet of clean) assert.deepEqual(violations(strip(snippet)).found, [], "DETECTOR_CLEAN " + snippet);
console.log("DETECTOR_RESPONDS " + planted.length + " planted shapes flagged, " + clean.length + " clean controls passed");
const own = violations(strip(fs.readFileSync(self, "utf8")));
assert(!own.requiresModule && own.found.length === 0, "SELF_DOES_NOT_REQUIRE_NODE_TEST");

// HELPER_RESPONDS: real temporary suites under this Node. Through the helper a failing hook reddens the run, hook options are refused, and
// neither an exit listener registered later nor a hook body that never settles can let a failing run exit 0. ALIAS_WITNESS records, without
// asserting, how a failing hook reached through node:test's test.after ends without the helper.
const os = require("node:os"), { spawnSync } = require("node:child_process");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "node-test-gate-")), failure = "() => { throw new Error(\"SYNTHETIC_HOOK_FAILURE\"); }";
const header = "\"use strict\";\nconst { test } = " + call(MODULE) + ", { " + HOOK + " } = " + LOAD + "(" + JSON.stringify(helper) + ");\ntest(\"t\", () => {});\n";
const witnesses = [
  ["throwing", HOOK + "(" + failure + ");", "nonzero"],
  ["healthy", HOOK + "(() => {});", "zero"],
  ["healthy-async", HOOK + "(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });", "zero"],
  ["options", HOOK + "(() => {}, { timeout: 1000 });", "refused"],
  ["late-exit-listener", HOOK + "(() => { setImmediate(() => process.on(\"exit\", () => { process.exitCode = 0; })); throw new Error(\"SYNTHETIC_HOOK_FAILURE\"); });", "nonzero"],
  ["never-settles", HOOK + "(() => new Promise(() => {}));", "nonzero"],
];
const runSuite = text => {
  const file = path.join(scratch, "w" + fs.readdirSync(scratch).length + ".cjs"); fs.writeFileSync(file, text);
  const r = spawnSync(process.execPath, [file], { cwd: scratch, encoding: "utf8", timeout: 60000 });
  return { exit: r.status, signal: r.signal, error: r.error ? String(r.error.code || r.error.message) : null, refused: /hook options are not supported/.test(r.stderr || "") };
};
let helperResults, aliasWitness;
try {
  helperResults = witnesses.map(([name, body, expect]) => {
    const o = runSuite(header + body + "\n"), exited = o.error === null && o.signal === null && typeof o.exit === "number";
    return { name, expect, ...o, ok: exited && (expect === "zero" ? o.exit === 0 : o.exit !== 0 && (expect !== "refused" || o.refused)) };
  });
  aliasWitness = runSuite("\"use strict\";\nconst { test } = " + call(MODULE) + ";\ntest(\"t\", () => {});\ntest." + HOOK + "(" + failure + ");\n");
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
console.log("HELPER_RESPONDS " + JSON.stringify(helperResults.map(({ name, expect, exit, signal, error, ok }) => ({ name, expect, exit, signal, error, ok }))));
console.log("ALIAS_WITNESS " + JSON.stringify({ exit: aliasWitness.exit, signal: aliasWitness.signal }));
assert.deepEqual(helperResults.filter(r => !r.ok).map(r => r.name), [], "HELPER_RESPONDS");

const files = [...fs.readdirSync(scripts).filter(f => /^check-.*\.cjs$/.test(f)).map(f => path.join(scripts, f)),
  ...fs.readdirSync(path.join(scripts, "lib")).filter(f => f.endsWith(".cjs")).map(f => path.join(scripts, "lib", f))]
  .filter(f => f !== self && f !== helper).sort();
const rel = f => path.relative(path.dirname(scripts), f), report = { scanned: [], suites: [], helperUsers: [], direct: [] };
for (const file of files) {
  const result = violations(strip(fs.readFileSync(file, "utf8")));
  report.scanned.push(rel(file));
  if (result.requiresModule) report.suites.push(rel(file));
  if (result.helperUser) report.helperUsers.push(rel(file));
  for (const shape of result.found) { report.direct.push({ file: rel(file), shape }); console.log("NODE_TEST_GATE_VIOLATION " + rel(file) + ": " + shape); }
}
if (report.direct.length === 0) console.log("NODE_TEST_GATE " + JSON.stringify(report));
process.exitCode = report.direct.length === 0 ? 0 : 1;
