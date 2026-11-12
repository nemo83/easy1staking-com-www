# Browser delegation coordination

`easy1staking/src/lib/site/delegation/coordination.ts` is a dormant,
framework-independent browser primitive. It coordinates cooperating tabs and
retains minimal recovery intent. No application route imports it. It does not
connect a wallet, build/sign/submit a transaction, contact a provider or resolve
chain outcomes. Its tokens attest only to its own bookkeeping.

## Supported guarantee and boundaries

One exclusive native Web Lock named `easy1staking:delegation` covers every account
and wallet on the cooperating browser origin. `withNewOperation` holds the lock
for the entire asynchronous callback, including any future decision, build,
review, signing and first-attempt phases. Another tab receives `BUSY`; there is
no polling mutex, per-account key, force-unlock or storage-based fallback.
Missing/unusable locks or failed storage probes prevent the protected callback.

The waiting-promise behavior follows the [Web Locks specification](https://www.w3.org/TR/web-locks/).
An AbortSignal does not revoke an already-held native lock. Instead, this module
revokes its private lease and settles its own waiting promise on abort/disposal.
Late caller promises remain observed, and their tokens cannot mutate state. It
cannot cancel external wallet/provider promises or stop arbitrary caller code;
a future controller must check the active lease and retained intent immediately
before outward I/O and implement all transaction/context/approval guards.

Duplicate suppression requires the record to remain retained and the cooperating
origin lock to work. A synchronous localStorage write/readback is not a disk
durability acknowledgement. Crash, eviction, rollback, private-session end, user
deletion, other profiles/devices and external wallet actions remain outside the
guarantee. This is neither durable exactly-once coordination nor an atomic lock
on a wallet or the chain. `navigator.storage.persisted()` is an optional read-only
capability signal; false, absence or rejection does not disable otherwise usable
storage. The module never calls `persist()` or requests persistence permission.

An instance that observes a known record disappear, change identity or regress
stage keeps the original neutral transaction ID and blocks further work. A new
instance after restart with no retained record cannot detect that prior loss.
Native storage-event payloads are validated as well as current storage: restoring
the original bytes before the event handler runs does not erase observed loss.
With no record, the later controller still owes uncached assessment/history/input
reconciliation and must block visible contradictions; consistent-looking stale
indexes cannot establish absence. This primitive does not provide those reads.

## Minimal record and API

One stable localStorage key, `easy1staking:delegation-recovery`, stores exactly:

| Field | Accepted value |
|---|---|
| `schemaVersion` | `1` |
| `networkId` | Explicit mainnet `1` |
| `poolId` | Fixed EASY1 `pool1yr0cv3dtmhcfgqa6yetvmf769ngk89e6tepecmjrmjl2jzcw2lm` |
| `txId` | 64 lowercase hexadecimal characters |
| `invalidHereafterSlot` | Canonical decimal string, 4,492,800 through 9,007,199,254,740,991; parsed as BigInt |
| `inputRefs` | 1–2,048 unique lowercase `txhash#index` strings; index 0–65,535 |
| `createdAt` | Safe nonnegative integer timestamp |
| `stage` | `prepared`, `submitting`, `submitted` or `unknown` |

The slot range matches the existing mainnet guard's supported slot origin and
safe-integer upper range, without rounding strings through Number. Raw records
must use the module's exact canonical serialization: duplicate/extra keys,
alternate key order, escaped key spellings and whitespace changes are refused.
Malformed and future-schema records remain blocked and are never migrated or
erased automatically. No address, enabled handle, wallet choice, account binding,
review, transaction bytes, witnesses, seed or extra identifier is persisted.

`createDelegationCoordinator()` installs an owned storage listener. Importing the
module has no browser effects. The factory exposes:

| Method | Authority and behavior |
|---|---|
| `withNewOperation(callback, { signal }?)` | Acquires the native lock, probes actual storage write/readback/cleanup, checks shared unresolved state, then invokes one callback. |
| `prepare(lease, details)` | Accepts only ID, upper slot, input references and creation time. Writes and exactly reads back the fixed-target `prepared` record synchronously before issuing a private intent token. |
| `beginAttempt(lease, intent)` | Requires the original new-operation lifecycle, rechecks the active lease/token and matching retained record, records private attempted state, and synchronously writes/reads back `submitting` before returning an attempt marker. Recovery callbacks cannot begin an attempt. No transport is invoked. |
| `markOutcome(lease, intent, stage)` | Moves a matching attempted `submitting` intent to `submitted` or `unknown`. Neither means chain confirmation. |
| `withRecoveryOperation(txId, callback, { signal }?)` | Acquires the same lock and requires the retained prior ID. It does not retry, rebuild or resolve the operation. |
| `recoverUnattempted(lease)` | Issues a fresh callback-bound token only when this same coordinator privately remembers that exact candidate and knows no attempt was begun. Reloaded `prepared` is insufficient. |
| `cancelUnattempted(lease, intent)` | Explicitly removes only a matching candidate privately known never attempted, under the current lease; exact absence is read back. Attempted/reloaded/copied authority is refused. |
| `getState()` | Returns deeply immutable neutral prior-operation state and known ID, without attaching it to any selected account. |
| `dispose()` | Revokes callbacks/tokens and removes the owned listener; retained records remain. |

Leases and intent tokens use private object identity and expire when their callback
ends. Cloning, cross-coordinator use and replay fail. A later callback requires a
fresh lease and, for cancellation, a freshly issued token backed by same-process
knowledge. Preparation and the attempt marker must occur within the caller's
single protected lifecycle; there is no released-lock gap before the first attempt.
The marker authorizes no blockchain effect by itself.

All loaded records, including `prepared`, block new operations across accounts,
tabs and reload. Returned IDs, elapsed time, validity expiry and a transaction-index
404 cannot clear them. There is deliberately no public blind-clear, confirmed,
expired or boolean-proof resolution API. Chain confirmation/reconciliation and
authoritative post-expiry input evidence belong to a later source-backed
controller. Keep the known ID available for independent status checking and give
manual-wallet guidance when browser coordination is unavailable. Do not recommend
deleting recovery storage as a way to retry.

Explicit cancellation can remove a locally known never-attempted record. Another
already-observing coordinator cannot infer that private proof from a deletion
event, so it conservatively retains the prior ID as unknown. This favors safety
over availability. Native errors and raw invalid records are never logged or
included in the module's fixed error messages. Callback-owned errors are rebuilt
from validated fixed codes, including modified `CoordinationError` instances;
their message strings and throwing accessors cannot forward callback payloads.

## Reproduction

Use Node **24.22.1** and the committed application lockfile, following this
repository's safe-source execution requirements before every npm command. From
`easy1staking/`, install without lifecycle scripts and run:

```sh
npm ci --ignore-scripts --include=dev --no-fund
node scripts/check-delegation-coordination.cjs \
  --playwright /absolute/path/to/node_modules/playwright \
  --chromium /absolute/path/to/chromium/chrome \
  --evidence-dir /tmp/easy1-coordination-evidence
node scripts/check-stake-builder.cjs
node scripts/check-stake-guard.cjs
node scripts/check-pool-facts.cjs
node scripts/check-framework-security.cjs
node scripts/check-runtime-security.cjs
node scripts/check-tooling-security.cjs
node scripts/check-minimatch-compat.cjs
node scripts/check-release-package.cjs /tmp/easy1-package-controls
npm run build
npm run lint
npm audit --omit=dev
npm audit
```

Playwright and Chromium are external test tools, not new application dependencies.
Pass both as absolute paths: `--playwright` names the Playwright package directory
and `--chromium` an executable Chromium. There is no default path; every mode
except `--node-only` refuses without both, before any case runs.
`--node-only` runs parser cases; `--browser-only` runs browser cases. Full acceptance
requires the real browser run. The runner transpiles the current production source
to ES2017, serves exactly those bytes from an owned ephemeral loopback server, and
checks browser response hashes. Fresh contexts contain two same-origin pages with
actual native Web Locks, query results, localStorage, storage events and reloads.
Injected failing native properties/methods are labeled and restored. Phase and
attempt markers are test markers, not actual signing or POST evidence.

The runner records full source/compiled/fixture/runner/lock and actual loaded
dependency hashes, Chromium identity/child exit and server closure/rebind evidence
in the chosen temporary directory. Synthetic fixtures contain only valueless IDs
and minimal recovery fields. Network/wallet/analytics/persistence-prompt tripwires
are first shown to respond without making an outward call. No real wallet,
provider or mainnet action is permitted. No source fixture route is added.

The existing dependency disposition remains separate: the current full development
audit reports **13 moderate** findings, with the exact legacy minimatch source
disposition documented in [tooling-advisories.json](tooling-advisories.json).
Production-only audit is zero at the recorded check; no raw-zero full audit or
release/credential clearance is implied. Development runners, fixtures and their
temporary browser artifacts must stay outside the released runtime package.

Before handoff, bounded source controls must demonstrate real forbidden
consequences when complete lock, lease, pending/lost, readback, attempted-cancel,
record-identity and late-continuation vetoes are neutralized. Restore the exact
committed module and index and rerun the full new suite plus builder/guard suites
after each. Native callback concurrency cannot prove absence of duplicate POSTs;
submission, actual controller/browser integration, chain recovery and full W1–W8
evidence remain later work.
