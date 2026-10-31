#!/usr/bin/env node
'use strict';

// Actual CLI controls use only synthetic Git/build fixtures in a fresh directory.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const [scratch, selected] = process.argv.slice(2);
assert(path.isAbsolute(scratch || '') && !fs.existsSync(scratch), 'new absolute scratch directory required');
fs.mkdirSync(scratch, { mode: 0o700 });
const cli = path.join(__dirname, 'release-package.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const results = [];
function command(executable, args, cwd) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', shell: false, maxBuffer: 16 * 1024 * 1024 });
  assert(!result.error && result.signal === null, 'child process failed');
  return result;
}
function invoke(phase, options, success = true) {
  const args = Object.entries(options).flatMap(([name, value]) => ['--' + name, value]);
  const result = command(process.execPath, [cli, phase, ...args]);
  if (success) {
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout); assert.equal(output.status, 'PASS'); return output;
  }
  assert.equal(result.status, 1, 'forbidden actual object was admitted: ' + result.stdout);
  assert.match(result.stderr, /^FAIL release package:/); return result;
}
function file(root, name, data) { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), data); }
function git(args) { const r = command('git', args, repo); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); }
function commit() { git(['add', '--', '.']); git(['-c', 'user.name=Release fixture', '-c', 'user.email=fixture@invalid.example', 'commit', '-m', 'Synthetic release fixture']); return git(['rev-parse', 'HEAD']); }
function check(name, action) {
  if (selected && selected !== name) return;
  action(); results.push(name); console.log('PASS ' + name);
}
const repo = path.join(scratch, 'repo'); fs.mkdirSync(repo);
git(['init', '--initial-branch=fixture']);
const app = path.join(repo, 'easy1staking');
for (const name of ['package.json', 'package-lock.json', '.nvmrc', '.eslintrc.json', 'next.config.mjs', 'postcss.config.mjs', 'tailwind.config.ts', 'tsconfig.json']) file(app, name, fs.readFileSync(path.join(__dirname, '..', name)));
file(app, 'src/app/page.tsx', 'export default function Page() { return null; }\n');
file(app, 'public/good.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
for (const name of ['AGENTS.md', 'docs/brand-research/homepage-previews/sample.html', '.fabbrica/private.txt', 'easy1staking/.env.example', 'easy1staking/scripts/dev.cjs', 'easy1staking/fixtures/sample.txt']) file(repo, name, 'EASY1_RELEASE_PRIVATE_CANARY');
const base = commit();
let serial = 0;
function exported() {
  const id = String(++serial), source = path.join(scratch, 'source-' + id), manifest = path.join(scratch, 'source-' + id + '.json');
  const report = invoke('export', { repo, commit: base, source, manifest });
  return { source, manifest, expect: report.manifestSHA256 };
}
function built() {
  const source = exported(), root = path.join(source.source, '.next/standalone');
  file(root, 'server.js', '// synthetic inert startup\n');
  file(root, 'package.json', '{"name":"synthetic-app","version":"1.0.0"}');
  file(root, 'node_modules/next/package.json', '{"name":"next","version":"15.5.28"}');
  file(root, 'node_modules/@img/sharp-linux-x64/package.json', '{"name":"@img/sharp-linux-x64","version":"0.35.5"}');
  file(root, 'node_modules/@img/sharp-linux-x64/lib/sharp.node', 'synthetic-native-not-executed');
  file(root, '.next/BUILD_ID', 'synthetic-build');
  file(root, '.next/server/app/page.js', '// inert compiled fixture\n');
  file(source.source, '.next/static/chunks/app.js', '// inert browser fixture\n');
  return { ...source, root };
}
function packed(build = built()) {
  const id = String(++serial), runtime = path.join(scratch, 'runtime-' + id), manifest = path.join(scratch, 'runtime-' + id + '.json');
  const report = invoke('pack', { source: build.source, 'source-manifest': build.manifest, 'source-expect': build.expect, runtime, manifest });
  return { runtime, manifest, expect: report.manifestSHA256 };
}
function forged(runtime, modify) {
  const inventory = JSON.parse(fs.readFileSync(runtime.manifest)); modify(inventory);
  const filename = path.join(scratch, 'forged-' + ++serial + '.json');
  const bytes = Buffer.from(JSON.stringify(inventory, null, 2) + '\n'); fs.writeFileSync(filename, bytes);
  return { runtime: runtime.runtime, manifest: filename, expect: sha(bytes) };
}
check('immutable-source', () => {
  file(app, 'src/app/page.tsx', 'dirty content ignored'); file(app, 'public/untracked.txt', 'ignored');
  const output = exported();
  assert.equal(fs.readFileSync(path.join(output.source, 'src/app/page.tsx'), 'utf8'), 'export default function Page() { return null; }\n');
  assert(!fs.existsSync(path.join(output.source, 'public/untracked.txt')));
  assert.deepEqual(fs.readdirSync(output.source).sort(), ['.eslintrc.json', '.nvmrc', 'next.config.mjs', 'package-lock.json', 'package.json', 'postcss.config.mjs', 'public', 'src', 'tailwind.config.ts', 'tsconfig.json'].sort());
  invoke('verify-source', { ...output, repo, commit: base });
});
check('source-private', () => {
  file(app, 'src/fixtures/private.txt', 'synthetic private fixture'); const bad = commit();
  invoke('export', { repo, commit: bad, source: path.join(scratch, 'bad-private'), manifest: path.join(scratch, 'bad-private.json') }, false);
  assert(exported().expect);
  git(['restore', '--source=' + base, '--staged', '--worktree', '--', '.']);
});
check('source-env-sample', () => {
  for (const name of ['public/.env.example', 'public/article-layout.html', 'src/.fabbrica/private.txt']) {
    git(['restore', '--source=' + base, '--staged', '--worktree', '--', '.']);
    file(app, name, 'synthetic private fixture'); const bad = commit();
    invoke('export', { repo, commit: bad, source: path.join(scratch, 'bad-' + ++serial), manifest: path.join(scratch, 'bad-' + serial + '.json') }, false);
  }
  git(['restore', '--source=' + base, '--staged', '--worktree', '--', '.']);
});
check('source-symlink', () => {
  fs.symlinkSync('/tmp', path.join(app, 'public/escape')); const bad = commit();
  invoke('export', { repo, commit: bad, source: path.join(scratch, 'bad-link'), manifest: path.join(scratch, 'bad-link.json') }, false);
});
check('source-tamper', () => {
  const output = exported(); file(output.source, 'public/good.svg', 'changed');
  invoke('verify-source', { ...output, repo }, false);
  const inventory = JSON.parse(fs.readFileSync(output.manifest)); inventory.files.find(x => x.path === 'public/good.svg').sha256 = sha(Buffer.from('changed'));
  const changed = Buffer.from(JSON.stringify(inventory, null, 2) + '\n'); fs.writeFileSync(output.manifest, changed);
  invoke('verify-source', { ...output, repo }, false);
  invoke('verify-source', { ...output, expect: sha(changed), repo }, false);
});
check('valid-runtime', () => {
  const runtime = packed(); invoke('verify', runtime);
  assert(fs.existsSync(path.join(runtime.runtime, 'public/good.svg')));
  file(runtime.runtime, '.next/cache/images/synthetic/cache.webp', 'legitimate mutable image cache'); invoke('verify', runtime);
});
check('runtime-private', () => {
  const runtime = packed(); file(runtime.runtime, 'public/fixtures/private.txt', 'private fixture');
  const attack = forged(runtime, inventory => inventory.files.push({ path: 'public/fixtures/private.txt', size: 15, sha256: sha(Buffer.from('private fixture')), mode: 0o644 }));
  // Keep the inventory's physical traversal order, so only the path guard decides.
  const inv = JSON.parse(fs.readFileSync(attack.manifest));
  inv.files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const bytes = Buffer.from(JSON.stringify(inv, null, 2) + '\n'); fs.writeFileSync(attack.manifest, bytes); attack.expect = sha(bytes);
  invoke('verify', attack, false);
  const build = built(); file(build.root, 'public/fixtures/private.txt', 'private fixture');
  invoke('pack', { source: build.source, 'source-manifest': build.manifest, 'source-expect': build.expect, runtime: path.join(scratch, 'bad-runtime'), manifest: path.join(scratch, 'bad-runtime.json') }, false);
});
check('content', () => {
  const runtime = packed(), name = '.next/server/app/page.js', bytes = Buffer.from('EASY1_RELEASE_PRIVATE_CANARY');
  file(runtime.runtime, name, bytes);
  const attack = forged(runtime, inventory => Object.assign(inventory.files.find(x => x.path === name), { size: bytes.length, sha256: sha(bytes) }));
  invoke('verify', attack, false);
  const build = built(); file(build.root, '.next/server/private.js', bytes);
  invoke('pack', { source: build.source, 'source-manifest': build.manifest, 'source-expect': build.expect, runtime: path.join(scratch, 'bad-content'), manifest: path.join(scratch, 'bad-content.json') }, false);
});
check('inventory-tamper', () => {
  const runtime = packed(); file(runtime.runtime, 'server.js', '// changed runtime\n'); invoke('verify', runtime, false);
  const changed = forged(runtime, inventory => Object.assign(inventory.files.find(x => x.path === 'server.js'), { size: 19, sha256: sha(Buffer.from('// changed runtime\n')) }));
  invoke('verify', { ...changed, expect: runtime.expect }, false);
  const valid = packed(); invoke('verify', valid);
});
check('runtime-boundaries', () => {
  for (const name of ['.env', 'private.txt', 'scripts/start.js', 'src/page.js', 'docs/readme.md']) {
    const build = built(); file(build.root, name, 'synthetic');
    invoke('pack', { source: build.source, 'source-manifest': build.manifest, 'source-expect': build.expect, runtime: path.join(scratch, 'bad-' + ++serial), manifest: path.join(scratch, 'bad-' + serial + '.json') }, false);
  }
  for (const name of ['server.js', '.next/BUILD_ID', 'node_modules/@img/sharp-linux-x64/lib/sharp.node']) {
    const runtime = packed(); fs.unlinkSync(path.join(runtime.runtime, name)); invoke('verify', runtime, false);
  }
  const build = built(); fs.symlinkSync('/etc', path.join(build.root, 'node_modules/escape'));
  invoke('pack', { source: build.source, 'source-manifest': build.manifest, 'source-expect': build.expect, runtime: path.join(scratch, 'escape'), manifest: path.join(scratch, 'escape.json') }, false);
  const safe = built(); fs.symlinkSync('app/page.js', path.join(safe.root, '.next/server/local.js'));
  const runtime = packed(safe); assert(!fs.lstatSync(path.join(runtime.runtime, '.next/server/local.js')).isSymbolicLink()); invoke('verify', runtime);
});
check('arguments-overwrite', () => {
  const source = exported(); invoke('export', { repo, commit: base, source: source.source, manifest: source.manifest }, false);
  for (const commit of ['HEAD', '--help', base + ';touch /tmp/no']) invoke('export', { repo, commit, source: path.join(scratch, 'invalid-' + ++serial), manifest: path.join(scratch, 'invalid-' + serial + '.json') }, false);
  const runtime = packed(); invoke('verify', { runtime: runtime.runtime, manifest: runtime.manifest, expect: '0'.repeat(64) }, false);
  const attack = forged(runtime, inventory => inventory.files[0].path = '../escape'); invoke('verify', attack, false);
  const link = path.join(scratch, 'link'); fs.symlinkSync(source.source, link);
  invoke('export', { repo, commit: base, source: path.join(link, 'child'), manifest: path.join(scratch, 'link.json') }, false);
});
assert(results.length > 0, 'no controls selected');
console.log(JSON.stringify({ passed: results.length, failed: 0, controls: results }));
