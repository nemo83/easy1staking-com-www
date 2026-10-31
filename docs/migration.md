# Legacy URL migration

The Editorial website keeps these compatibility responses. Redirect destinations are fixed paths on the incoming request's origin; query parameters cannot choose another destination.

| Legacy path | Response |
| --- | --- |
| `/staking-assessment` | 308 redirect to `/pool` |
| `/tools/uplc-link` | 308 redirect to `/projects/uplc-link` |
| `/scooper-dashboard` | 410 HTML retirement explanation with a Pool link |
| `/cardano-summit-2025` | 410 HTML retirement explanation with a Pool link |
| `/kreate-delist` | 410 HTML retirement explanation with a Pool link |
| `/vitevis-verification` | 410 HTML retirement explanation with a Pool link |
| `/wmtx-conversion` | 410 HTML retirement explanation with a Pool link |
| `/api/summit-verify`, `/api/verify-tx` | 410 JSON `{"error":"retired"}` with `Content-Type: application/json` and `Cache-Control: no-store` |

The seven literal App Router route handlers return retirement responses for GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS, including canonical paths, one trailing slash and query strings. HEAD returns 410 with the required content type and no-store header, using a null response body. The other six methods return the same inert HTML or JSON representation. No handler reads or forwards request bodies, cookies, provider data or wallet state. Retired HTML pages offer no former dashboard, verification, transfer or wallet action. Methods outside those seven are not part of this response contract.

`easy1staking/src/lib/server/retirement.ts` supplies the existing retirement HTML and JSON through standard Web Responses. Each literal route explicitly selects the Node runtime and dynamic execution. `easy1staking/src/middleware.ts` owns only the two compatibility redirects; retirement requests continue to the real route handlers. Unknown paths, including prefixes and extra path segments resembling retired routes, return 404. Existing Editorial pages remain available, including `/about/`.

This is a candidate correction for hosted previews where all 13 retired HEAD cases returned the required status, no-store header and empty bytes but omitted Content-Type. The null-body, empty-string and full-representation middleware candidates all showed that hosted failure, although local Next preserved the header. Moving response ownership to literal route handlers still needs actual hosted verification; local success cannot establish hosted header preservation.

`skipTrailingSlashRedirect` in `easy1staking/next.config.mjs` lets the retired route handlers answer slash variants directly. `skipMiddlewareUrlNormalize` preserves redirect origins, including literal loopback hosts during local checks. The old dashboard page has been deleted from the App Router. Dormant analytics components and dependencies remain in source; this change does not claim to remove that dependency graph.

## Local reproduction

Use a reviewed clean checkout with Node 24.x. From `easy1staking/`, install the exact lockfile and run the installed guards:

```sh
npm ci --ignore-scripts
node scripts/check-framework-security.cjs
node scripts/check-runtime-security.cjs
node scripts/check-tooling-security.cjs
node scripts/check-minimatch-compat.cjs
node scripts/check-pool-facts.cjs
env -u NEXT_PUBLIC_BLOCKFROST_PROJECT_ID -u NEXT_PUBLIC_BLOCKFROST_API_KEY npm run build
npm run lint
env -u NEXT_PUBLIC_BLOCKFROST_PROJECT_ID -u NEXT_PUBLIC_BLOCKFROST_API_KEY node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 49873
```

Keep public provider configuration absent for this local routing check; no provider or wallet operation is needed. Use a free local port and stop only the server started for this check. In another terminal, inspect responses without following redirects:

```sh
curl -i http://127.0.0.1:49873/staking-assessment
curl -i http://127.0.0.1:49873/tools/uplc-link
curl -i http://127.0.0.1:49873/scooper-dashboard
curl -i 'http://127.0.0.1:49873/api/verify-tx/?probe=local'
curl -I 'http://127.0.0.1:49873/api/summit-verify/?probe=local'
curl -i -X POST -H 'Content-Type: application/json' --data '{"probe":"inert"}' http://127.0.0.1:49873/api/summit-verify
curl -i http://127.0.0.1:49873/api/verify-tx-extra
curl -i http://127.0.0.1:49873/about/
```

Repeat all seven documented method checks for both API endpoint names and all five HTML paths, with and without a trailing slash and query. Require 410, the appropriate content type, no-store, no redirect and the exact API JSON or retirement explanation; HEAD must have no body. Check all five retired pages at mobile and desktop widths: a clear retirement title, no horizontal overflow, visible keyboard focus and a working Pool link. The eight Editorial pages (`/`, `/pool`, `/about`, `/blog` and the four project overviews) should return 200; unknown routes should return 404. Inspect selected path keys in `.next/server/app-paths-manifest.json` and `.next/app-build-manifest.json`, and emitted route/chunk filenames, to confirm all seven literal route handlers are registered and no retired page, interactive client implementation or catchall was added. Next 15.5.28 emits seven identical 163-byte empty webpack route stubs for these server handlers; inspect and classify those framework files separately from application code. They must contain no retired functionality, provider, wallet or action code. This is a check of the actual production build, not a development-server substitute.

## Hosted verification

Measure HEAD bytes with a raw HTTP/1.1 connection that reads the complete response through connection close and splits the header block from the received bytes. First prove that the observer detects a deliberately malformed HEAD fixture that sends the 19-byte `{"error":"retired"}` body, and that it reads zero bytes from a valid HEAD fixture. A normal HEAD client can discard an illegal body, so an empty client read alone is insufficient. Keep nonempty API and HTML GET responses as positive controls. Await shutdown of every owned test server and browser.

After deploying the reviewed candidate, repeat the response checks against that exact deployment without following redirects. Check HEAD on all five retired HTML paths and all eight API combinations (both endpoints, canonical/trailing-slash paths, with and without a query). Each must return 410, its required Content-Type, Cache-Control containing no-store and zero body bytes. Confirm the GET/POST retirement answers, compatibility redirects, eight current pages and unknown-path 404 responses too. Run these checks on both the exact unique deployment URL and its preview alias. Record the source commit, lockfile and build identity, deployment URL and observed responses together. Passing local HTTP or response-member checks does not establish this hosted result; if the deployed headers still fail, the candidate remains unaccepted.

## Remaining launch work

This routing change completes only the HTTP part of migration. Legacy homepage fragment compatibility (`#contribution`, `#delegate` and the retained `#pool` target), full route metadata/canonicals/social cards/sitemap/robots, and inspection of the exact packaged release filesystem remain separate gates. Live pool facts, wallet delegation and independent ledger acceptance, remaining dependency security work, credential rotation and retirement of old public deployments must also be completed and verified before the full launch can be considered finished. No routing check proves those outcomes or authorizes a real mainnet transaction.
