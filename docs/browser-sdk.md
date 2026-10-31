# Offline production-browser SDK proof

The developer runner `easy1staking/scripts/check-browser-sdk.cjs` generates a private
Next client route, then exercises the unchanged production stake builder, opaque
review and pre-sign guard in a real Chromium production bundle. It never invokes
npm internally. Install, safety checks and production builds remain explicit caller
steps. The generated route must stay outside the product checkout and release export.

The browser receives only public, valueless synthetic inputs from
`scripts/fixtures/browser-sdk.json`. Expected IDs, fees and deposits stay in the host
process; original body and unsigned-wrapper literals come from the independently
checked `stake-builder.json`. The host compares the original bytes and independently
hashes the returned body with Python BLAKE2b-256. The real guard accepts the healthy
context and refuses an otherwise unchanged context with a changed revision.

Use Node 24.22.1, the current lockfile, Python 3 and an externally installed Playwright
with Chromium. Do not install a browser or upgrade dependencies implicitly. Set the
following absolute paths for your environment:

```sh
runner=/absolute/product/easy1staking/scripts/check-browser-sdk.cjs
fixture=/absolute/owned/fixture-repository
evidence=/absolute/owned/browser-evidence
playwright=/absolute/tools/node_modules/playwright
chromium=/absolute/chrome
```

Create an isolated checkout containing the exact candidate source. Preserve all
unpublished source before removing any checkout; never use forced cleanup. Do not
copy local environment or authentication files. The runner compares all tracked
application source, package/lock and configuration bytes with its own candidate
before generation and verification. It records hashes without dumping configuration
values. Keep generated files and evidence out of the deployable application.

From the product application's directory, run the phases explicitly:

```sh
node "$runner" prepare --fixture "$fixture" --output "$evidence"
# Apply your repository's safety check to the actual fixture BEFORE EACH npm command.
npm --prefix "$fixture/easy1staking" ci --ignore-scripts --no-audit --no-fund
# Apply the safety check again.
npm --prefix "$fixture/easy1staking" run build
node "$runner" verify --fixture "$fixture" --output "$evidence" \
  --playwright "$playwright" --chromium "$chromium"
node "$runner" cleanup --fixture "$fixture" --output "$evidence"
```

Use a minimal environment with no provider credentials, an owned empty npm cache and
separate empty user/global npm configurations. Set `NEXT_TELEMETRY_DISABLED=1` for
builds. The runner starts its own loopback server on an ephemeral port, permits only
GET requests to that fixture origin, and denies outward fetch/XHR/socket/beacon,
wallet enable/sign/submit, storage, IndexedDB and analytics. It exercises every
tripwire before the campaign and records that each responds. Normal shell prefetches
and brand assets are permitted owned fixture HTTP. These browser instruments do not
claim operating-system network isolation.

`browser-results.json` retains full actual results, source/dependency hashes, build ID,
browser/runtime/tool identities, and every received JavaScript chunk's size/hash
checked against disk. Paths retain their nested package placement; external tool paths
remain explicit. Source/installed-entry hashes and actual received chunks are separate
identity witnesses, not a source map or exhaustive runtime module-coverage claim.
Browser/context and server exits are awaited, owned process IDs must disappear, the
browser profile is removed and the port is rebound. `cleanup` deletes only recorded,
unchanged generated route files; it refuses changed source and does not remove the
checkout or dependencies. Retain evidence separately and restore any explicit source
overlay before normal worktree removal.

Calibrate the host oracle after committing normal source. Change only one expected
`txId` literal in `browser-sdk.json`, run the full browser verification, and require
`BROWSER_BODY_ID` after correct actual bytes are recorded. Restore the exact committed
file/index and rerun healthy. For the capability control, take the
`static/chunks/app/browser-sdk-proof/page-*.js` path from the healthy chunk inventory,
prefix it with `/_next/`, and pass it as `--deny-client`. The exact required module
path/hash is recorded before aborting its request. Require `BROWSER_CAPABILITY`, then
run the complete healthy campaign again without that option. This is a capability
control; it does not mutate transaction policy. Keep separate copies of each result.

The measured production client construction preserves these accepted originals:

| Account | Body bytes | Transaction ID | Fee | Deposit |
|---|---:|---|---:|---:|
| Registered | 192 | `389aa08d5fefbe84c939b7243b6477a0c716fc66609dc66cbde49c64f2ed0d38` | 172937 | 0 |
| Unregistered | 197 | `e28a9dadcdfff8f04040672e228ebe623a6b4e6466bdf0e6c08c41ded8486fdb` | 173157 | 2000000 |

This establishes actual browser construction on the recorded toolchain, with unchanged
Evolution SDK 0.5.9 and Noble. It adds no production route, SDK/polyfill/config change
or application activation. The independent funded-ledger witness for these originals
is described in [stake-builder.md](stake-builder.md); this browser proof does not repeat
or replace it. No extension, provider observation, live account, signing, submission,
confirmation or mainnet action is exercised. Complete Pool/controller W1–W8, source
acceptance, live new-wallet evidence, credential rotation and release gates remain open.
Production audit zero and the documented thirteen moderate development findings are
separate security checks, never a full-audit-zero claim. Guidance used:
`build-transaction`, `evolution-sdk-transaction-traps`, `dependency-sources`,
`verification-harness`, `toolchain-false-greens`, and bundled Evolution installation
documentation. Pinned source and the observed client execution determine compatibility.
