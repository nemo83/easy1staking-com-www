#!/usr/bin/env node
'use strict';

// Known-version regression baselines for reviewed tooling, not a current audit.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const lockOnly = process.argv.includes('--lock-only');
const baselines = {
  '@eslint/plugin-kit': { 0: '0.4.1' },
  '@humanfs/node': { 0: '0.16.8' },
  ajv: { 6: '6.14.0' },
  'brace-expansion': { 1: '1.1.21', 2: '2.1.7', 5: '5.0.12' },
  eslint: { 9: '9.39.5' },
  flatted: { 3: '3.4.2' },
  'js-yaml': { 4: '4.3.2' },
  minimatch: { 3: '3.1.5', 11: '11.0.3' },
  picomatch: { 2: '2.3.2', 4: '4.0.4' },
  'postcss-selector-parser': { 6: '6.1.5' },
  sucrase: { 3: '3.35.1' },
  yaml: { 1: '1.10.3', 2: '2.8.3' },
};
const legacy = {
  version: '3.1.5',
  resolved: 'https://registry.npmjs.org/minimatch/-/minimatch-3.1.5.tgz',
  integrity: 'sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==',
  sha256: '746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d',
};
const assessment = JSON.parse(fs.readFileSync(path.join(root, '../docs/tooling-advisories.json'), 'utf8'));
const disposition = assessment.advisories.find(item => item.id === 'GHSA-g3hv-75wg-m249' && item.package === 'minimatch' && item.version === legacy.version);
const failures = [];
if (!disposition || disposition.status !== 'not_affected' || disposition.justification !== 'vulnerable_code_not_present' || disposition.source?.sha256 !== legacy.sha256 || disposition.source?.commit !== '7bba97888a27a6162983056bcce2a6e28f668712' || disposition.lock?.integrity !== legacy.integrity || disposition.lock?.resolved !== legacy.resolved) failures.push('exact legacy minimatch source/advisory disposition is missing or changed');
const copies = {};
let developmentYaml = 0;
const matcherMajors = { 3: 0, 11: 0 };
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
  if (name === 'glob') failures.push(`${location}: glob@${entry.version} is forbidden; use the reviewed Sucrase patch`);
  const reviewed = baselines[name];
  if (!reviewed) continue;
  copies[name] = (copies[name] || 0) + 1;
  const major = stable(entry.version) ? entry.version.split('.')[0] : '';
  const minimum = reviewed[major];
  if (!minimum || !atLeast(entry.version, minimum) || (name === 'picomatch' && major === '4' && entry.version !== '4.0.4' && !(entry.dev === true && entry.version === '4.0.7'))) {
    failures.push(`${location}: ${name}@${entry.version} requires a stable reviewed tooling baseline ${JSON.stringify(reviewed)}`);
  }
  if (name === 'minimatch') {
    if (Object.hasOwn(matcherMajors, major)) matcherMajors[major]++;
    if (entry.dev !== true) failures.push(`${location}: unreviewed runtime minimatch resolution`);
    if (major === '3' && (entry.version !== legacy.version || entry.resolved !== legacy.resolved || entry.integrity !== legacy.integrity)) failures.push(`${location}: legacy minimatch requires exact 3.1.5 registry/source identity`);
  }
  if (name === 'yaml' && major === '2') {
    if (entry.dev !== true) failures.push(`${location}: unreviewed runtime YAML 2 resolution`);
    else developmentYaml++;
  }
  if (!lockOnly) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, location, 'package.json'), 'utf8'));
      if (pkg.name !== name || pkg.version !== entry.version) failures.push(`${location}: installed name/version differs from lock (${pkg.name}@${pkg.version})`);
      if (name === 'minimatch' && major === '3') {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, location, 'minimatch.js'))).digest('hex');
        if (hash !== legacy.sha256) failures.push(`${location}: installed legacy minimatch source SHA256 differs from reviewed 3.1.5`);
      }
    } catch (error) {
      failures.push(`${location}: installed metadata unavailable (${error.code || error.name})`);
    }
  }
}
for (const name of Object.keys(baselines)) {
  if (!copies[name]) failures.push(`lock has no reviewed tooling resolution for ${name}`);
}
if (!developmentYaml) failures.push('lock has no reviewed development YAML 2 resolution');
for (const major of Object.keys(matcherMajors)) {
  if (!matcherMajors[major]) failures.push(`lock has no reviewed minimatch ${major} resolution`);
}
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
    if (name === 'glob') failures.push(`${location}: installed glob copy is forbidden`);
    if (baselines[name] && !lock.packages[location]) failures.push(`${location}: installed tooling copy has no lock entry`);
    installedCopies(path.join(packagePath, 'node_modules'));
  }
}
if (!lockOnly) installedCopies(path.join(root, 'node_modules'));
console.log(JSON.stringify({ mode: lockOnly ? 'lock-only' : 'installed', lockedCopies: copies, legacyMinimatchAssessment: 'GHSA-g3hv-75wg-m249: exact source assessed not affected; raw audit remains separate' }));
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS reviewed tooling security baselines and exact legacy source assessment (report raw npm audit separately)');
}
