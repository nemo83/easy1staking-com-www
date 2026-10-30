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

Outstanding dependency work includes dashboard WebSocket dependencies (including
the critical websocket-driver finding), nested PostCSS, tooling and HTTP/SDK
dependency families. Credential replacement, live pool/wallet verification,
deployment identity and release checks remain separate work. Audit results are
time-specific; rerun them before release.
