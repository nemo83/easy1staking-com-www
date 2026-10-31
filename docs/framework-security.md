# Framework and image dependency patch

The redesign pins Next.js and eslint-config-next to 15.5.28 and adds an explicit
Sharp 0.35.5 production dependency. React 18, Node 24, application code, content,
assets, routes and wallet code are unchanged. This covers the framework/image
patch only; it does not establish release readiness or resolve every dependency
advisory.

The targeted lock update also updates Next's env/SWC packages and ESLint plugin,
Sharp's platform addons and libvips packages, @img/colour, its optional WASM
runtime @emnapi/runtime, and shared semver required by Sharp. Other direct
dependencies and all locked Cardano SDK, Effect, Noble and Scure entries remain
unchanged. The verified Linux installation loads Sharp/native addon 0.35.5 with
libvips 8.18.7; the corresponding libvips package is 1.3.4.

From a reviewed checkout, select Node 24 (verification used 24.22.1), then run
these commands from `easy1staking/`:

```sh
node scripts/check-framework-security.cjs --lock-only
npm ci
node scripts/check-framework-security.cjs
npm run build
npm run lint
npm audit --json
npm audit --omit=dev --json
npm start -- --hostname 127.0.0.1 --port 4328
```

Use an available local port. Keep Blockfrost configuration absent for offline
review and prevent browser requests to external services and API routes. Do not
use a real wallet or submit a transaction for these checks. The guard checks all
matching lock entries, including nested copies, rejects prereleases and versions
below the patch baselines, verifies the installed Next/env/Sharp resolutions and
loaded native addon against the lock, and prints the actual Sharp library
versions. It uses Node builtins and the installed Sharp package.

Verification on 2026-10-30:

- The guard failed against the original lock with named Next 15.5.9 and Sharp
  0.34.5 failures. A nested old-Sharp lock mutation also failed; original bytes
  were restored. The repaired installed graph passes.
- A clean install, production build and actual lint run passed. Lint reported no
  warnings or errors. The served build ID was `32aCy_NgU48CZ-MnAE8gx`.
- Nine existing routes returned HTML with status 200. Optimizing the existing
  `android-chrome-512x512.png` through `/_next/image` at width 64 and quality 75
  returned status 200, `image/webp`, and decoded dimensions 64×64.
- The unchanged homepage browser acceptance runner passed all 273 checks against
  that production artifact with external/API requests blocked. Representative
  mobile and desktop screenshots were inspected against the prior reference.
  Its 200% text check is a simulation, not native zoom or assistive-technology
  verification.
- Both audits returned valid advisory JSON and exit 1 for remaining findings:
  full audit 19 affected packages (2 low, 6 moderate, 10 high, 1 critical),
  production audit 8 (3 moderate, 4 high, 1 critical). The targeted
  `GHSA-2464-fhr4-w9xw`, `GHSA-2xp9-vwfh-vxw4`, `GHSA-p293-qw3h-jr36` and
  `GHSA-wq5f-xc86-pv6w` entries were absent. Next remains an affected package via
  its nested PostCSS dependency; Sharp has no returned advisory entry.

The counts above describe the framework-only stage. The runtime patch below
supersedes its remaining runtime findings; tooling, credential replacement,
live pool/wallet verification, deployment identity and release checks remain
separate work. Audit results are time-specific; rerun them before release.


## Compatible runtime dependency patch

The subsequent runtime repair resolves these exact versions without changing
application code, assets, routes or wallet code:

| Package | Repaired resolution |
|---|---|
| @babel/runtime | 7.26.10 |
| nanoid | 3.3.18 |
| postcss | 8.5.23 |
| source-map-js | 1.2.2 |
| undici | 7.30.1 |
| websocket-driver | 0.7.5 |
| yaml (runtime major 1) | 1.10.3 |

PostCSS is pinned directly and overridden through `$postcss`, intentionally
replacing Next 15.5.28's exact 8.4.31 requirement with the patched same-major
release. Its former nested copy is deduplicated into the root runtime copy.
Undici moves from the Effect platform's nested path to the root; 7.30.1 satisfies
that parent's `^7.10.0` range. The remaining five patches satisfy their existing
parent ranges and require no permanent overrides. The only other lock changes
are target metadata, PostCSS's nanoid range and its runtime classification.
Next 15.5.28, Sharp 0.35.5, React 18, Evolution 0.5.9, Effect and all existing
cryptography, serialization and transaction-builder versions remain unchanged.

For reproduction, select Node 24 and run from `easy1staking/` in a reviewed
checkout with no Blockfrost configuration:

```sh
node scripts/check-runtime-security.cjs --lock-only
npm ci --ignore-scripts
node scripts/check-framework-security.cjs
node scripts/check-runtime-security.cjs
npm run build
npm run lint
npm audit --json
npm audit --omit=dev --json
npm start -- --hostname 127.0.0.1 --port 4328
```

The runtime guard enumerates every matching lock path, including nested copies,
and compares every target's installed package name and version with its lock
entry. It rejects missing target packages, outdated versions, prereleases,
nonversion strings and unreviewed majors. At this historical runtime-only stage it reported a preserved
**development-only YAML 2.6.1 exception** at `node_modules/yaml`, affected by
`GHSA-48c2-rrv3-qjmp`. The subsequent tooling patch below removes that exception. The runtime
YAML 1 copy remains at `node_modules/cosmiconfig/node_modules/yaml`. These guards
prevent version regressions; the separate raw audit checks current advisories.

Observed on 2026-10-30 with Node 24.22.1:

- The unchanged runtime lock failed the new lock-only guard with eight named
  failures (two PostCSS copies and the six other runtime targets).
- `npm ci --ignore-scripts` installed 529 packages. Both installed guards,
  the actual production build and lint passed; lint had no warnings or errors.
- The raw production audit returned exit 0 and **zero findings**. The full audit
  returned valid JSON and exit 1 with **12 affected package names**: 2 low,
  4 moderate and 6 high, with no critical findings.
- The frozen browser acceptance instrument passed all 273 checks against build
  `aW7TX0opFMhx0GkVPYDKj`, with external/API requests blocked. Mobile 390px and
  desktop 1440px screenshots were inspected. The 200% text simulation is not
  native zoom or assistive-technology verification.
- Nine existing routes returned HTML 200. Optimizing the existing
  `android-chrome-512x512.png` through `/_next/image` at width 64 and quality 75
  returned HTTP 200, WebP and decoded dimensions 64×64 using native Sharp.

The runtime-only stage's full-audit development findings are listed below;
the subsequent tooling patch resolves them.
An inherited finding such as ESLint can have no advisory of its own and remain
because of affected dependencies.

| Development package | Advisory IDs |
|---|---|
| @eslint/plugin-kit | `GHSA-xffm-g5w8-qvg7` |
| @humanfs/node | `GHSA-p498-v437-472g` |
| ajv | `GHSA-2g4f-4pwh-qvx6` |
| brace-expansion | `GHSA-3jxr-9vmj-r5cp`, `GHSA-6j4f-fj2g-mc7p`, `GHSA-f886-m6hf-6m8v`, `GHSA-mh99-v99m-4gvg`, `GHSA-q2hr-2g5m-vwhr`, `GHSA-qhr7-859c-m2p7`, `GHSA-rgw5-rvv9-x895`, `GHSA-v6h2-p8h4-qcjw` |
| eslint | Inherited via affected dependencies |
| flatted | `GHSA-25h7-pfq9-p65f`, `GHSA-rf6f-7fwh-wjgh` |
| glob | `GHSA-5j98-mcp5-4vw2` |
| js-yaml | `GHSA-2883-xcg3-v3hh`, `GHSA-52cp-r559-cp3m`, `GHSA-5p4m-2wfm-xmqj`, `GHSA-h67p-54hq-rp68`, `GHSA-mh29-5h37-fv8m` |
| minimatch | `GHSA-23c5-xmqv-rm74`, `GHSA-3ppc-4f35-3m26`, `GHSA-7r86-cg39-jmmj` |
| picomatch | `GHSA-3v7f-55p6-f55p`, `GHSA-c2c7-rcm5-vvqj` |
| postcss-selector-parser | `GHSA-rj75-hqrm-r3gf`, `GHSA-w9m9-85wc-3x92` |
| yaml | `GHSA-48c2-rrv3-qjmp` |

Production zero describes this redesigned lock at that observation time. It does
not repair the legacy production lock or its tar/IP/elliptic/Mesh chains, retire
old public deployments, replace credentials, prove wallet/mainnet behavior or establish overall launch readiness. Repeat the
raw audits and candidate acceptance after integration and before release.


## Compatible development-tool dependency patch

This section records the first compatible tooling patch. The new-advisory
follow-up below supersedes its zero-full-audit observation and matcher/glob
resolutions.

The subsequent tooling repair pins ESLint 9.39.5 and resolves the previously
listed development advisories. These are the actual repaired versions:

| Package | Resolution |
|---|---|
| @eslint/plugin-kit | 0.4.1 |
| @humanfs/node | 0.16.8 |
| ajv | 6.15.0 |
| brace-expansion | 1.1.21 and nested 2.1.7 |
| eslint | 9.39.5 |
| flatted | 3.4.4 |
| glob | 10.5.0 |
| js-yaml | 4.3.2 |
| minimatch | 3.1.5 and nested 9.0.9 |
| picomatch (development major 2) | 2.3.2 |
| postcss-selector-parser | 6.1.5 |
| yaml (development major 2) | 2.9.1 |

The only added override is `brace-expansion@1: 1.1.21`, keeping its consumers on
their existing major. Natural compatible resolution repairs both nested
minimatch 9 copies and their brace-expansion 2 copies. The selected minimatch
9.0.9 declares `brace-expansion: ^2.0.2`; no brace-expansion major 5 is installed.
The initial targeted resolver also moved the unaffected runtime-classified
`@parcel/watcher` picomatch copy. That movement was stopped and its entire
original 4.0.4 lock entry, including registry URL and integrity, was restored
before the final constrained install. That runtime copy remains unchanged.
No additional runtime override was needed.

The remaining changed lock entries are ESLint's declared support closure:

| Package | Before → after |
|---|---|
| @eslint-community/eslint-utils | 4.4.1 → 4.10.1 |
| @eslint/config-array | 0.19.0 → 0.21.2 |
| @eslint/config-helpers | added 0.4.2 |
| @eslint/core | 0.9.0 → 0.17.0 |
| @eslint/eslintrc | 3.2.0 → 3.3.7 |
| @eslint/js | 9.15.0 → 9.39.5 |
| @eslint/object-schema | 2.1.4 → 2.1.7 |
| @humanfs/core | 0.19.1 → 0.19.2 |
| @humanfs/types | added 0.15.0 |
| @humanwhocodes/retry | root 0.4.1 → 0.4.3; obsolete nested 0.3.1 removed |
| acorn | 8.14.0 → 8.19.0 |
| eslint-scope | 8.2.0 → 8.4.0 |
| eslint-visitor-keys | 4.2.0 → 4.2.1 |
| espree | 10.3.0 → 10.4.0 |

The lock's root development manifest records the ESLint pin; target entries
also record their published dependencies, engines, integrity, funding or
deprecation metadata where changed. A complete entry comparison found every
preexisting runtime entry identical. Application code, styles, assets, routes,
Next 15.5.28, native Sharp 0.35.5, React 18, Evolution 0.5.9, Effect, Noble,
Scure, serialization and transaction-building versions are unchanged.
ESLint 9.39.5 and glob 10.5.0 carry upstream deprecation notices; compatible
major upgrades remain separate work. The actual audits below returned no
advisories for this graph at the observation time.

Select Node 24 and reproduce from `easy1staking/` with no Blockfrost
configuration:

```sh
node scripts/check-framework-security.cjs --lock-only
node scripts/check-runtime-security.cjs --lock-only
node scripts/check-tooling-security.cjs --lock-only
npm ci --ignore-scripts
node scripts/check-framework-security.cjs
node scripts/check-runtime-security.cjs
node scripts/check-tooling-security.cjs
node scripts/check-pool-facts.cjs
npm run build
npm run lint
npm audit --json
npm audit --omit=dev --json
npm start -- --hostname 127.0.0.1 --port 4328
```

The tooling guard enumerates every matching lock path and checks each installed
package's actual name/version. It also checks nested installed directories for
unlocked tooling copies. Required target names cannot silently disappear.
Stable reviewed major families have numeric patched baselines; prereleases,
nonversions, outdated copies and unreviewed majors fail. The existing runtime
picomatch 4 copy is explicitly recognized at 4.0.4. The runtime guard's old
vulnerable YAML exception is removed: development YAML 2 must be stable and at
least 2.8.3, while runtime YAML 2 still fails. Runtime YAML 1.10.3 and all other
runtime/native baselines retain their checks. These are known-version
regression guards, so raw audits remain necessary for current advisories.

Observed on 2026-10-31 with Node 24.22.1:

- Against the unchanged predecessor lock, the tooling guard failed with 16
  named outdated-copy failures. The full base audit returned 12 affected
  package names (2 low, 4 moderate, 6 high); the production base audit was zero.
  The advisory families in the historical table above are now absent.
- A clean `npm ci --ignore-scripts` installed 530 packages. All three installed
  security guards passed. The actual production build, type checking and lint
  passed; lint reported no warnings or errors. The existing pool suite executed
  all 10 tests with no failures, using synthetic local inputs.
- Both raw full and production audits returned valid JSON, exit 0 and zero
  findings. This is a time-specific observation for the redesigned lock.
- The served build ID was `QnkOeSCPIki9vDOAjlomk`. The unchanged frozen browser
  acceptance runner passed all 273 checks with external/API requests blocked.
  Nine existing routes returned HTML 200. Native Sharp optimized the existing
  `android-chrome-512x512.png` to a 64×64 image through `/_next/image` with
  HTTP 200. Mobile 390px and desktop 1440px screenshots were inspected.
  The 200% text simulation is not native zoom or assistive-technology testing.

Zero current audit findings does not repair or retire the legacy production
Mesh/tar/IP/elliptic graph, replace credentials, prove host compromise absent,
retire old public deployments, verify real wallet/mainnet behavior, or establish
launch readiness. Source/artifact inventory, integrated candidate acceptance
and release checks remain required before cutover; repeat audits before release.


## Newly reported matcher and glob advisories

A later audit on 2026-10-31 reported two new advisory families after the initial
patch: [`GHSA-g3hv-75wg-m249`](https://github.com/advisories/GHSA-g3hv-75wg-m249)
for minimatch pattern amplification, and
[`GHSA-3g3m-2fjr-6pw4`](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
for glob traversal continuing after cancellation. The earlier zero report is
retained as a historical observation; it is no longer the current full-audit
result.

The follow-up makes two scoped dependency changes:

- Pin Sucrase 3.35.1 through an override. Tailwind 3.4.15 already permits this
  patch with `^3.35.0`. Its supported patch replaces glob with tinyglobby, so no
  glob copy remains in the lock or clean installation.
- Override only `minimatch@9` to 11.0.3 for the existing TypeScript parser. The
  pinned parser source imports the named `minimatch(filePath, pattern)` function
  with default options; this API remains available. Legacy callers keep their
  callable CommonJS minimatch 3.1.5 API. A global 3-to-11 override would change
  that API and is deliberately excluded.

The new declared development closure is:

| Package/path | Resolution |
|---|---|
| sucrase | 3.35.1 |
| parser's minimatch | 11.0.3 |
| parser's brace-expansion | 5.0.12 |
| parser's balanced-match | 4.0.4 |
| @isaacs/nonrecursive-glob-match | 1.0.3 |
| tinyglobby | 0.2.17 |
| tinyglobby's fdir | 6.5.0 |
| tinyglobby's picomatch | 4.0.7, development only |

Brace-expansion 5 and balanced-match 4 are the declared closure of the explicitly
reviewed modern matcher change. Published metadata and engines were checked
against Node 24. Runtime picomatch 4.0.4 retains its complete original lock
entry; the guard recognizes 4.0.7 only with `dev: true` and rejects it as a
runtime replacement. No other runtime, SDK, crypto, framework or application
entry changes.

Removing glob also removes its now-unused development closure: @isaacs/cliui,
@pkgjs/parseargs, foreground-child, jackspeak, minipass, path-scurry, lru-cache,
package-json-from-dist, signal-exit, eastasianwidth, is-fullwidth-code-point,
root ansi-regex/strip-ansi/string-width, string-width-cjs, strip-ansi-cjs,
wrap-ansi and wrap-ansi-cjs, their nested ansi-regex/emoji-regex/strip-ansi/
string-width/ansi-styles copies, and glob's nested minimatch/brace-expansion.
The complete follow-up lock delta is 38 entry changes, all explained by the
two declared development closures and removals above.

The source assessment for retained minimatch 3.1.5 is specific to
`GHSA-g3hv-75wg-m249`: **vulnerable code not present**. The reported mechanism
uses `optimizationLevel >= 2`, `firstPhasePreProcess` pattern-list amplification
and `secondPhasePreProcess` pairwise comparisons. The exact legacy implementation
has none of that pipeline; its `make` function maps brace-expanded strings to
slash-separated components and parses each component directly. Its installed
`minimatch.js` is byte-identical to
[pinned source commit 7bba978](https://github.com/isaacs/minimatch/blob/7bba97888a27a6162983056bcce2a6e28f668712/minimatch.js),
SHA-256 `746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d`.
The guard requires this exact version, registry integrity and installed source
hash. It rejects older legacy versions, modern 9/10 copies, prereleases,
unreviewed majors, missing reviewed API families, glob copies and legacy
source drift. This assessment requires independent source/artifact review; it
is neither a blanket legacy/development exception nor a general safety claim.

The modern 9.x implementation does contain the affected preprocessing pipeline;
glob 10.5.0 explicitly enabled level 2. Those copies were repaired or removed.
The pinned 11.0.3 source caps first-phase growth with `braceExpandMax` and skips
quadratic second-phase optimization for sets larger than 1000. The public
[machine-readable advisory record](tooling-advisories.json) preserves exact
source pins, artifact identity, rationale, limitations and raw scanner inventory.

Run `node scripts/check-minimatch-compat.cjs` in addition to the reproduction
commands above. It exercises both actual installed APIs with 42 positive,
negative, parser-shaped and bounded-growth/expansion assertions in-process.
It also checks that the parser resolves the modern named function. Inputs,
time and RSS growth are bounded; this is a small semantic control, not a general
exhaustion benchmark. No child benchmark or real provider/wallet action is used.

Current measured scanner result on 2026-10-31: **raw full audit exit 1, 13 moderate
reported package names; raw production audit exit 0, zero findings**. The only
remaining primary advisory is `GHSA-g3hv-75wg-m249` at the exact root minimatch
3.1.5 copy. The other 12 names are inherited findings: @eslint-community/eslint-utils,
@eslint/config-array, @eslint/eslintrc, @typescript-eslint/eslint-plugin,
@typescript-eslint/parser, @typescript-eslint/type-utils, @typescript-eslint/utils,
eslint, eslint-config-next, eslint-plugin-import, eslint-plugin-jsx-a11y and
eslint-plugin-react. Every inherited chain reaches that same source-assessed
copy. No glob finding, modern minimatch finding or other primary advisory
remains. The raw scanner output is preserved separately from this assessment.

A clean install, actual production build/type checks and lint passed, with no
lint warnings or errors. All three installed security guards, the new direct
API controls and all 10 existing pool tests passed. Application and public asset
trees, as well as every existing runtime lock entry, remain unchanged. Independent
review of the complete change and the source-based disposition remains required.
All credential, incident, legacy deployment, wallet/mainnet and release limits
listed above still apply.

The follow-up clean install added 505 packages. The rebuilt artifact
`Lgu4H34Mb54EiXFObq37l` passed the unchanged 273-check offline browser suite,
nine HTML route checks and an actual native Sharp 64×64 image response.
Mobile 390px and desktop 1440px screenshots were inspected against the preceding
unchanged application; live pool facts remain unavailable without configuration.
The owned local verification server exited and was awaited.
