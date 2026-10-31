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
  for (const [name, kind, extensions] of [['about', 'APP_PAGE', ['html', 'rsc']], ['robots.txt', 'APP_ROUTE', ['body']]]) {
    file(root, '.next/server/app/' + name + '.meta', JSON.stringify({ status: 200, headers: { 'content-type': kind === 'APP_PAGE' ? 'text/html' : 'text/plain' }, routeCache: { key: '/route-cache/' + kind + '/' + 'a'.repeat(64) + '/$/' + name, owner: { kind, sourceRoute: '/' + name + (kind === 'APP_PAGE' ? '/page' : '/route') }, isFallback: false } }));
    for (const extension of extensions) file(root, '.next/server/app/' + name + '.' + extension, 'synthetic-' + extension + '-payload');
  }
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
function populate(runtime, names = ['about.html', 'about.rsc', 'about.meta', 'robots.txt.body', 'robots.txt.meta']) {
  const generated = [];
  for (const name of names) {
    const stem = name.replace(/\.(html|rsc|body|meta)$/, '');
    const meta = JSON.parse(fs.readFileSync(path.join(runtime.runtime, '.next/server/app/' + stem + '.meta')));
    const extension = path.extname(name), destination = '.next/server' + meta.routeCache.key + extension;
    const bytes = extension === '.meta' ? Buffer.from(JSON.stringify({ ...meta, routeCacheLastModified: 123456 })) : fs.readFileSync(path.join(runtime.runtime, '.next/server/app/' + name));
    file(runtime.runtime, destination, bytes); generated.push(destination);
  }
  return generated;
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
  const safe = built(); fs.symlinkSync('../../.next/server/app/page.js', path.join(safe.root, 'node_modules/next/local.js'));
  const runtime = packed(safe); assert(!fs.lstatSync(path.join(runtime.runtime, 'node_modules/next/local.js')).isSymbolicLink()); invoke('verify', runtime);
});
check('arguments-overwrite', () => {
  const source = exported(); invoke('export', { repo, commit: base, source: source.source, manifest: source.manifest }, false);
  for (const commit of ['HEAD', '--help', base + ';touch /tmp/no']) invoke('export', { repo, commit, source: path.join(scratch, 'invalid-' + ++serial), manifest: path.join(scratch, 'invalid-' + serial + '.json') }, false);
  const runtime = packed(); invoke('verify', { runtime: runtime.runtime, manifest: runtime.manifest, expect: '0'.repeat(64) }, false);
  const attack = forged(runtime, inventory => inventory.files[0].path = '../escape'); invoke('verify', attack, false);
  const link = path.join(scratch, 'link'); fs.symlinkSync(source.source, link);
  invoke('export', { repo, commit: base, source: path.join(link, 'child'), manifest: path.join(scratch, 'link.json') }, false);
});
check('cache-valid', () => {
  const runtime = packed(); assert.equal(invoke('verify', runtime).schema, 2);
  populate(runtime, ['about.html']); assert.equal(invoke('verify', runtime).generated.routeCache.length, 1);
  populate(runtime); file(runtime.runtime, '.next/cache/images/synthetic/image.webp', 'synthetic image bytes');
  const report = invoke('verify', runtime); assert.equal(report.generated.routeCache.length, 5); assert.equal(report.generated.imageCache.length, 1);
  for (const entry of report.generated.routeCache) assert(entry.immutableOriginal && entry.sha256 && entry.size > 0 && entry.mode === (fs.statSync(path.join(runtime.runtime, entry.path)).mode & 0o777) && (entry.mode & 0o111) === 0);
  const build = built(), staged = { runtime: build.root }; populate(staged);
  const output = packed(build); assert.equal(invoke('verify', output).generated.routeCache.length, 0);
  assert(!fs.existsSync(path.join(output.runtime, '.next/server/route-cache')));
});
check('cache-payload', () => {
  for (const name of ['about.html', 'about.rsc', 'robots.txt.body']) {
    const runtime = packed(), [destination] = populate(runtime, [name]); invoke('verify', runtime);
    const original = fs.readFileSync(path.join(runtime.runtime, destination));
    file(runtime.runtime, destination, Buffer.concat([Buffer.from('X'), original.subarray(1)]));
    invoke('verify', runtime, false);
    file(runtime.runtime, destination, original); invoke('verify', runtime);
  }
});
check('cache-metadata', () => {
  const runtime = packed(), [destination] = populate(runtime, ['about.meta']); invoke('verify', runtime);
  const original = fs.readFileSync(path.join(runtime.runtime, destination));
  for (const mutate of [m => m.headers['content-type'] = 'text/javascript', m => m.status = 500, m => m.extra = true, m => m.routeCacheLastModified = '123', m => m.routeCacheLastModified = -1, m => delete m.routeCacheLastModified, m => m.routeCache.owner.kind = 'APP_ROUTE', m => m.routeCache.key = m.routeCache.key.replace('a', 'b')]) {
    const meta = JSON.parse(original); mutate(meta); file(runtime.runtime, destination, JSON.stringify(meta)); invoke('verify', runtime, false);
  }
  file(runtime.runtime, destination, original); invoke('verify', runtime);
});
check('cache-boundaries', () => {
  for (const name of ['about.html.js', 'unknown.html', 'fixtures/private.html']) {
    const runtime = packed(), [valid] = populate(runtime, ['about.html']);
    file(runtime.runtime, valid.replace('about.html', name), 'synthetic'); invoke('verify', runtime, false);
  }
  for (const mutate of ['key', 'canary', 'symlink', 'executable']) {
    const runtime = packed(), [destination] = populate(runtime, ['about.html']); invoke('verify', runtime);
    const filename = path.join(runtime.runtime, destination);
    if (mutate === 'key') { const other = filename.replace('a'.repeat(64), 'b'.repeat(64)); fs.mkdirSync(path.dirname(other), { recursive: true }); fs.renameSync(filename, other); }
    if (mutate === 'canary') file(runtime.runtime, destination, 'EASY1_RELEASE_PRIVATE_CANARY');
    if (mutate === 'symlink') { fs.unlinkSync(filename); fs.symlinkSync(path.join(runtime.runtime, '.next/server/app/about.html'), filename); }
    if (mutate === 'executable') fs.chmodSync(filename, 0o755);
    invoke('verify', runtime, false);
  }
  for (const original of ['.next/server/app/about.html', '.next/server/app/about.meta']) {
    const runtime = packed(); populate(runtime); file(runtime.runtime, original, 'changed original'); invoke('verify', runtime, false);
    const originalDigest = runtime.expect, bytes = fs.readFileSync(path.join(runtime.runtime, original));
    const changed = forged(runtime, inventory => Object.assign(inventory.files.find(x => x.path === original), { size: bytes.length, sha256: sha(bytes) }));
    invoke('verify', { ...changed, expect: originalDigest }, false);
  }
  const weak = packed(); const old = forged(weak, inventory => inventory.schema = 1); invoke('verify', old, false);
  const build = built(), [destination] = populate({ runtime: build.root }, ['about.html']); file(build.root, destination, 'different cached body');
  invoke('pack', { source: build.source, 'source-manifest': build.manifest, 'source-expect': build.expect, runtime: path.join(scratch, 'bad-preexisting-cache'), manifest: path.join(scratch, 'bad-preexisting-cache.json') }, false);
  const linked = built(), [link] = populate({ runtime: linked.root }, ['about.html']); fs.unlinkSync(path.join(linked.root, link)); fs.symlinkSync(path.join(linked.root, '.next/server/app/about.html'), path.join(linked.root, link));
  invoke('pack', { source: linked.source, 'source-manifest': linked.manifest, 'source-expect': linked.expect, runtime: path.join(scratch, 'bad-cache-link'), manifest: path.join(scratch, 'bad-cache-link.json') }, false);
  const image = packed(); file(image.runtime, '.next/cache/images/script.js', 'synthetic'); invoke('verify', image, false);
});
assert(results.length > 0, 'no controls selected');
console.log(JSON.stringify({ passed: results.length, failed: 0, controls: results }));
