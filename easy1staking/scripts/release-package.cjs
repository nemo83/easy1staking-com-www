#!/usr/bin/env node
'use strict';

// Packaging is deliberately separate from installation, building and deployment.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const inputs = ['package.json', 'package-lock.json', '.nvmrc', '.eslintrc.json', 'next.config.mjs', 'postcss.config.mjs', 'tailwind.config.ts', 'tsconfig.json'];
const markers = ['EASY1_RELEASE_PRIVATE_CANARY', 'Fabbrica-Contract:', '<!-- fabbrica:begin -->'];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const json = data => Buffer.from(JSON.stringify(data, null, 2) + '\n');
function insist(condition, message) { if (!condition) throw Error(message); }
function relative(name) {
  insist(typeof name === 'string' && name.length > 0 && !name.includes('\\') && !name.includes('\0') && !path.posix.isAbsolute(name) && name.split('/').every(x => x && x !== '.' && x !== '..') && !/[\r\n]/.test(name), 'unsafe relative path');
  return name;
}
function forbidden(name) {
  relative(name);
  return name.split('/').some(x => /^(?:\.env(?:\..*)?|\.git(?:ignore|attributes|modules)?|\.fabbrica|\.agents|\.codex|\.claude|\.aws|\.vscode|\.idea|AGENTS\.md|CLAUDE\.md|SPEC\.md|LAYOUT\.md|WORKLOG\.md|PLAN\.md|__tests__|__fixtures__|fixtures?|samples?|tests?|homepage-previews|brand-research|review-briefs)$/i.test(x)) || /(?:^|\/)(?:sample[-_.]article|article[-_.]sample|article-layout(?:\.|\/|$))/i.test(name);
}
function content(bytes, name) {
  // Known negative controls, not a claim to detect arbitrary secrets.
  insist(!markers.some(marker => bytes.includes(Buffer.from(marker))), 'forbidden content in ' + name); // RELEASE_CONTENT_GUARD
}
function sourcePath(name) {
  return inputs.includes(name) || name.startsWith('src/') || name.startsWith('public/');
}
function runtimePath(name) {
  return name === 'server.js' || name === 'package.json' || ['node_modules/', '.next/', 'public/'].some(prefix => name.startsWith(prefix));
}
function absolute(name) {
  insist(typeof name === 'string' && path.isAbsolute(name), 'absolute path required');
  const resolved = path.resolve(name);
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { insist(!fs.lstatSync(current).isSymbolicLink(), 'symlink path component'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return resolved;
}
function outside(a, b) {
  return a !== b && !a.startsWith(b + path.sep) && !b.startsWith(a + path.sep);
}
function fresh(name) { absolute(name); insist(!fs.existsSync(name), 'destination already exists'); }
function runGit(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: null, maxBuffer: 128 * 1024 * 1024, shell: false });
  insist(!result.error && result.status === 0 && !result.signal, 'git operation failed');
  return result.stdout;
}
function scripts(bytes) {
  const pkg = JSON.parse(bytes);
  const expected = { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint', clean: 'rm -rf .next package-lock.json node_modules' };
  insist(pkg.engines?.node === '24.x' && JSON.stringify(Object.keys(pkg.scripts || {}).sort()) === JSON.stringify(Object.keys(expected).sort()) && Object.entries(expected).every(([name, value]) => pkg.scripts[name] === value), 'unreviewed package scripts or Node engine');
}
function committed(repo, commit) {
  insist(/^[a-f0-9]{40}$/.test(commit || ''), 'full immutable commit required');
  insist(runGit(repo, ['rev-parse', '--verify', commit + '^{commit}']).toString().trim() === commit, 'commit identity mismatch');
  const records = runGit(repo, ['ls-tree', '-rz', commit, '--', 'easy1staking/']).toString().split('\0').filter(Boolean);
  const files = [];
  for (const record of records) {
    const match = /^(\d+) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(record);
    insist(match, 'unsupported Git tree entry');
    const [, mode, blob, filename] = match;
    const name = relative(filename.slice('easy1staking/'.length));
    if (!sourcePath(name)) continue;
    insist(!forbidden(name), 'forbidden source path: ' + name); // RELEASE_SOURCE_PATH_GUARD
    insist(mode === '100644' || mode === '100755', 'source symlink or unsupported mode');
    const bytes = runGit(repo, ['cat-file', 'blob', blob]);
    content(bytes, name);
    files.push({ path: name, mode, blob, size: bytes.length, sha256: sha(bytes), bytes });
  }
  insist(inputs.every(name => files.some(file => file.path === name)) && files.some(file => file.path.startsWith('src/')) && files.some(file => file.path.startsWith('public/')), 'missing build inputs');
  scripts(files.find(file => file.path === 'package.json').bytes);
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
function writeFile(root, name, bytes, mode = 0o644) {
  relative(name);
  const destination = path.join(root, name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes, { flag: 'wx', mode });
}
function manifestWrite(filename, manifest) {
  const bytes = json(manifest);
  fs.writeFileSync(filename, bytes, { flag: 'wx', mode: 0o600 });
  return sha(bytes);
}
function manifestRead(filename, expected, kind) {
  absolute(filename);
  insist(/^[a-f0-9]{64}$/.test(expected || ''), 'external expected manifest SHA256 required');
  const bytes = fs.readFileSync(filename);
  insist(sha(bytes) === expected, 'manifest identity mismatch'); // RELEASE_INVENTORY_GUARD
  const manifest = JSON.parse(bytes);
  insist(manifest.schema === 1 && manifest.kind === kind && /^[a-f0-9]{40}$/.test(manifest.commit) && Array.isArray(manifest.files) && manifest.files.length > 0, 'invalid manifest');
  const names = new Set();
  for (const file of manifest.files) {
    relative(file.path);
    insist(!names.has(file.path) && Number.isSafeInteger(file.size) && file.size >= 0 && /^[a-f0-9]{64}$/.test(file.sha256), 'invalid inventory entry');
    names.add(file.path);
  }
  return manifest;
}
function walk(root, visit, symlinks = false, directoryCheck = () => {}) {
  root = absolute(root);
  const rootReal = fs.realpathSync(root);
  function descend(directory, prefix, ancestors) {
    const real = fs.realpathSync(directory);
    insist(real === rootReal || real.startsWith(rootReal + path.sep), 'symlink escapes copy root');
    insist(!ancestors.has(real), 'symlink directory cycle');
    const next = new Set(ancestors).add(real);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const name = relative(prefix + entry.name), filename = path.join(directory, entry.name);
      let info = fs.lstatSync(filename);
      if (info.isSymbolicLink()) {
        insist(symlinks, 'symlink in inventory');
        const target = fs.realpathSync(filename);
        insist(target === rootReal || target.startsWith(rootReal + path.sep), 'symlink escapes copy root');
        info = fs.statSync(filename);
      }
      if (info.isDirectory()) { directoryCheck(name); descend(filename, name + '/', next); }
      else { insist(info.isFile(), 'unsupported filesystem entry'); visit(name, filename, info); }
    }
  }
  descend(root, '', new Set());
}
function exportSource({ repo, commit, source, manifest }) {
  repo = absolute(repo); source = absolute(source); manifest = absolute(manifest);
  insist(outside(source, repo) && outside(manifest, source), 'export/evidence must be outside repository and source');
  fresh(source); fresh(manifest);
  const files = committed(repo, commit);
  fs.mkdirSync(source, { mode: 0o700 });
  for (const file of files) writeFile(source, file.path, file.bytes, parseInt(file.mode, 8) & 0o777);
  const inventory = { schema: 1, kind: 'source', commit, lockSHA256: files.find(file => file.path === 'package-lock.json').sha256, files: files.map(({ bytes, ...file }) => file) };
  return { commit, files: files.length, manifestSHA256: manifestWrite(manifest, inventory) };
}
function verifySource({ source, manifest, expect, repo, commit }) {
  source = absolute(source);
  const inventory = manifestRead(manifest, expect, 'source');
  insist(outside(path.resolve(manifest), source), 'manifest inside source');
  if (commit) insist(commit === inventory.commit, 'source commit mismatch');
  const expected = new Map(inventory.files.map(file => [file.path, file]));
  if (repo) {
    const immutable = committed(absolute(repo), inventory.commit).map(({ bytes, ...file }) => file);
    insist(JSON.stringify(immutable) === JSON.stringify(inventory.files), 'manifest differs from committed blobs');
  }
  const seen = new Set();
  // Generated build/dependency paths are outside the immutable source inventory.
  for (const name of fs.readdirSync(source)) {
    if (['node_modules', '.next', 'next-env.d.ts', 'tsconfig.tsbuildinfo'].includes(name)) {
      insist(!fs.lstatSync(path.join(source, name)).isSymbolicLink(), 'generated path symlink');
      continue;
    }
    const filename = path.join(source, name);
    const check = (relativeName, file) => {
      insist(sourcePath(relativeName) && !forbidden(relativeName), 'unexpected export file');
      const bytes = fs.readFileSync(file); content(bytes, relativeName);
      const record = expected.get(relativeName);
      insist(record && record.size === bytes.length && record.sha256 === sha(bytes), 'source file identity mismatch');
      const mode = fs.statSync(file).mode & 0o777;
      insist(mode === (parseInt(record.mode, 8) & 0o777), 'source mode mismatch');
      seen.add(relativeName);
    };
    insist(!fs.lstatSync(filename).isSymbolicLink(), 'source symlink');
    if (fs.statSync(filename).isDirectory()) walk(filename, (child, file) => check(name + '/' + child, file));
    else check(name, filename);
  }
  insist(seen.size === expected.size && inventory.lockSHA256 === expected.get('package-lock.json')?.sha256, 'incomplete source inventory');
  scripts(fs.readFileSync(path.join(source, 'package.json')));
  return inventory;
}
function runtimeInventory(runtime) {
  const files = [], packages = [], native = [];
  walk(runtime, (name, filename, info) => {
    insist(runtimePath(name) && !forbidden(name), 'forbidden runtime path: ' + name); // RELEASE_RUNTIME_PATH_GUARD
    const bytes = fs.readFileSync(filename); content(bytes, name);
    // Image optimization is the sole documented mutable subtree. It is scanned,
    // but its legitimate generated entries do not change the retained identity.
    if (name.startsWith('.next/cache/')) return;
    const record = { path: name, size: bytes.length, sha256: sha(bytes), mode: info.mode & 0o777 };
    files.push(record);
    if (name.endsWith('/package.json') || name === 'package.json') {
      const pkg = JSON.parse(bytes);
      packages.push({ path: name, name: pkg.name || null, version: pkg.version || null, sha256: record.sha256 });
    }
    if (/\.(?:node|so(?:\.\d+)*)$/.test(name)) native.push(record);
  }, false, name => insist(runtimePath(name + '/') && !forbidden(name), 'forbidden runtime directory')); // RELEASE_RUNTIME_DIRECTORY_GUARD
  for (const name of ['server.js', 'package.json', '.next/BUILD_ID', 'node_modules/next/package.json']) insist(files.some(file => file.path === name), 'missing required runtime file: ' + name);
  insist(files.some(file => file.path.startsWith('public/')) && files.some(file => file.path.startsWith('.next/static/')), 'missing runtime assets');
  insist(native.some(file => file.path.endsWith('.node')), 'missing native runtime addon');
  return { files, packages, native };
}
function pack({ source, sourceManifest, sourceExpect, runtime, manifest }) {
  source = absolute(source); runtime = absolute(runtime); manifest = absolute(manifest);
  insist(outside(runtime, source) && outside(manifest, runtime), 'runtime and evidence must be separate');
  fresh(runtime); fresh(manifest);
  const input = verifySource({ source, manifest: sourceManifest, expect: sourceExpect });
  const standalone = path.join(source, '.next/standalone');
  insist(fs.statSync(standalone).isDirectory(), 'missing standalone build');
  const staged = new Map();
  function collect(root, prefix, symlinks) {
    walk(root, (name, filename, info) => {
      name = prefix + name;
      insist(runtimePath(name) && !forbidden(name), 'forbidden runtime path: ' + name); // RELEASE_PACK_PATH_GUARD
      const bytes = fs.readFileSync(filename); content(bytes, name);
      if (name.startsWith('.next/cache/')) return;
      insist(!staged.has(name), 'duplicate runtime destination');
      staged.set(name, { bytes, mode: info.mode & 0o777 });
    }, symlinks, name => insist(runtimePath(prefix + name + '/') && !forbidden(prefix + name), 'forbidden packaged directory')); // RELEASE_PACK_DIRECTORY_GUARD
  }
  collect(standalone, '', true);
  collect(path.join(source, 'public'), 'public/', false);
  collect(path.join(source, '.next/static'), '.next/static/', false);
  fs.mkdirSync(runtime, { mode: 0o700 });
  for (const [name, file] of staged) writeFile(runtime, name, file.bytes, file.mode);
  const entries = runtimeInventory(runtime);
  const buildId = fs.readFileSync(path.join(runtime, '.next/BUILD_ID'), 'utf8').trim();
  insist(/^[a-zA-Z0-9_-]+$/.test(buildId), 'invalid BUILD_ID');
  const inventory = { schema: 1, kind: 'runtime', commit: input.commit, sourceManifestSHA256: sourceExpect, lockSHA256: input.lockSHA256, buildId, mutable: ['.next/cache/**'], ...entries };
  return { commit: input.commit, buildId, files: entries.files.length, packages: entries.packages.length, native: entries.native.length, manifestSHA256: manifestWrite(manifest, inventory) };
}
function verify({ runtime, manifest, expect }) {
  runtime = absolute(runtime);
  insist(outside(path.resolve(manifest), runtime), 'manifest inside runtime');
  const inventory = manifestRead(manifest, expect, 'runtime');
  insist(JSON.stringify(inventory.mutable) === JSON.stringify(['.next/cache/**']), 'unexpected mutable boundary');
  const actual = runtimeInventory(runtime);
  insist(JSON.stringify(actual.files) === JSON.stringify(inventory.files) && JSON.stringify(actual.packages) === JSON.stringify(inventory.packages) && JSON.stringify(actual.native) === JSON.stringify(inventory.native), 'runtime inventory mismatch'); // RELEASE_RUNTIME_INVENTORY_GUARD
  insist(fs.readFileSync(path.join(runtime, '.next/BUILD_ID'), 'utf8').trim() === inventory.buildId && /^[a-f0-9]{64}$/.test(inventory.sourceManifestSHA256) && /^[a-f0-9]{64}$/.test(inventory.lockSHA256), 'runtime lineage mismatch');
  return { commit: inventory.commit, buildId: inventory.buildId, files: actual.files.length, packages: actual.packages.length, native: actual.native.length, manifestSHA256: expect, mutable: inventory.mutable };
}
const commands = {
  export: { required: ['repo', 'commit', 'source', 'manifest'], run: exportSource },
  'verify-source': { required: ['source', 'manifest', 'expect'], optional: ['repo', 'commit'], run: verifySource },
  pack: { required: ['source', 'source-manifest', 'source-expect', 'runtime', 'manifest'], run: pack },
  verify: { required: ['runtime', 'manifest', 'expect'], run: verify },
};
function main(argv) {
  const command = commands[argv.shift()]; insist(command, 'expected export, verify-source, pack or verify');
  const options = {};
  while (argv.length) {
    const key = argv.shift(); insist(/^--[a-z-]+$/.test(key || '') && argv.length > 0, 'expected --option value');
    const name = key.slice(2); insist([...command.required, ...(command.optional || [])].includes(name) && !(name in options), 'unknown or duplicate option');
    options[name] = argv.shift();
  }
  insist(command.required.every(name => options[name]), 'missing required option');
  const camel = Object.fromEntries(Object.entries(options).map(([name, value]) => [name.replace(/-([a-z])/g, (_, x) => x.toUpperCase()), value]));
  const result = command.run(camel);
  console.log(JSON.stringify({ status: 'PASS', ...(result.kind ? { commit: result.commit, files: result.files.length, manifestSHA256: options.expect } : result) }));
}
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error('FAIL release package: ' + error.message); process.exitCode = 1; }
}
module.exports = { main };
