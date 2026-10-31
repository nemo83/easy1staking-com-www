# Wallet observations and guarded signature handoff

`wallet-codec.ts` and `wallet-session.ts` are dormant modules. No page imports
them. They establish ephemeral CIP-30 observations and offer one explicit guarded
signature handoff. They do not establish provider truth, registration, a trusted
`GuardContext`, origin locking, on-page consent or permission to submit. Pool
integration, independent input/registration corroboration and the remaining
transaction lifecycle are separate work.

Call `createWalletSession(resolveProvider)` with an explicit provider lookup,
then `connect(chosenId)` following the visitor's choice. Nothing enables on
construction, refresh before connection, or browser attachment. No account or
wallet choice persists. `getState()` returns frozen observations;
`hasCurrentHandle()` and `handleGeneration` expose whether a fresh handle was
acquired without handing out the extension API. `disconnect()` clears the
choice and observations. `dispose()` also removes the attached listeners and
native interval, and discards late replies. A disposed session cannot reconnect.

Each acquisition calls `enable()` with no extensions, then the four read
methods with no arguments. `getUtxos()` therefore requests the complete,
unpaginated set. Network and change-address reads bracket rewards and inputs.
Observed bracket disagreement fails closed. CIP-30 supplies no atomic account
lock; an unobservable account switch between reads remains possible.

`revision` identifies semantic account/input changes, explicit connections,
disconnects and failures. An unchanged refresh preserves it while advancing
acquisition and successful handle generations. During any refresh no prior
observation or handle is usable. Concurrent queued triggers coalesce; a trigger
arriving during acquisition invalidates its publication and queues a fresh
acquisition. Each step has a ten-second deadline. Disconnect/provider switch
abandons the old logical acquisition immediately; the extension's underlying
promise cannot be cancelled and may settle later. Its result is discarded.
Ordinary acquisitions never run overlapping enable/read operations; abandoned
extension promises cannot be forcibly serialized by a browser application.

`attachBrowser(window, document)` registers focus, visibility-change and native
30-second interval refreshes. Refreshes require visible document state and a
previous explicit selection. The returned function detaches listeners/timer;
session `dispose()` additionally invalidates all pending work. Errors expose
only fixed codes, without raw wallet exceptions or payloads.

Observation times conservatively record each read group's start, including the
initial binding and final binding bracket separately. Input timestamps are
never replaced by publication time. Later consumers must enforce the specified
freshness envelope and independently reconcile provider observations.

The supported address scope is exactly 57-byte mainnet ordinary key/key base
addresses, header `01`. Stake credential A comes from the fresh change bytes.
Reward addresses must be mainnet key rewards (`e1` plus 28 bytes); the complete
list is normalized, deduplicated, sorted and matched to A. A nonempty list
without A refuses. Empty rewards keep A as an observation with
`registration: "unresolved"`. Even a matching reward never proves current
registration. Wallet inputs may have different ordinary payment/stake keys;
membership/ownership and unspent state require later provider corroboration.

The raw codec accepts validated upper/lowercase hex, both ledger output forms
(`[address,value,?hash]` and `{0:address,1:value,?2:datum,?3:script}`), and bounded
definite/indefinite byte, array and map containers. It preserves all outputs or
refuses the whole snapshot. Duplicate outrefs, output keys, policy keys and
asset names refuse. `[]` is a complete no-funds observation; `null` is unknown.
The existing stricter transaction-body parser is unchanged.

Decoded inputs implement the existing `Input` interface with BigInt coin and
token quantities, normalized raw addresses and sorted asset units. No currency
passes through `Number`. Datum absence is `null`; hashes normalize to CBOR
`[0,hash32]`; inline data normalize to `[1,tag24(bytes)]`. Legacy and modern
hashes agree. Reference scripts normalize to `tag24(bytes)` and remain
identified, so the existing builder excludes them. Tag/byte envelopes are
canonical; the enclosed original data/script bytes are preserved exactly,
bounded and structurally checked, never executed or silently replaced.

Limits before parsing/allocation: 2,048 inputs, 65,536 bytes per encoded input,
16 MiB aggregate encoded input bytes, CBOR depth 24, 2,048 entries per container
and 8,192 nodes per input including enclosed payloads. Coin is
0..45,000,000,000,000,000; token quantities are 1..9,223,372,036,854,775,807.
Transaction IDs are 32 bytes, indices 0..65,535, policies 28 bytes and asset
names 0..32 bytes. Unsupported addresses, unknown output fields, malformed
optional content and exceeded budgets refuse with a fixed limitation.

The raw representations were checked against bundled CIP-0030, Evolution SDK
0.5.9 source (`b1e42443010e9c88a1b64e0c9a6b6061adcd16d5`,
`TransactionInput`, `TransactionOutput`, `DatumOption`, `ScriptRef`, `UTxO`)
and Conway ledger CDDL (`f649f9751074d2ab3de033fc3912f29c9862c1f5`). The
runtime codec has no SDK dependency; tests also execute the installed real
SDK public output/datum/script codecs. No nonexistent UTxO CBOR API is assumed.

With the locked dependencies installed and Node 24.22.1, run from
`easy1staking/`:

```sh
node scripts/check-wallet-session.cjs
node scripts/check-wallet-signature.cjs
node scripts/check-stake-builder.cjs
node scripts/check-stake-guard.cjs
node scripts/check-pool-facts.cjs
```

The new suite executes production modules transpiled to ES2017, uses only
public synthetic valueless inputs, and records source/transpiled/fixture/lock
and loaded dependency identities when `WALLET_SESSION_EVIDENCE_DIR` points to
an existing private evidence directory. Browser verification loads those exact
compiled modules in local Chromium and exercises native events and timers in
a private harness; it does not claim a shipped wallet UI or compatibility
with every extension. Real wallets/accounts/mainnet value actions are outside
these checks. Release security, credential and integration gates remain open.

Resource cases are generated deterministically from the compact fixture rather
than storing large encoded inputs. Each pairs a supported snapshot with an
otherwise-valid excessive one: 2,048/2,049 unique outrefs, 65,536/65,537 bytes,
256/257 unique 65,536-byte inputs (16,777,216/16,842,752 aggregate bytes),
inline datum depths 24/28, inline lists of 2,048/2,049 integers, and inline
datums containing 8,192/8,520 total parser nodes including the outer envelope.
Tests assert actual encoded sizes, counts and datum structure independently of
the production decoder. The byte-sized inputs use losslessly retained
reference-script envelopes; the other structured payloads use valid inline
data. Malformed outer shapes, duplicate references and truncated containers
remain separate negative cases.

Each of the six resource tests must fail for accepted excessive content when
its complete corresponding veto is neutralized in an isolated checkout, while
the supported neighbor still passes. Per-input bytes and container entries
each have two checks; both checks for the same limit must be neutralized,
retaining parser counters. Restore the exact source and index after each
experiment and rerun the full wallet, builder and guard suites. These controls
establish regression coverage without changing the production limits.


## Explicit guarded signing

`requestSignature(review, context, { signal }?)` is the only operation that can
ask the wallet to sign. Call it only after the later controller establishes
fresh authenticated sources, eligibility, the origin lock and explicit page
approval. Those obligations are not established by an issued review or this
API. Ordinary connect/recheck/focus/visibility/poll operations still never sign.
`WalletSessionState` has the same shape and read-only observation phases.

The owner reserves one request, captures its revision and semantic observations,
then reacquires the explicitly chosen provider through the existing serialized
`enable()`/read path. It compares the complete input snapshot, exact change
address, network and stake credential with the supplied context. Reward-list
semantics are carried by the validated observation/revision; `GuardContext`
contains no reward-list field. Integer quantities never pass through Number.
The fresh private API signs, preserving its receiver through a trusted invocation
intrinsic captured before provider interaction. It never reads the captured
callable’s `call`, `apply` or `bind` properties. Actual signing occurs before
response-promise lookup or assimilation. An `api.signTx` getter that disconnects
is still refused by the final checks before any sign entry. A wallet with no sign
method remains usable for ordinary observations and refuses explicit signing.

The actual opaque-review guard checks current-clock freshness and the 180-slot
pre-sign barrier immediately before the synchronous
`currentAPI.signTx("84" + review.bodyHex + "a0f5f6", false)` call. This is the
builder's exact ARRAY4 wrapper: original body, empty witnesses, true and null.
There is no arbitrary unsigned-byte signer, API-handle export, signing SDK,
`signData`, wallet `submitTx`, governance extension or provider fallback.

The default response window ends at the reviewed absolute mainnet expiry and
is capped by the 600-slot lifetime. `SessionRuntime.signatureTimeoutMs` can
shorten that window (safe integer 1..600000 ms), never extend it. The same
window bounds post-approval acquisition. Tests use short native deadlines and
record the default scheduled delay; they do not wait ten minutes to claim a
full-duration smoke. Abort, disconnect, dispose, reconnect, timeout or changed
observations discard authority. A started extension RPC cannot be cancelled
by the page: the owner retains its reservation until that RPC settles, even
when logical cancellation has already returned. A settled wallet decline
allows a new explicit attempt. No external wallet/tab/profile lock is claimed.

Signing transport supports primitive synchronous witness strings and genuine native
Promises, including standard cross-realm Promises. Before provider interaction,
the module captures the native Promise constructor, its `prototype.then`, and
the invocation intrinsic. The signer is invoked first. For an object/function
return, the captured native `then` attaches reactions directly to the original
Promise. Its own `then` is never read, and the species-derived return is ignored.
Only original native fulfillment/rejection releases the RPC reservation. An
independent application-owned bridge carries primitive strings or fixed errors;
it never assimilates a wallet-controlled object. Malformed native fulfillment
fails with `WITNESS`; native rejection keeps the fixed declined/refused mapping.

Generic thenables (including otherwise healthy ones), Promise proxies, and native
Promises with throwing or malformed constructor/species behavior are unsupported.
Intrinsic attachment failure returns fixed `UNSUPPORTED`, publishes no witnesses,
and retains this owner's reservation: the thrown error cannot establish that an
RPC has settled. There is no thenable fallback or blind retry. A new owner cannot
prove that such an extension operation ended either. Synchronous invocation
throws, by contrast, have completed their call and permit a later explicit retry.
This compatibility limit follows CIP-30's `Promise<transaction_witness_set>`
return contract (bundled `cips/CIP-0030/README.md`, informed by `connect-wallet`).
It does not establish hostile shared-realm containment or physical completion
of an extension's internal operation. No response timestamp or controller
post-sign deadline guarantee is added here.

After the response, another fresh enable/read acquisition must preserve the
original revision, binding and complete inputs. Unchanged focus/visibility/poll
refreshes are allowed during approval. Returning to the same bytes after an
observed disconnect/reconnect cannot revive a request. Only then does the
owner return frozen `{ witnessHex, revision, handleGeneration }`, where the
handle generation identifies the API that signed, not the newer post-check
handle. Valid hex is normalized without changing bytes and bounded to 65,536
bytes. Empty/partial/extra/invalid witnesses remain **untrusted** and must pass
the actual `assembleSignedTransaction` guard with the later controller's full
fresh context before any POST. No result is a verified/submitted transaction.

All new errors use fixed whitelisted `WalletSignatureError` codes/messages;
raw exceptions, mutable native payloads, causes and throwing accessors do not
escape. No observation, address, review, witness or API handle is persisted.
The known CIP-30 account-switch race between the final observation and outward
call remains; the reviewed body and later verified signatures cryptographically
bind the intended credential regardless.

`check-wallet-signature.cjs` executes actual ES2017 production modules, the
unchanged guard and real signatures. It checks original builder wrappers and
independent literal body IDs, otherwise-valid refusals, finite native timers,
late replies and callback redaction. With the pinned private Playwright and
Chromium tools available, `node scripts/check-wallet-signature.cjs --browser`
runs an isolated loopback harness using actual Noble 2.2.0 ESM bytes and native
WebCrypto. A fresh owned Chrome profile and Playwright CDP `noDefaults` on the
existing default context preserve real document visibility; it observes trusted
focus/visibility events and a real visible 30-second
poll during approval. `WALLET_SIGNATURE_EVIDENCE_DIR` writes module/dependency,
response-byte and lifecycle identities to an existing owned evidence directory.
The harness adds no app route and performs no real wallet/provider/mainnet action.
The corresponding source-neutralization controls cover fresh handle, issued
review, full semantic binding, exact wrapper, cancellation/result suppression,
response deadline, post-approval binding, error redaction and callable-property
invocation; each requires an
actual forbidden call or publication, exact source/index restoration and fresh
new/wallet/builder/guard suite greens. Full controller/W1–W8, SDK Pool browser
activation, security composition, credential rotation and release work remain open.

The shared Node/native-browser settlement cases independently track the original
native Promise before decoration. They measure publication and actual sign
entries while it remains pending, with an ordinary `BUSY` neighbor. Cases cover
own-then getters/methods, cross-realm promises, unrelated species returns and
constructor switching, attachment failures including TypeError, unsupported
thenables/proxies, reentrant cancellation, late fulfillment/rejection and fixed
malformed-response handling. The postcommit `original-native-settlement` control
restores only the former `Promise.resolve(reply)`/`response.then` observation:
the own-then case must show actual premature publication with the native promise
still pending. Restore exact committed source/index, then rerun all Node suites
and the full native campaign with real focus/visibility and 30-second polling.
The earlier callable-property controls and unchanged guard predicates retain
their previous bounded evidence; this new control adds no submission authority.
