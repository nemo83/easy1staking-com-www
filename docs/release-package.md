# Portable release candidate

The application can be exported from a reviewed full Git commit, built in a separate directory and packaged as a Next.js standalone runtime. This candidate has an explicit inventory and retained SHA-256 identity. It does not establish the identity or contents of a Vercel deployment. The actual hosting output must be inspected separately before release, after the remaining wallet, credential and containment gates.

Next.js documents [`output: "standalone"`](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output): the traced `.next/standalone` runtime supplies `server.js`; `public` and `.next/static` must be copied explicitly. Vercel's [Build Output API](https://vercel.com/docs/build-output-api) defines a separate `.vercel/output` artifact. Matching source commits do not make these outputs interchangeable.

## Source and runtime boundaries

`easy1staking/scripts/release-package.cjs` accepts `export`, `verify-source`, `pack` and `verify`. It never installs dependencies, invokes npm, starts a server or deploys. All paths must be absolute. Destinations and manifest files must be new; the tool refuses overwrites and symlink path components. Git commands use argument arrays and require a full 40-character commit identity.

The source export contains committed blob bytes only: `package.json`, `package-lock.json`, `.nvmrc`, `.eslintrc.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `src/**` and `public/**`. Dirty and untracked files are ignored. Env files (including examples), private/editor/native state, development fixtures, tests and article samples inside these trees are rejected. Repository docs, scripts, private policy and review material are outside the export. The source manifest records every exported file's Git mode/blob, size and SHA-256, plus commit and lockfile identity. It remains outside the source and runtime.

The package contains only the actual standalone build, public assets and static chunks. Its permitted namespaces are `server.js`, `package.json`, `node_modules/**`, `.next/**` and `public/**`. Missing runtime files, unsupported filesystem objects, forbidden paths and escaping symlinks fail. Same-root dependency symlinks can be materialized after their real targets are checked; runtime inventory itself permits no symlinks. The runtime manifest records every immutable filename, size, mode and SHA-256, physical package manifests/names/versions, native addon/shared-library identities, source-manifest digest, lock hash and actual `BUILD_ID`.

Only `.next/cache/**` is mutable for image optimization. Cache content still passes path/content scans, but generated cache files are excluded from the stable identity. Everything else must retain the same inventory. A finite negative scanner cannot prove absence of every arbitrary secret: it checks prohibited paths and known private markers, including the public synthetic `EASY1_RELEASE_PRIVATE_CANARY`. No real credential value is needed for these checks.

## Reproduce locally

Use a trusted, reviewed clean checkout descended from the cleaned repository history and the pinned Node 24 toolchain. Inspect the package scripts and run the repository's local safety checks before every npm command. Do not use historical incident objects, env/auth stores, `npm run clean`, automatic installers or a broad repository copy. The CLI checks the reviewed Next dev/build/start/lint scripts and rejects unexpected lifecycle hooks. Keep evidence and all build/runtime directories outside the repository and each other.

The example uses a new directory under `/tmp`, and assumes its parent exists. Set `COMMIT` to the exact reviewed full commit; set `REPO`, `NODE` and `NPM` to absolute trusted paths. Capture the digest printed by each creation command and retain it independently of the adjacent manifest.

```sh
"$NODE" "$REPO/easy1staking/scripts/release-package.cjs" export \
  --repo "$REPO" --commit "$COMMIT" \
  --source /tmp/easy1-candidate/source --manifest /tmp/easy1-candidate/source.json

# Set SOURCE_SHA to the printed source manifest SHA256 and retain it separately.
"$NODE" "$REPO/easy1staking/scripts/release-package.cjs" verify-source \
  --repo "$REPO" --commit "$COMMIT" --source /tmp/easy1-candidate/source \
  --manifest /tmp/easy1-candidate/source.json --expect "$SOURCE_SHA"
```

Before **each** npm invocation, run the clean Git owner's safety gate and repeat the `verify-source` command against committed blobs. The export has no `.git`; do not pretend it passed an ancestry check. Use the Node 24 sibling `bin` directory first in the process-local PATH. Run these commands from the source directory, with a fresh private npm cache:

```sh
"$NPM" ci --ignore-scripts --cache /tmp/easy1-candidate/npm-cache
"$NPM" run build
"$NPM" run lint
```

For no-key verification remove `NEXT_PUBLIC_BLOCKFROST_PROJECT_ID` and `NEXT_PUBLIC_BLOCKFROST_API_KEY` by name from the child environment, without reading or logging their values. `NEXT_PUBLIC_*` values are baked into browser bundles during build; changing runtime environment does not rotate those values in an existing bundle. A no-key package establishes unavailable-data behavior, not credential uptake or live provider acceptance.

```sh
"$NODE" "$REPO/easy1staking/scripts/release-package.cjs" pack \
  --source /tmp/easy1-candidate/source \
  --source-manifest /tmp/easy1-candidate/source.json --source-expect "$SOURCE_SHA" \
  --runtime /tmp/easy1-candidate/runtime --manifest /tmp/easy1-candidate/runtime.json

# Set RUNTIME_SHA to the printed runtime manifest SHA256, retained separately.
"$NODE" "$REPO/easy1staking/scripts/release-package.cjs" verify \
  --runtime /tmp/easy1-candidate/runtime \
  --manifest /tmp/easy1-candidate/runtime.json --expect "$RUNTIME_SHA"
```

Serve only `runtime/server.js`, with runtime as cwd, using Node 24 and an owned localhost port. Make the owned source/build directory unavailable first, for example by renaming that owned directory. Check the same inventory before and after serving; report legitimate image-cache changes separately. Keep server/browser lifecycle receipts and await owned process exits. Do not stop unrelated servers.

```sh
cd /tmp/easy1-candidate/runtime
HOSTNAME=127.0.0.1 PORT=4399 "$NODE" server.js
```

Run the frozen visitor/discovery/migration checks against this server, including all eight real routes and metadata, robots/sitemap, redirects/410/404 responses, inert API GET/POST/HEAD bodies and no-store headers, unknown facts/no wallet calls, native image decoding and brand archive CRC/licensing. Source guards, pool tests and production dependency audit remain separate checks against the same locked environment. A passing portable candidate does not waive later security tooling, wallet/ledger, credential rotation, final latest-source rebuild or hosting-output checks.

## Deciding controls

Run the repository's actual CLI controls with a new absolute scratch directory:

```sh
"$NODE" "$REPO/easy1staking/scripts/check-release-package.cjs" /tmp/easy1-package-controls
```

These synthetic fixtures exercise immutable committed inputs, root exclusions, prohibited paths inside allowed trees, safe assets, source symlinks, traversal/overwrite refusals, actual runtime bytes, same-root and escaping dependency links, missing native/runtime files, inventory changes and content canaries even with matching supplied inventories. Verify requires an explicit externally retained manifest digest; rewriting both a file and its adjacent manifest fails against the original digest. This does not promise resistance to compromise of the trusted operator, tool or external digest.
