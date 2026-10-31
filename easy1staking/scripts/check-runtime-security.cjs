#!/usr/bin/env node
'use strict';

// This is a regression baseline for the reviewed runtime majors, not an audit.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const lockOnly = process.argv.includes('--lock-only');
const baselines = {
  '@babel/runtime': '7.26.10',
  nanoid: '3.3.18',
  postcss: '8.5.23',
  'source-map-js': '1.2.2',
  undici: '7.30.1',
  'websocket-driver': '0.7.5',
  yaml: '1.10.3',
};
const failures = [];
const copies = {};
const developmentYaml = [];
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
  const minimum = baselines[name];
  if (!minimum) continue;
  // YAML 2 is reviewed only as patched development tooling, never runtime.
  const reviewedDevYaml = name === 'yaml' && stable(entry.version) && entry.version.split('.')[0] === '2' && entry.dev === true && atLeast(entry.version, '2.8.3');
  if (reviewedDevYaml) developmentYaml.push({ location, version: entry.version });
  else {
    if (name === 'yaml' && stable(entry.version) && entry.version.split('.')[0] === '2' && entry.dev !== true) failures.push(`${location}: unreviewed runtime YAML 2 resolution`);
    copies[name] = (copies[name] || 0) + 1;
    if (!stable(entry.version) || entry.version.split('.')[0] !== minimum.split('.')[0] || !atLeast(entry.version, minimum)) {
      failures.push(`${location}: ${name}@${entry.version} requires stable >=${minimum} within reviewed major ${minimum.split('.')[0]}`);
    }
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
  if (!copies[name]) failures.push(`lock has no reviewed runtime resolution for ${name}`);
}
console.log(JSON.stringify({ mode: lockOnly ? 'lock-only' : 'installed', lockedCopies: copies, reviewedDevelopmentYamlCopies: developmentYaml }));
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS reviewed runtime security baselines and patched development YAML (run npm audit)');
}
