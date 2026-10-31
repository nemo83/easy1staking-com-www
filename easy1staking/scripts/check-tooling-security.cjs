#!/usr/bin/env node
'use strict';

// Known-version regression baselines for reviewed tooling, not a current audit.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const lockOnly = process.argv.includes('--lock-only');
const baselines = {
  '@eslint/plugin-kit': { 0: '0.4.1' },
  '@humanfs/node': { 0: '0.16.8' },
  ajv: { 6: '6.14.0' },
  'brace-expansion': { 1: '1.1.21', 2: '2.1.7', 5: '5.0.2' },
  eslint: { 9: '9.39.5' },
  flatted: { 3: '3.4.2' },
  glob: { 10: '10.5.0' },
  'js-yaml': { 4: '4.3.2' },
  minimatch: { 3: '3.1.4', 9: '9.0.7' },
  picomatch: { 2: '2.3.2', 4: '4.0.4' },
  'postcss-selector-parser': { 6: '6.1.5' },
  yaml: { 1: '1.10.3', 2: '2.8.3' },
};
const failures = [];
const copies = {};
let developmentYaml = 0;
function stable(version) {
  return typeof version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version);
}
function atLeast(version, minimum) {
  const a = version.split('.').map(Number), b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}
for (const [location, entry] of Object.entries(lock.packages || {})) {
  const name = location.split('node_modules/').pop();
  const reviewed = baselines[name];
  if (!reviewed) continue;
  copies[name] = (copies[name] || 0) + 1;
  const major = stable(entry.version) ? entry.version.split('.')[0] : '';
  const minimum = reviewed[major];
  if (!minimum || !atLeast(entry.version, minimum) || (name === 'picomatch' && major === '4' && entry.version !== '4.0.4')) {
    failures.push(`${location}: ${name}@${entry.version} requires a stable reviewed tooling baseline ${JSON.stringify(reviewed)}`);
  }
  if (name === 'yaml' && major === '2') {
    if (entry.dev !== true) failures.push(`${location}: unreviewed runtime YAML 2 resolution`);
    else developmentYaml++;
  }
  if (!lockOnly) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, location, 'package.json'), 'utf8'));
      if (pkg.name !== name || pkg.version !== entry.version) failures.push(`${location}: installed name/version differs from lock (${pkg.name}@${pkg.version})`);
    } catch (error) {
      failures.push(`${location}: installed metadata unavailable (${error.code || error.name})`);
    }
  }
}
for (const name of Object.keys(baselines)) {
  if (!copies[name]) failures.push(`lock has no reviewed tooling resolution for ${name}`);
}
if (!developmentYaml) failures.push('lock has no reviewed development YAML 2 resolution');
// Inspect nested installed copies too, so an unlocked target cannot hide behind
// a good root resolution. Optional platform packages may legitimately be absent.
function installedCopies(directory) {
  if (!fs.existsSync(directory)) return;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!item.isDirectory() || item.name.startsWith('.')) continue;
    const packagePath = path.join(directory, item.name);
    if (item.name.startsWith('@')) {
      installedCopies(packagePath);
      continue;
    }
    const location = path.relative(root, packagePath).split(path.sep).join('/');
    const name = location.split('node_modules/').pop();
    if (baselines[name] && !lock.packages[location]) failures.push(`${location}: installed tooling copy has no lock entry`);
    installedCopies(path.join(packagePath, 'node_modules'));
  }
}
if (!lockOnly) installedCopies(path.join(root, 'node_modules'));
console.log(JSON.stringify({ mode: lockOnly ? 'lock-only' : 'installed', lockedCopies: copies }));
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS reviewed tooling security baselines (run npm audit for current advisories)');
}
