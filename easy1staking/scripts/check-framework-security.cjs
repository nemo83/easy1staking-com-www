// Check the lock alone before installation with --lock-only; otherwise verify installed/native copies too.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const failures = [];
const checked = [];
const lockOnly = process.argv.slice(2).includes('--lock-only');
if (process.argv.slice(2).some(arg => arg !== '--lock-only')) throw new Error('Only --lock-only is supported');

function baseline(name) {
  if (name === 'librsvg') return [2, 63, 2];
  if (name === 'next' || name === '@next/env' || name.startsWith('@next/swc-') || name === 'eslint-config-next')
    return [15, 5, 28];
  if (name === 'sharp' || name.startsWith('@img/sharp-'))
    return name.startsWith('@img/sharp-libvips-') ? [1, 3, 4] : [0, 35, 5];
}
function check(name, version, location) {
  const minimum = baseline(name);
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version || '');
  const actual = match && match.slice(1).map(Number);
  const compare = actual && actual.reduce((result, value, index) => result || Math.sign(value - minimum[index]), 0);
  if (!actual || actual[0] !== minimum[0] || compare < 0)
    failures.push(`${location}: ${name}@${version || 'missing'} requires stable >=${minimum.join('.')} within major ${minimum[0]}`);
  checked.push({ location, name, version });
}

const found = new Set();
for (const [location, entry] of Object.entries(lock.packages || {})) {
  if (!location.includes('node_modules/')) continue;
  const name = location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length);
  if (!baseline(name)) continue;
  found.add(name);
  check(name, entry.version, `lock:${location}`);
  if (!lockOnly) {
    const installed = path.join(root, location, 'package.json');
    if (fs.existsSync(installed)) check(name, JSON.parse(fs.readFileSync(installed, 'utf8')).version, `installed:${location}`);
    else if (!entry.optional) failures.push(`Missing installed package: ${location}`);
  }
}
for (const name of ['next', '@next/env', 'sharp', 'eslint-config-next'])
  if (!found.has(name)) failures.push(`Lock is missing ${name}`);

if (!lockOnly && failures.length === 0) {
  try {
    const projectRequire = createRequire(path.join(root, 'package.json'));
    const nextRequire = createRequire(projectRequire.resolve('next/package.json'));
    const sharpPath = nextRequire.resolve('sharp');
    const sharp = nextRequire('sharp');
    check('sharp', sharp.versions.sharp, `loaded:${sharpPath}`);
    check('librsvg', sharp.versions.rsvg, `loaded:${sharpPath}`);
    // Loaded native binaries and codec versions are evidence beyond manifest labels.
    console.log(JSON.stringify({ sharpPath, versions: sharp.versions }));
    const platform = process.platform === 'linux' && !process.report.getReport().header.glibcVersionRuntime ? 'linuxmusl' : process.platform;
    const nativeName = `@img/sharp-${platform}-${process.arch}`;
    const nativeRequire = createRequire(sharpPath);
    const nativePath = nativeRequire.resolve(`${nativeName}/package`);
    check(nativeName, JSON.parse(fs.readFileSync(nativePath, 'utf8')).version, `loaded:${nativePath}`);
    if (process.platform !== 'win32') {
      const vipsName = `@img/sharp-libvips-${platform}-${process.arch}`;
      const vipsPath = nativeRequire.resolve(`${vipsName}/package`);
      check(vipsName, JSON.parse(fs.readFileSync(vipsPath, 'utf8')).version, `loaded:${vipsPath}`);
    }
  } catch (error) { failures.push(`Native resolution failed: ${error.message}`); }
}
for (const failure of failures) console.error(`FAIL ${failure}`);
console.log(JSON.stringify({ mode: lockOnly ? 'lock-only' : 'lock-and-installed-native', checked, failures: failures.length }));
if (failures.length) process.exitCode = 1;
