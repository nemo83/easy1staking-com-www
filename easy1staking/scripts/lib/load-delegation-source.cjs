"use strict";
// Loads current production modules directly; no generated build cache or copied policy.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { createHash } = require("node:crypto"), { registerHooks } = require("node:module"), { fileURLToPath } = require("node:url");
const sha256 = value => createHash("sha256").update(value).digest("hex");
function loadDelegationSource() {
  if (process.version !== "v24.22.1") throw Error("Use the reviewed Node 24.22.1 runtime.");
  const root = path.resolve(__dirname, "../.."), source = path.join(root, "src/lib/site/delegation"), dependencies = new Set(), modules = new Map(), publicImports = new Map();
  const hook = registerHooks({ load(url, context, next) {
    const result = next(url, context);
    if (url.startsWith("file:") && fileURLToPath(url).includes(path.sep + "node_modules" + path.sep)) dependencies.add(fileURLToPath(url)); return result;
  } });
  const ts = require("typescript");
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (path.dirname(file) !== source || !file.endsWith(".ts")) throw Error("Unsupported production module path.");
    const original = fs.readFileSync(file, "utf8"), compiled = ts.transpileModule(original, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true }, reportDiagnostics: true });
    if (compiled.diagnostics.length) throw Error("Production source could not transpile.");
    const module = { exports: {}, sourceSha256: sha256(original), compiledSha256: sha256(compiled.outputText) }; modules.set(file, module);
    const localRequire = id => {
      if (id.startsWith(".")) return load(path.resolve(path.dirname(file), id + ".ts"));
      const resolved = require.resolve(id); publicImports.set(id, resolved); return require(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename: file })(localRequire, module, module.exports); return module.exports;
  }
  return Object.freeze({ load: name => load(path.join(source, name + ".ts")), identity: () => ({
    node: process.version, lockSha256: sha256(fs.readFileSync(path.join(root, "package-lock.json"))),
    loaderSha256: sha256(fs.readFileSync(__filename)),
    production: [...modules].map(([file, m]) => ({ file: path.relative(root, file), sourceSha256: m.sourceSha256, compiledSha256: m.compiledSha256 })),
    publicImports: [...publicImports].map(([id, file]) => ({ id, file: path.relative(root, file), sha256: sha256(fs.readFileSync(file)) })),
    dependencies: [...new Set([...dependencies, ...Object.keys(require.cache).filter(f => f.includes(path.sep + "node_modules" + path.sep))])].sort().map(file => ({ file: path.relative(root, file), sha256: sha256(fs.readFileSync(file)) })),
  }), close: () => hook.deregister() });
}
module.exports = { loadDelegationSource, sha256 };
