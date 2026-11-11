#!/usr/bin/env node
"use strict";
// Meta-check for the node:test hook gate: a suite run directly must take after() from scripts/lib/node-test-gate.cjs, never from
// node:test, because a failing top-level after() hook from node:test does not redden the exit code (see lib/node-test-gate.cjs).
// Plain node:assert and an explicit exit code; never node:test. Run from easy1staking/: node scripts/check-node-test-gate.cjs
// It reads comment-stripped source text, so it checks declarations, not behaviour; obfuscated or dynamic requires are not detected.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const scripts = __dirname, self = path.join(scripts, "check-node-test-gate.cjs"), helper = path.join(scripts, "lib", "node-test-gate.cjs");
// The module names are assembled, so this file's own source never matches its detectors.
const MODULE = ["node", "test"].join(":"), HELPER = "./lib/node-test-gate" + ".cjs", HOOK = "af" + "ter", LOAD = "requ" + "ire";
const esc = s => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), Q = "[\"'`]", ident = "[A-Za-z_$][\\w$]*";
const quoted = name => Q + esc(name) + Q, required = name => LOAD + "\\s*\\(\\s*" + quoted(name) + "\\s*\\)";
const member = "\\s*(?:\\?\\.)?\\s*(?:\\.\\s*" + HOOK + "(?![\\w$])|\\[\\s*" + quoted(HOOK) + "\\s*\\])";
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
const hasKey = (inside, key) => inside.split(",").some(part => part.trim().split(/\s*[:=]\s*|\s+as\s+/)[0].replace(/["'`]/g, "").trim() === key);
/** Shapes that take after() from node:test, or call it bare without binding it from the helper, on comment-stripped code. */
function violations(code) {
  const found = [], add = shape => { if (!found.includes(shape)) found.push(shape); };
  const requiresModule = new RegExp(required(MODULE)).test(code) || new RegExp("\\b(?:from|import)\\s*" + quoted(MODULE)).test(code);
  if (!requiresModule) return { requiresModule, helperUser: false, found };
  for (const m of code.matchAll(new RegExp("\\{([^{}]*)\\}\\s*=\\s*" + required(MODULE), "g"))) if (hasKey(m[1], HOOK)) add("destructured " + HOOK + " from " + MODULE);
  if (new RegExp(required(MODULE) + member).test(code)) add("member " + HOOK + " of " + LOAD + "(" + MODULE + ")");
  const names = new Set();
  for (const m of code.matchAll(new RegExp("(?<![\\w$.])(" + ident + ")\\s*=\\s*" + required(MODULE), "g"))) names.add(m[1]);
  for (const m of code.matchAll(new RegExp("\\bimport\\s*\\*\\s*as\\s+(" + ident + ")\\s+from\\s*" + quoted(MODULE), "g"))) names.add(m[1]);
  for (const m of code.matchAll(new RegExp("\\bimport\\s+(" + ident + ")\\s*(?:,\\s*(?:\\{[^{}]*\\}|\\*\\s*as\\s+" + ident + "))?\\s*from\\s*" + quoted(MODULE), "g"))) names.add(m[1]);
  for (const m of code.matchAll(new RegExp("\\bimport\\s*(?:" + ident + "\\s*,\\s*)?\\{([^{}]*)\\}\\s*from\\s*" + quoted(MODULE), "g"))) if (hasKey(m[1], HOOK)) add("imported " + HOOK + " from " + MODULE);
  for (const name of names) {
    if (new RegExp("(?<![\\w$.])" + esc(name) + member).test(code)) add("namespace " + name + "." + HOOK);
    for (const m of code.matchAll(new RegExp("\\{([^{}]*)\\}\\s*=\\s*" + esc(name) + "(?![\\w$])", "g"))) if (hasKey(m[1], HOOK)) add("destructured " + HOOK + " from namespace " + name);
  }
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
];
const clean = [
  "const { test } = " + call(MODULE) + ", { " + HOOK + " } = " + call(HELPER) + "; " + HOOK + "(() => {});",
  "const { test } = " + call(MODULE) + ", { " + HOOK + " } = " + call(HELPER) + ";\n// const { " + HOOK + " } = " + call(MODULE) + "\n" + HOOK + "(() => {});",
];
for (const [snippet, shape] of planted) {
  const result = violations(strip(snippet));
  assert(result.requiresModule && result.found.includes(shape), "DETECTOR_RESPONDS " + shape + " :: " + snippet);
}
for (const snippet of clean) assert.deepEqual(violations(strip(snippet)).found, [], "DETECTOR_CLEAN " + snippet);
console.log("DETECTOR_RESPONDS " + planted.length + " planted shapes flagged, " + clean.length + " clean controls passed");
const own = violations(strip(fs.readFileSync(self, "utf8")));
assert(!own.requiresModule && own.found.length === 0, "SELF_DOES_NOT_REQUIRE_NODE_TEST");

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
