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

The API responses apply to GET, POST and HEAD, including trailing slashes and query strings. HEAD has the same status and headers with an empty body. Other methods also receive the API retirement response. The middleware never reads or forwards retired request bodies. Retired HTML pages offer no former dashboard, verification, transfer or wallet action. Their HEAD responses are empty. The same retirement and redirect paths accept one trailing slash; unrelated routes continue into Next's normal router. Unknown paths, including API near matches, return 404. Existing Editorial pages remain available, including `/about/`.

`easy1staking/src/middleware.ts` owns the responses. Retired HEAD responses use an explicit empty string body while retaining their status, content type and no-store headers. This is a candidate correction for a hosted preview where all 13 retired HEAD cases returned the required status and empty bytes but omitted Content-Type; local Next preserved that header with the previous null body. A nonnull response stream with zero bytes proves the local envelope distinction only. Hosted header preservation must be checked on the deployed candidate.

`skipTrailingSlashRedirect` in `easy1staking/next.config.mjs` lets middleware answer retired API slash variants directly instead of returning Next's normal slash redirect. `skipMiddlewareUrlNormalize` preserves redirect origins, including literal loopback hosts during local checks. The old dashboard page has been deleted from the App Router. Dormant analytics components and dependencies remain in source; this change does not claim to remove that dependency graph.

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

Repeat API GET/POST/HEAD checks for both endpoint names, with and without a trailing slash and query. Check all five retired pages at mobile and desktop widths: a clear retirement title, no horizontal overflow, visible keyboard focus and a working Pool link. The eight Editorial pages (`/`, `/pool`, `/about`, `/blog` and the four project overviews) should return 200; unknown routes should return 404. Inspect `.next/server/app-paths-manifest.json`, `.next/app-build-manifest.json`, and emitted route/chunk files to confirm the dashboard has no registered page or browser chunk. This is a check of the actual production build, not a development-server substitute.

## Hosted verification

After deploying the reviewed candidate, repeat the response checks against that exact deployment without following redirects. Check HEAD on all five retired HTML paths and all eight API combinations (both endpoints, canonical/trailing-slash paths, with and without a query). Each must return 410, its required Content-Type, Cache-Control containing no-store and zero body bytes. Confirm the GET/POST retirement answers, compatibility redirects, eight current pages and unknown-path 404 responses too. Record the source commit, deployment URL and observed responses together. Passing local HTTP or response-member checks does not establish this hosted result; if the deployed headers still fail, the candidate remains unaccepted.

## Remaining launch work

This routing change completes only the HTTP part of migration. Legacy homepage fragment compatibility (`#contribution`, `#delegate` and the retained `#pool` target), full route metadata/canonicals/social cards/sitemap/robots, and inspection of the exact packaged release filesystem remain separate gates. Live pool facts, wallet delegation and independent ledger acceptance, remaining dependency security work, credential rotation and retirement of old public deployments must also be completed and verified before the full launch can be considered finished. No routing check proves those outcomes or authorizes a real mainnet transaction.
