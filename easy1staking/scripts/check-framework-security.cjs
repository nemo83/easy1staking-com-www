#!/usr/bin/env node
'use strict';

// Lock-only mode also works before installation, so an outdated lock is a
// reproducible failure independent of whether node_modules happens to exist.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const failures = [];
const targets = { next: '15.5.28', '@next/env': '15.5.28', sharp: '0.35.5' };
const stable = version => /^\d+\.\d+\.\d+$/.test(version || '');
function atLeast(version, minimum) {
  if (!stable(version)) return false;
  const a = version.split('.').map(Number), b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}
function baseline(name) {
  if (targets[name]) return targets[name];
  if (name.startsWith('@next/swc-')) return targets.next;
  if (name.startsWith('@img/sharp-libvips-')) return '1.3.4';
  if (name.startsWith('@img/sharp-')) return targets.sharp;
}
function check(name, version, location) {
  const minimum = baseline(name);
  if (minimum && !atLeast(version, minimum)) {
    failures.push(`${location}: ${name}@${version} requires stable >=${minimum}`);
  }
}
function packageFile(resolver, name) {
  // Some packages deliberately do not export package.json. Locate it from the
  // public entry point without importing an unexported package subpath.
  let directory = path.dirname(resolver.resolve(name));
  while (directory !== path.dirname(directory)) {
    const filename = path.join(directory, 'package.json');
    if (fs.existsSync(filename) && JSON.parse(fs.readFileSync(filename, 'utf8')).name === name) return filename;
    directory = path.dirname(directory);
  }
  throw new Error(`Cannot locate installed package metadata for ${name}`);
}
const counts = {};
for (const [location, entry] of Object.entries(lock.packages || {})) {
  const name = location.split('node_modules/').pop();
  if (!baseline(name)) continue;
  counts[name] = (counts[name] || 0) + 1;
  check(name, entry.version, location);
}
for (const name of Object.keys(targets)) {
  if (!counts[name]) failures.push(`lock has no resolved ${name}`);
}
console.log(JSON.stringify({ mode: process.argv.includes('--lock-only') ? 'lock-only' : 'installed', lockedCopies: counts }));

if (!process.argv.includes('--lock-only')) {
  try {
    const appRequire = createRequire(path.join(root, 'package.json'));
    const nextRequire = createRequire(appRequire.resolve('next/package.json'));
    const installed = {};
    for (const [name, resolver] of [['next', appRequire], ['@next/env', nextRequire], ['sharp', nextRequire]]) {
      const filename = packageFile(resolver, name);
      const pkg = JSON.parse(fs.readFileSync(filename, 'utf8'));
      const location = path.relative(root, path.dirname(filename)).split(path.sep).join('/');
      check(name, pkg.version, `installed ${location}`);
      if (lock.packages?.[location]?.version !== pkg.version) failures.push(`${location}: installed/lock version mismatch`);
      installed[name] = pkg.version;
    }
    const sharp = nextRequire('sharp');
    if (sharp.versions.sharp !== installed.sharp) failures.push('loaded sharp/installed version mismatch');
    // Require the platform addon that Sharp actually loaded, rather than treating
    // optional native entries for other platforms as proof of a working addon.
    const addons = Object.keys(require.cache).filter(filename => filename.endsWith('.node') && filename.includes(`${path.sep}@img${path.sep}sharp-`));
    if (!addons.length) failures.push('no loaded @img Sharp native addon');
    const native = addons.map(filename => {
      const directory = path.dirname(path.dirname(filename));
      const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      check(pkg.name, pkg.version, 'loaded native addon');
      const location = path.relative(root, directory).split(path.sep).join('/');
      if (lock.packages?.[location]?.version !== pkg.version) failures.push(`${location}: native installed/lock mismatch`);
      return { name: pkg.name, version: pkg.version };
    });
    console.log(JSON.stringify({ installed, native, sharpVersions: sharp.versions }));
  } catch (error) {
    failures.push(`installed verification failed: ${error.code || error.name}: ${error.message}`);
  }
}
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS framework/native image security baselines');
}
