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
nonversion strings and unreviewed majors. It explicitly reports the preserved
**development-only YAML 2.6.1 exception** at `node_modules/yaml`; that copy is
still affected by `GHSA-48c2-rrv3-qjmp` and receives no safety claim. The runtime
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

The remaining full-audit development findings are listed explicitly below.
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
old public deployments, replace credentials, finish development-tool repairs,
prove wallet/mainnet behavior or establish overall launch readiness. Repeat the
raw audits and candidate acceptance after integration and before release.
