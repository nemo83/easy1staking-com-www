# Framework and image dependency patch

This patch keeps the production site's Next 15, Pages Router, React 18 and Node 24 architecture. It pins Next and `eslint-config-next` to **15.5.28** and adds an explicit **Sharp 0.35.5** dependency so Next's image optimizer resolves the patched native library. Application pages, wallet logic, assets and other direct dependency versions are unchanged.

The security targets follow the upstream [Next SVG image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [Windows server advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [AVIF image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) and [Sharp librsvg advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w). Updating the manifest alone does not establish which native library runs.

## Reproduce

Use a clean checkout and Node **24.22.1** with its bundled npm. From `easy1staking/`:

```sh
npm ci
node scripts/check-framework-security.cjs
npm run build
npm run lint
node scripts/check-build-init.cjs
npm audit --json
npm audit --omit=dev --json
```

The security guard also supports `--lock-only` before installing. It checks all matching lock entries, including nested and optional platform copies; rejects prerelease or outdated versions; checks installed copies; resolves Sharp from Next; and prints the loaded codec versions. Installed verification currently covers the native Linux/macOS/Windows package layout, with the exercised platform being Linux x64 glibc.

For local browser checks, run the built application on a free localhost port with `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port PORT`. Block external requests, API routes and WebSockets; do not connect a real wallet. A benign image request is `/_next/image?url=%2FCoin.png&w=128&q=75` with `Accept: image/webp`. Stop the owned server when finished.

The isolated browser fixture case supplies an empty Distribution array for exactly the GET request `/undefined/token_distributions?meme_last=true` on that localhost origin, returning HTTP 200 and `application/json` body `[]` through Playwright interception. Record that the fixture was exercised and continue to fail on every unexpected browser exception. This fixture belongs only to the test and does not ship in the application. Keep the unconfigured case separate so its existing failure remains visible.

## Measured results on 2026-10-30

- The new guard failed against the original unchanged lock, naming Next 15.5.9, Sharp 0.34.5 and old native packages. It passed after the targeted update. Injecting an old Sharp entry under Next's nested lock path failed; the lock was restored byte for byte.
- Clean installation, production build, lint and all **9/9** existing mocked initialization checks passed. Build and lint retain four existing React effect dependency warnings; `next lint` also reports its existing deprecation.
- Next resolves Sharp **0.35.5**, the native package **0.35.5**, and the libvips package **1.3.4**. The loaded native versions include libvips **8.18.7**, librsvg **2.63.2** and libheif **1.23.5**.
- The exact production artifact served all eight legacy page routes with HTTP 200. The real image optimizer returned HTTP 200, `image/webp`, **128 × 135** pixels. Desktop/mobile homepage rendering, disabled delegation without a wallet, and navigation to Staking Assessment and UPLC.link were exercised without a wallet or real API call.
- The unconfigured browser run failed its zero-exception assertion: two homepage loads attempted the unchanged rewards-data request with no `NEXT_PUBLIC_EASY1STAKING_API` configured, received a local HTML 404 response and failed JSON parsing. This run is retained as a failure; it does not establish working live data or an exception-free browser session. The application source was not changed to hide it.
- A separate configured-fixture run against the same compiled artifact passed with zero browser exceptions. The exact read fixture was exercised twice, for desktop and mobile. Legacy homepage rendering, navigation and disabled delegation passed; the real native image optimization passed again. This establishes rendering with synthetic read data, without certifying live API integration. Both owned servers and browsers were stopped and their ports closed after verification.
- Both raw audit commands returned exit 1 with valid vulnerability reports. All dependencies: **83 findings** (12 low, 16 moderate, 53 high, 2 critical). Production dependencies: **77 findings** (10 low, 14 moderate, 51 high, 2 critical). The targeted Next Windows/AVIF/SVG and Sharp native advisory identities are absent; Next still inherits a moderate PostCSS finding. The remaining critical families are `tar` and `websocket-driver`.

The targeted lock update changes Next's environment/SWC packages and lint plugin, Sharp's native/libvips packages, `@img/colour`, `@emnapi/runtime` and `semver`. These belong to the updated framework/lint/image dependency closures. All **55** matched locked Cardano/Mesh/Effect/Noble/Scure and related cryptographic package entries retained their versions. No SDK migration or broad dependency update was performed.

This is a bounded framework/image repair. Remaining legacy SDK, WebSocket, PostCSS, HTTP and tooling advisories, live data, wallet behavior, credential rotation and release checks require separate work. These results do not establish complete dependency security or production release clearance.
