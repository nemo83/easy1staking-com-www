#!/usr/bin/env node
'use strict';

// Exercise installed APIs directly, with small bounded inputs and no children.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const sourceHash = '746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d';
const started = performance.now();
const initialRSS = process.memoryUsage().rss;
const copies = [];
const cases = [
  ['src/file.ts', '**/*.ts', {}, true],
  ['src/file.js', '**/*.ts', {}, false],
  ['src/.hidden.ts', '**/*.ts', {}, false],
  ['src/.hidden.ts', '**/*.ts', { dot: true }, true],
  ['src/a.ts', 'src/*.{ts,tsx}', {}, true],
  ['src/a.tsx', 'src/*.{ts,tsx}', {}, true],
  ['src/a.jsx', 'src/*.{ts,tsx}', {}, false],
  ['src/a.test.ts', '**/!(*.test).ts', {}, false],
  ['src/a.ts', '**/!(*.test).ts', {}, true],
  ['SRC/FILE.TS', '**/*.ts', { nocase: true }, true],
  ['nested/config.js', '*.js', {}, false],
  ['nested/config.js', '*.js', { matchBase: true }, true],
];
const parserCases = [
  ['eslint.config.js', ['*.js'], true],
  ['config/eslint.config.js', ['*.js'], false],
  ['config/eslint.config.js', ['config/*.js'], true],
  ['config/eslint.config.ts', ['*.js', 'config/*.ts'], true],
  ['config/eslint.config.ts', ['*.js'], false],
  ['.eslintrc.js', ['*.js'], false],
  ['src/file.ts', undefined, false],
  ['src/file.ts', [], false],
];
let assertions = 0;
let modernCopies = 0, legacyCopies = 0;
for (const [location, entry] of Object.entries(lock.packages || {})) {
  if (location.split('node_modules/').pop() !== 'minimatch') continue;
  const pkg = JSON.parse(fs.readFileSync(path.join(root, location, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'minimatch');
  assert.equal(pkg.version, entry.version);
  const exported = require(path.join(root, location));
  let match;
  if (entry.version === '3.1.5') {
    legacyCopies++;
    assert.equal(typeof exported, 'function', `${location}: legacy callable API`);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, location, 'minimatch.js'))).digest('hex');
    assert.equal(hash, sourceHash, `${location}: exact legacy source identity`);
    match = exported;
  } else {
    modernCopies++;
    assert.equal(entry.version, '11.0.3', `${location}: reviewed modern version`);
    assert.equal(typeof exported, 'object', `${location}: modern namespace API`);
    assert.equal(typeof exported.minimatch, 'function');
    match = exported.minimatch;
    // Small repeated globstar/parent segments exercise the shipped growth cap.
    const pattern = Array(8).fill('**/../a/b').join('/') + '/*.ts';
    assert(pattern.length < 256);
    const limited = new exported.Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 8 });
    assert(limited.globParts.length > 0 && limited.globParts.length <= 8, `${location}: bounded level-2 pattern growth`);
    assert.deepEqual(exported.braceExpand('{1..100}/file.ts', { braceExpandMax: 8 }), Array.from({ length: 8 }, (_, i) => `${i + 1}/file.ts`));
    assertions += 2;
  }
  for (const [file, pattern, options, expected] of cases) {
    assert(file.length < 256 && pattern.length < 256);
    assert.equal(match(file, pattern, options), expected, `${location}: ${file} against ${pattern}`);
    assertions++;
  }
  // Same default-options call shape as typescript-estree's filePathMatchedBy.
  for (const [file, patterns, expected] of parserCases) {
    assert.equal(!!patterns?.some(pattern => match(file, pattern)), expected, `${location}: parser caller shape ${file}`);
    assertions++;
  }
  copies.push({ location, version: entry.version, api: typeof exported });
}
assert(legacyCopies > 0 && modernCopies > 0, 'both reviewed APIs must be installed');
const parserRequire = createRequire(path.join(root, 'node_modules/@typescript-eslint/typescript-estree/package.json'));
const parserMatcher = parserRequire('minimatch');
assert.equal(typeof parserMatcher, 'object');
assert.equal(typeof parserMatcher.minimatch, 'function');
assert.equal(parserMatcher.minimatch('config/check.ts', 'config/*.ts'), true);
assert.equal(parserMatcher.minimatch('config/check.js', 'config/*.ts'), false);
const elapsedMS = performance.now() - started;
const rssGrowth = Math.max(0, process.memoryUsage().rss - initialRSS);
assert(elapsedMS < 10_000, 'bounded controls exceeded ten seconds');
assert(rssGrowth < 128 * 1024 * 1024, 'bounded controls exceeded 128 MiB RSS growth');
console.log(JSON.stringify({ copies, assertions, parserCallerResolution: parserRequire.resolve('minimatch'), elapsedMS, rssGrowth }));
console.log('PASS installed legacy/modern minimatch APIs and bounded semantic controls (not a general exhaustion benchmark)');
