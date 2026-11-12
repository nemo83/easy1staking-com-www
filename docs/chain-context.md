# Fresh mainnet chain context

The four modules `provider-json.ts`, `blockfrost-reader.ts`, `source-cbor.ts`
and `chain-context.ts` under `easy1staking/src/lib/site/delegation/` are dormant.
No page imports them. `assessChainContext(sessionState, browserPublicProjectId,
options)` consumes an actual fresh observed wallet-session state and explicit
browser-intended Blockfrost mainnet identifier. It acquires no wallet handle,
builds no transaction, and performs no signing or submission.

It returns a frozen discriminated result:

- `ready`: an actual `GuardContext` and separate source/eligibility provenance.
- `already-EASY1`: factual acknowledgment and provenance, without a context.
- `refused`: a fixed redacted code/message; no provider payload or exception.

The ready result is construction information, not signing permission. The future
single-owner controller must still implement wallet rechecks, compare both the
semantic and eligibility identities, obtain explicit review/approval, and apply
all pre-sign/post-sign, recovery, lock, witness, submission and confirmation
barriers. The accepted wallet/session/builder/guard modules are unchanged.

## Evidence rules

The only host is `https://cardano-mainnet.blockfrost.io/api/v0`; paths are validated,
requests are GET-only, uncached, omit credentials/referrers and refuse redirects.
Nothing reads environment/auth stores or logs, persists or transmits wallet
information to analytics. The identifier is opaque header-safe text, not an
assumed key-format pattern. Missing, unauthorized, quota-limited or unavailable
configuration refuses without another provider.

Positive 200 account `registered` is reconciled with complete registration and
delegation histories and original transaction positions/certificate indices.
`active`, an empty reward-address list and 404 never prove registration. A
never-registered credential additionally needs indexed funded exact-address
unspent association with that credential. Historical deposits are historical;
today's deposit comes only from effective validated parameters. Combined
registration/delegation at one certificate index and multiple actions in one
transaction are supported through actual certificate multiplicity and ordering.

EASY1's fixed key hash and independently checked bech32 encoding are immutable.
Current pool state, metadata, complete updates, retirement lists and exact
transaction certificates determine operational eligibility. Scheduled and
effective retirement block. A subsequent pool registration cancels a scheduled
retirement immediately, including when updated parameters activate later.
Historical retirement hashes alone never mean permanent retirement.

Every wallet input requires positive exact-address `/utxos` membership plus an
exact transaction-output match: outref, full mainnet key/key base address, ADA,
every native asset, datum and reference-script identity. Missing optional fields
are unknown. Transaction `consumed_by_tx` absence/null alone never proves unspent
status. Datum hash and inline data remain distinct; original inline CBOR is
preserved. Reference hashes use the language prefix and original native-CBOR
span or raw Plutus bytes. Reference outputs stay in the full correlated snapshot
and the unchanged builder protects them from funding selection.

Current tip/epoch and account/pool/parameters bracket the reads. Tip time must
match mainnet's slot configuration and the local 30-second freshness envelope.
Protocol major 11/minor 0, Conway, and all actual guard-used parameter fields are
required; no defaults or obsolete word-cost conversion are supplied. Integer
JSON lexemes and documented decimal strings reach BigInt without Number
rounding; unrelated valid fractional fields remain supported. Canonical
parameter/semantic identities are independent of JSON property order.

For a refresh, pass `options.prior = { constructionTip, currentTip, identity }`
from the previous result/context. The original construction tip and its original
observation time remain exact. A separately fresh current tip may advance;
rollback, same-slot hash or height disagreement, epoch/parameter/input/registration/pool
or eligibility changes refuse. First assessment checks initial→final; refresh checks
construction→prior current→initial→final in actual observation order. Every earlier/later
pair must have nondecreasing slots, the same hash at an equal slot, and different hashes
at different slots, including non-adjacent points. A contradictory initial observation
refuses even when the final point advances normally. Only initial/final points supply
observed heights: an advancing slot requires a strictly advancing height; an identical
slot preserves height. Prior tips contribute core fields only, ignoring extra caller
height fields rather than inventing historical height evidence. Their original
observation times are preserved. Wallet timestamps always remain their original
read starts. These indexed observations are not an atomic ledger snapshot and
cannot detect every consistently lagged index or external-wallet race.

Callback failures are reconstructed as fresh errors from one safely read primitive
code on the fixed whitelist. Unknown, non-string and throwing code values use a
fixed boundary fallback. Supplied message/cause objects are never forwarded. Public reader failures also
rebuild retained cancellation/timeout errors, so mutating a returned error cannot
change the operation’s subsequent fixed failure.
This is tested at the reader, clock callback and assessment boundaries using
synthetic exceptions; it is not evidence of a live-provider exploit.

## Resource and time limits

A refresh has a 30-second total deadline; each request includes headers AND the
streamed body under one 10-second deadline. Cancellation aborts active reads,
clears timers/listeners and discards late results. Operation-local immutable
transaction metadata may be memoized; current views are never cached between
operations. Requests run serially (concurrency one).

One operation permits 512 requests, at most 64 pages per paginated endpoint,
100 rows/page and 8,192 total paginated items. A full final page requires another
short page; exhaustion never marks partial history complete. Response bodies
are limited to 4 MiB before text assembly, with fatal UTF-8 decoding and checked
content type and a bounded numeric Content-Length hint. Native Fetch validates
wire framing and exposes decoded bytes; compressed wire length is never compared
to decoded length, including when CORS hides Content-Encoding. JSON permits depth
32, 131,072 nodes, 8,192 entries/container,
262,144 decoded string units, and 128-character number lexemes. Duplicate decoded
keys, malformed/trailing JSON and exceeded budgets refuse. The accepted wallet
codec separately enforces its existing CBOR and complete-input limits.

Shorter test deadlines may be supplied through `options.runtime` within the
10/30-second maxima. There are no caller network, target, fee, deposit or validity
overrides and no UI/environment deadline controls.

## Reproduction

Use Node **24.22.1** and the pinned package lock. Apply the repository's safe-source
execution checks before each npm command. From `easy1staking/`:

```sh
npm ci --ignore-scripts --include=dev --no-fund
node scripts/check-chain-context.cjs
node scripts/check-wallet-session.cjs
node scripts/check-stake-builder.cjs
node scripts/check-stake-guard.cjs
node scripts/check-pool-facts.cjs
node scripts/check-framework-security.cjs
node scripts/check-runtime-security.cjs
npm run build
npm run lint
npm audit --omit=dev
npm audit --include=dev
```

`check-chain-context.cjs --emit /absolute/existing/private/directory` records source,
in-memory transpilation, fixture, lock and actual loaded public dependency file
identities. It executes the current production modules, real SDK public codecs,
and unchanged builder/guard review issuance. Registered/unregistered source
contexts must produce the independent previously accepted literal transaction
bodies/IDs. All transport uses controlled fetch/streams; outward sockets are
tripwired. No real wallet/account/provider request is part of the suite.
The development scripts/fixtures must remain outside the deployed runtime artifact.

Named postcommit controls neutralize complete numeric, HTTP-status, mandatory
parameter, retirement, correspondence, pagination, body-deadline and tip-coherence
vetoes, plus parser boundaries. A control must change an actual source observation
or readiness decision while its healthy neighbor stays valid. Restore exact
committed source and index after each, then rerun the complete source, wallet,
builder and guard suites; a parser/import failure is not a deciding control.

The source suite has 183 cases (182 before the mismatched-address test),
including 21 named observed-tip traces with real source-produced prior contexts,
distinct construction/current points, non-adjacent hash reuse, malformed prior
copies and ignored extra prior heights. The mismatched-address test feeds
valid-bech32 57-byte provider addresses with another header type or network, or
another prefix, and requires each to be refused and never accepted: as observed
with Evolution 0.5.14 the code is RESPONSE, and INPUT for the `addr_test`
prefix. It pins those refusal codes and claims nothing more about which
addresses are accepted; removing the site's `addr1` prefix check changes the
`addr_test` code, which the test detects. Healthy traces
reach actual builder review and pre-sign recognition; contradictory traces return
fixed COHERENCE refusals without a context. Branch-specific correspondence controls remove
only the non-null datum comparison or non-null reference-hash comparison, keeping
null-wallet absence checks intact. Hash-datum and original-inline mismatches
change both provider views consistently; native and Plutus V1/V2/V3 mismatches
retain a separate ordinary funding input. Matching neighbors build with genuine
guard-issued reviews, and reference outputs remain protected. Under each removed
comparison the corresponding wrong content becomes source-ready and reaches
actual builder review/pre-sign recognition, which the regression must detect.

Point controls separately bypass prior→initial comparisons, restrict coverage to
adjacent points, or remove the complete slot chronology, hash/slot identity or
observed-height relationship. Each must expose its named unsafe source readiness
while identical points and genuine advances remain supported. Fixed-error controls separately
neutralize the reader, clock and assessment sanitization boundary and must expose
the synthetic supplied message; this is a privacy consequence, not transaction
readiness. Exact restoration and the full four suites follow every control.

## Operator diagnostic — prepared, live gate pending

The reviewed command is:

```sh
node scripts/probe-chain-context.cjs
```

Run it only in an interactive TTY with an intentionally browser-public mainnet
identifier. Enter the identifier at its hidden prompt; never put it in arguments,
environment variables, chat, saved output or auth stores. No seed/private key is
requested. TTY raw/echo state is restored on completion, errors and signals.

The diagnostic uses the SAME production reader/assessment via the shared current
source loader. It samples bounded public plain funded ordinary base-address
outputs from current indexed blocks and constructs explicitly **index-only**
synthetic observations. This establishes no ownership or actual-wallet consent.
It never imports/calls the builder or wallet APIs. Limits are 32 candidates,
200 requests and 120 seconds; authorization/quota errors stop without retry or
failover. Output contains only whitelisted aggregate counts/coherence flags,
fixed source and tool/source identities, with no sampled addresses, transaction
bytes, response bodies or identifier.

A live never-registered observation requires positive 200 `registered:false`,
complete empty registration/delegation histories, funded/unspent credential
association and coherent fresh context. 404 stays unknown. A formerly
deregistered account is reported separately from never-registered evidence.
The operator probe is prepared and tested with a synthetic hidden-PTY identifier
and intercepted fetch only. **No live provider proof is claimed here.** Actual
new-wallet observation, legitimate browser-public identifier provisioning,
credential rotation, current dependency/release composition, actual browser SDK
integration and the complete wallet lifecycle remain separate release gates.

Source decisions use `query-chain`, `dependency-sources`,
`evolution-sdk-transaction-traps`, and `toolchain-false-greens`; bundled Blockfrost
OpenAPI `src/{paths/api,schemas}`; Evolution SDK 0.5.9 source
`b1e42443010e9c88a1b64e0c9a6b6061adcd16d5` (`Address`, `RewardAccount`,
`PoolKeyHash`, `ScriptRef`, `CBOR`); Noble 2.2.0 source
`81983c2fffac48aa69dabc260b4192ad597d2734`; and official ledger
`f649f9751074d2ab3de033fc3912f29c9862c1f5` (`Core.hashScript`,
`Alonzo.Scripts.originalBytes`, `Shelley.Rules.Pool.poolTransition`). The SDK's
generic Address codec is for payment addresses; RewardAccount supplies the stake
prefix. Native script reserialization is deliberately avoided when hashing.
