# Staged EASY1 Pool wallet flow

The `/pool` page mounts a private stake-only controller. A visitor explicitly
chooses a CIP-30 wallet, connects, obtains independently reconciled mainnet
observations and builds an inline review. The review shows the stake credential,
fixed EASY1 pool ID, exact fee, separate registration deposit and absolute expiry.
Only its original display object can authorize approval. No voting action is
available. The legacy combined staking/voting helper has been removed.

This is a local candidate. Public activation still requires the remaining
recovery, mobile, operator and release gates. The page retains and shows
Submitted or Unknown with a known ID, then checks chain status read-only and
confirms the delegation when every check agrees. It cannot yet clear an
unconfirmed record or retry. Submitted means that the provider returned the
matching ID, not chain confirmation. Use the originating browser and an
independent wallet or explorer to check an unresolved operation. Do not delete
recovery storage to make a new attempt.

## Ownership and submission

The controller privately owns the existing wallet session, actual chain source,
opaque guard review and native origin coordinator. The native Web Lock covers
fresh assessment, construction, review, approval, signing, post-sign checks and
the first submission attempt. UI code receives immutable display data and
explicit actions, never an enabled wallet API or unsigned/signed CBOR.

The wallet owner preserves its existing state and signature-result shapes.
Subscribers observe transitions without granting authority. A private WeakMap
binds an authentic original-native-Promise fulfillment timestamp to the exact
returned signature result. The 30-second total post-reply window starts before
wallet reacquisition and covers those reads, chain reconciliation, real signature
verification and the first outward POST. It does not limit time spent considering
wallet consent. Same-account focus/visibility refreshes remain usable; observed
revision changes, cancellation, disconnection and disposal revoke authority.

Construction retains the original tip and `tip + 600` validity. There must be at
least 180 slots before signing and 120 immediately before submission. Fresh
source semantic/eligibility identities, wallet ownership, observation ages,
opaque witness/body authority, active lease and matching retained intent are
checked before invoking a captured fetch callable. Minimal intent is written and
read back first. The only submission host is the fixed mainnet Blockfrost host;
POST sends exact guarded `application/cbor` bytes, omits credentials/referrers,
disallows redirects and caching, and has a 60-second response deadline. There is
no automatic retry, SDK submission or wallet submission fallback.

Any possible transmission retains the independently derived ID through timeout,
cancellation, malformed or mismatched response and storage loss. Revoking a lease
may prevent updating its stored stage; that cannot turn an attempted transaction
into a safely cancelled one. No late reply can revive an invalidated operation.

Web Locks/localStorage coordinate cooperating agents in one retained browser
origin. They do not provide crash-durable exactly-once behavior, atomic wallet or
provider observations, or coordination across apps, deployments, profiles and
devices. Consistently lagged indexes and undetectable loss across restart remain
limitations. Source/guard resource and supported-key-account limits still apply.

## Status and confirmation

After the first attempt returns Submitted or Unknown and the new-operation lock
is released, the page checks Blockfrost by transaction hash right away and then
about every 10 seconds. The budget is 180 seconds measured from the outward
dispatch time that the final barrier recorded, not from when polling started;
at that deadline an in-flight check is aborted and its result revoked. Status
work has its own cancellation and generation authority: disconnecting the wallet
does not stop it, while leaving the page does, and a late completion has no
effect. Checks are serialized and each takes the recovery lock only if it is
free; a busy lock skips that tick.

One check is one bounded read session (10 seconds per read, 30 seconds in
total) in a fixed order: latest block (T1), transaction content, the exact
on-chain transaction bytes, the certificate rows they imply, the inclusion
block, the account view with its complete delegation and registration
histories, every later or same-block event for that stake credential, and the
latest block again (T2). The transaction must have the recorded ID, TTL and
inputs, a body that hashes to the ID, and only the stake-only certificate shapes
`[2]`, `[7, 2]` or `[11]` for one key credential and EASY1, with a matching
deposit. The stake credential comes only from those bytes. Live tips keep the
existing freshness and progress checks; the inclusion block and later events are
historical points with their own coherence check against T2, so an old or
prior-epoch inclusion is legitimate. One block hash names one block: a
historical point that reports T2's hash must be T2 itself (same slot, height
and time), otherwise the result is `inconsistent:POINT_RELATION`. T1 names one
block too: the inclusion and every reconstructed later event are checked against
T1 for block identity only. A point that reports T1's hash, slot or height must
be T1's block (same hash, slot, height and time), and a lower slot must have a
lower height and the converse; a violation is `inconsistent:POINT_RELATION`.
There is no upper bound against T1, so an event included between T1 and T2 is
still accepted. The historical
points are also checked against one another: across the inclusion and every
reconstructed later event, one height, one slot or one block hash names one
block (hash, slot, height and time), a lower slot has a lower height and the
converse, two transactions never share one block and transaction index, and one
transaction never appears at two points. A violation is
`inconsistent:POINT_PAIR`. The account view must equal the
effect of the last reconstructed certificate, so a later delegation elsewhere,
a later deregistration, or a re-registration without a new delegation is shown
as information only when a verified certificate explains it. The page names
four account states: currently delegates to EASY1, has since delegated to
another pool, has since been deregistered, and registered but not currently
delegated to a pool. The check never enables or calls the wallet, builds, signs
or posts.

Outcomes are confirmed, not-found, pending (newer than T1 or an index still
catching up), inconsistent (a positive contradiction) and unavailable (provider
error, timeout or limit), each with a machine reason code; the page's private
view keeps the last one (for example `inconsistent:BODY_ID`) and never renders
provider payloads. Only a confirmed check obtains a single-use resolution
from the coordinator's one issuer; it binds the exact record, recovery lease,
status generation, observed T2 and a deadline, and it is checked synchronously
immediately before the record is removed. A 404, timeout, provider error,
contradiction or lagged index never removes the record, and there is no
time-based removal. A confirmation is shown as a historical fact for the
transaction's own stake credential, with its current state, never attributed to
a different connected wallet. The confirmed result (block, confirmations,
credential, account state, its ID and the "confirmed on chain" caption) is held
apart from the wallet and action state: Disconnect, a new Connect, a new review,
a cancellation with no operation in progress and a failed visible wallet
refresh never relabel it or caption its ID as pending or unknown. The result
lives in page memory only; after a reload the record is already removed and the
page shows no prior operation.

The page always shows the active transaction ID: the newest operation known to
this page, taken first from this page's own attempted operation, then from the
browser's recovery record, then from the retained confirmation. A stale local ID
never hides a record that names a different one. The retained confirmation, its
caption and its message are shown only while its ID is the active one. A local
attempt supersedes it as soon as its record is written, and the new ID carries
its own caption ("submitted, confirmation pending" or "outcome pending or
unknown"). When another tab of this browser creates a pending record for a
different ID and this page has no operation of its own, the page shows that ID
with the "outcome pending or unknown" caption and the message "Another
delegation from this browser is pending. Keep its transaction ID and check its
status.", and Check status checks that ID.

When the budget ends without confirmation the page apologises, keeps the record
and the ID and offers Check status. If the budget has already ended when status
work would start (for example a tab suspended past dispatch plus 180 seconds),
the page shows the same apology at once, without a check, and keeps the record,
the ID and Check status. An inconsistent result stops polling and
clears nothing. If another tab of this browser changes or removes the saved
record, status work stops and keeps the ID; the changed record is never healed.
After a reload there is no automatic poll; Check status runs one bounded check.
A confirmation at one block can still be rolled back; the record is removed at
the first coherent confirmation and the ID stays visible.

## Failure messages

Every failure the page can reach shows one fixed plain message with a recovery
step. The message is chosen only from codes that the page's own modules produce:
the wallet session's connection errors, the chain source's refusal codes, the
wallet signature codes, the transaction guard and builder codes, the browser
coordination codes and the page's own stop reasons. A code is used only when it
is an own key of its table; anything else, including `__proto__`,
`constructor`, `toString` or a non-string, gives that kind's fallback. No error
message, header, wallet payload or provider payload is read or rendered. The
page's private view also keeps a machine reason such as `wallet:REFUSED`,
`source:TRANSPORT`, `signature:DECLINED`, `guard:VALIDITY`,
`build:INSUFFICIENT_FUNDS` or `stop:cancel-idle`; it is never rendered.

At connection, the page names a wallet that is not available in this browser, a
refused connection or request, a wallet that did not answer in time, an account
that cannot be used here (a network other than mainnet and an unsupported or
ambiguous credential share this message, because the wallet session reports one
code for both) and a wallet that changed while connecting. It also names a chain
data service that is not set up correctly, chain data that is unavailable right
now, an EASY1 pool that is retiring, retired or not yet active, and an account
with no ADA. Every other chain-source failure keeps the existing "could not be
verified" guidance.

Before anything is sent, each stop begins "Delegation stopped before sending."
and names the cause and the next step: a declined signature, a wallet that could
not sign, an expired review (the guard's validity check, the signature window,
the final remaining-slot and authentic-reply deadline checks and the post-reply
timer), a changed wallet account, network or funds, too little ADA for the fee,
any registration deposit and the minimum change, a fee above the page's bound, a
transaction that could not be built or checked safely, a signature that does not
match the reviewed transaction, and the chain-source refusals. No message
promises an automatic clear, retry or rebuild. Once a transaction may have been
sent, the existing unknown-outcome texts are unchanged: a rejected or uncertain
submission is never proof that it was not included. Pending confirmation keeps
its existing texts.

The first stop reason latched on an operation wins: the visitor's cancel, a
wallet change observed by the wallet owner, or an expiry. A later automatic
cancel, such as the wallet owner's revision change after Disconnect, never
replaces it. "Cancelled here. Any open wallet request may still finish; its late
reply cannot submit." appears only when a wallet call that this page started
(the connection, an operation's wallet recheck or the signature request) had not
settled at the moment of the cancel. Otherwise the page shows "Cancelled here.
Nothing was sent." Background focus and visibility refreshes do not count as an
open call. Disconnect while nothing is in flight keeps a transaction result,
including a confirmation, with its status line, and adds a separate "Wallet
disconnected." line outside the status line; the next Connect clears it. With no
result to keep, Disconnect returns the page to "Choose a wallet to connect."

When the page shows another tab's pending record, that record's ID becomes the
page's own ID. If the record is then removed or replaced, the page shows "This
operation's saved status changed in another tab of this browser. Keep the
transaction ID and check it in your wallet or a chain explorer.", keeps that ID,
offers no Check status, and never shows an earlier confirmation again. Handling
of an expired recorded transaction and a deliberate retry of identical signed
bytes remain separate later work.

## Mobile entry

Before connection the page explains how to open its exact URL in a compatible
wallet's dApp browser. An optional CIP-158 browse URI contains only the exact
current approved origin plus `/pool`: production stays production and preview
stays preview. Query parameters cannot choose a destination. Local origins give
instructions. Connection, active work, recovery or unavailable coordination
suppress the link. Nothing transfers a wallet session, address, ID or transaction
between browser contexts.

Synthetic Chromium viewport/keyboard tests do not establish physical wallet
compatibility or completion of the two-device requirement. Required real device,
wallet/browser/version evidence remains unproved. Automated real-mainnet wallet
or asset actions are prohibited.

## Developer reproduction

Use Node **24.22.1**, the unchanged committed lockfile, and the repository's
safe-source checks before every npm command. Install with lifecycle scripts
disabled. Supply a fresh owned absolute `TMPDIR`; all generated browser profiles,
server logs and test artifacts belong there. Use a short temporary root so Chromium's
Unix socket path fits the operating-system limit. The external pinned Playwright and
Chromium tools must already exist. Pass their absolute package-directory and executable
paths explicitly; the runner validates them and never searches for or installs tools.

The developer script has two explicit modes:

```sh
node scripts/check-delegation-flow.cjs \
  --evidence-dir "$TMPDIR/build-input" --prepare-only yes
```

This writes only an external Node preload that intercepts server-rendered pool
reads and denies outward sockets. With safe-source checks applied, build the
actual application using that preload and the intentionally invalid public test
identifier `SYNTHETIC_PUBLIC_INVALID_IDENTIFIER`:

```sh
NODE_OPTIONS="--require=$TMPDIR/build-input/ssr-preload.cjs" \
NEXT_PUBLIC_BLOCKFROST_PROJECT_ID=SYNTHETIC_PUBLIC_INVALID_IDENTIFIER \
NEXT_TELEMETRY_DISABLED=1 npm run build
node scripts/check-delegation-flow.cjs \
  --evidence-dir "$TMPDIR/browser" \
  --playwright /absolute/path/to/node_modules/playwright \
  --chromium /absolute/path/to/chrome --cases all
```

The second mode explicitly starts the existing production Next server on a fresh
loopback port, exercises its real `/pool` route, then closes browser/server and
proves port reuse. `--cases first` runs the registered/unregistered/cancellation/
visible deadline regression plus the controlled hidden late/timely discriminator; `--case NAME` runs one named case from the JSON
fixture. `--preload /absolute/path` can select an independently reviewed external
server tripwire. No fixture application route or production policy override is
created. Rebuild without the synthetic identifier before any ordinary artifact
or release check; runtime source/configuration contains no test fixture data.

The runner injects a public synthetic CIP-30 wallet and intercepts every external
browser provider request. Server reads are independently intercepted by the
preload. It exercises real source parsing/reconciliation, Evolution SDK
construction, opaque reviews, Ed25519 guard verification and exact direct POST
bytes. Expected body/unsigned bytes, ID, fee and deposit are literal accepted
stake-builder fixtures. Python BLAKE2b independently checks IDs; expected
transactions are never rewritten to match actual output. The indexed construction
tip stays that fixture's original tip; post-reply current tips may advance while
the prior context preserves construction/TTL. Browser wall time advances with
real elapsed time under a fixed archived offset.

The two hidden-document cases combine 24 seconds of sequential wallet
reacquisition (eight seconds each for enable, first network and first change read)
with either one bounded eight-second source delay or prompt source work. The late
case must stop with zero POSTs; the timely neighbor must send one exact original
transaction before 30 seconds. Both simulate `document.visibilityState = hidden`
after the authentic synthetic wallet reply, recording that transition, reply and
attempt times, enable/sign counts, construction/current tips and real elapsed time.
The unchanged visible deadline regression remains among the original 54 cases;
`--cases all` now executes 86 cases (81 before the failure-message cases were
added) and `--cases first` executes six. Selectors
are strict: `--case` must name one registered case (the 86 plus
`missing-configuration`) and `--cases` must be `all` or `first`; anything else
exits before a server or browser starts.

Every registered case declares its exact page dispatches and intercepted POSTs
in the fixture: 0 for veto and refusal cases, 1 for single-attempt cases and 2
for `confirm-then-second-operation`. Page
dispatches accumulate across the tab's navigations and reloads; both counts are
asserted on success and recorded on failure. A status case reads the first
intercepted POST only after the route handler has recorded it: the page-side
dispatch clock shows that `fetch` ran, not that the route recorded the POST, so
the runner waits up to 10 seconds for that record and otherwise fails with
`POST_OBSERVED` instead of reading a missing record. The second operation's POST
is read the same way. The wait moves no timing origin: product budgets are still
measured from the page-side dispatch time. Served-chunk identity reads are
settled in each case before its verdict; a mismatch or failed read while the
case is active disqualifies the case, and any control run on it, without
replacing its primary failure.

Twenty-five status cases follow an identical registered submission:
`confirm-after-poll`, `confirm-new-inclusion`, `confirm-index-lag`,
`confirm-unknown-outcome` (deadline measured from dispatch), `confirm-timeout`
(observed 185 seconds after dispatch), `confirm-wrong-body`,
`confirm-same-height-fork` (T1 = T2; the inclusion block is at the tip's height
in another block, so both the relation against T2 and the T1 identity rule
reject it), `confirm-unreconciled-account`,
`confirm-later-other-pool`, `confirm-different-wallet`, `status-cross-tab`,
`status-disconnect`, `status-dispose`, `check-status-after-reload` (a wallet
whose every method throws), `confirm-later-fork` (a later delegation elsewhere
in another block at the inclusion height; only the pairwise check fails),
`confirm-resumed-after-deadline` (the runner's synthetic page clock moves past
dispatch plus 180 seconds after the POST and before status starts; the apology,
record, ID and Check status show with zero status reads), `confirm-then-disconnect`
(Disconnect, then a new Connect, after confirmation), `confirm-then-refresh-failure`
(the page becomes visible after confirmation and the wallet refresh read throws),
`status-visible-refresh` (a visible wallet refresh during an in-flight check;
polling continues to confirmation), `confirm-later-hash-reuse` (a later
delegation elsewhere reports the inclusion block's hash at another transaction
index, 5 slots and 5 heights on; only the pairwise hash rule fails),
`confirm-tip-hash-reuse` (the first status tip read pins T2 at the live tip and
answers T1 two slots below it; the inclusion block reports T2's hash 5 slots and
5 heights lower, with consistent block content and confirmations; only the hash
rule against T2 fails), `confirm-t1-hash-reuse` (the same split tips; the
inclusion block reports T1's hash 5 slots and 5 heights lower; only the T1
identity rule fails), `confirm-later-tip-fork` (the same split tips; a
reconstructed later delegation elsewhere is at T2's height in another block, one
slot below T2 and so above T1, with otherwise coherent content, history and
account view; only the per-event relation against T2 fails),
`confirm-then-other-tab-pending` (after confirmation a second same-origin tab
writes a well-formed pending record for another ID under the origin lock; the
first tab shows that ID with its pending caption and message, hides the
confirmation, and its Check status reads only that ID) and
`confirm-then-second-operation` (A confirms with the account since delegated to
another pool; a new Connect and review keep A confirmed; a deliberate second
operation then signs a separately reviewed body, a literal that equals the
accepted registered vector with only its TTL bytes changed for a fixed
construction tip 300 slots later, and POSTs it; B shows as submitted with its
own caption and never inherits A's confirmation). Each declares one dispatch
and one POST, except `confirm-then-second-operation` (two), and asserts that
status work caused no wallet call and no read outside the status paths, up to
the point where a case deliberately disconnects, reconnects, refreshes or
starts a second operation. The browser test input hides the document after submission so the
wallet owner's visible-only refresh is idle while status work runs, except in
`status-visible-refresh`, where every wallet enable must come from a visible
refresh (the runner's focus event or an instrumented 30-second tick) with its
seven wallet reads and no signature. Every other case answers status reads for
its ID with 404, as it does for the other tab's record and the second operation. The per-run source hashes include `recovery-verifier.ts`.

Five cases cover failure copy and the other-tab removal: `connect-denied` (the
wallet's enable rejects with code -3), `sign-declined` (signTx rejects with code
2), `insufficient-funds` (one 500000-lovelace input, identical in the wallet CBOR
and the provider rows, below fee plus minimum change), `pool-ineligible` (the
retiring-pool list names EASY1 before navigation) and
`confirm-then-other-tab-removed` (after `confirm-then-other-tab-pending`'s
assertions, the second tab removes the other record under the origin lock; the
page keeps that ID, shows the changed guidance, never restores the earlier
confirmation, offers no Check status, heals nothing, and makes no status read or
wallet call). The connect-refusal cases assert their exact text from the
fixture's `connectRefusals` map, and the listed pre-send stops and cancellations
assert exact text and machine reason. `confirm-then-disconnect` also asserts
that Disconnect keeps the confirmed status line, shows the disconnected line and
no cancellation copy, and that the next Connect clears the line.

Every case samples the page at its 360 px viewport on each DOM mutation batch,
in every tab of its browser context and across its navigations and reloads. Each
batch records the status-line text and the rendered phase. The three probes run
only on batches where styles are applied: the document is no longer loading and
every stylesheet link has its sheet. Earlier parse-time batches are counted per
case (`preStyleBatches`) but never probed, because the browser never paints that
unstyled state. Once styles apply, one probe also runs on the next animation
frame, so the first styled state is measured even when no further mutation
follows. The probes are the page (document scroll width beyond its client
width), the elements inside the delegation panel (a right edge beyond the client
width plus 0.5 px, outside any overflow-x auto or scroll container) and the
panel's text nodes (the same bound on `Range` client rects, which sees an
unbroken ID whose element box still fits). A first-paint self-test plants a
400 px element and an unbroken 120-character text node in a 100 px block,
requires the element and text probes to fire, removes both and requires all
three to clear (`LAYOUT_PROBES_RESPOND`). At teardown a case fails
`LAYOUT_SAMPLED` if no styled sample was probed, `LAYOUT_360` if any probed
sample fired, and `STATUS_TEXT_KNOWN` if any sampled status-line text (styled or
not) is outside the fixture's `statusTexts` (every status text the source can
show, transient ones included) and the confirmed-block pattern. The first-paint
`NO_360PX_OVERFLOW` check is kept. The sampler reads the rendered phase from the
panel's React state and never calls the controller.

Only browser test input supplies the visibility simulation. Production lifecycle,
source, timers and guards are unchanged, and isolated context cleanup removes it.
This isolates the deadline test from the legitimate visible-only 30-second wallet
refresh without claiming physical background scheduling or mobile support. Fresh
wallet/source observations and advancing current tips preserve the original body
and TTL. A long wallet-consent neighbor remains valid. Output records source/lock/loaded SDK/crypto hashes,
served chunk/build identities, every external URL/method, synthetic signed-body
identity, actual posts, recovery fields and cleanup. Logs contain only synthetic
public test data. Scripts/fixtures and private evidence remain outside exported
product source under the existing release exporter.

Run the existing chain-context, wallet-signature, wallet-session, stake-builder,
stake-guard and pool-facts suites, the recovery-verifier suite
(`scripts/check-recovery-verifier.cjs`, every outcome, reason code and
resolution refusal), the failure-message suite
(`node scripts/check-delegation-messages.cjs`, 110 tests: every code of every
owned union, parsed from its declaration, maps to its exact text; forged keys
give the fallback; every text is plain and in the flow's `statusTexts`; the
compiled module has no `require`), native signature/coordination suites, installed
security/compatibility checks, build/lint, raw production/full audits and source
export checks. Record actual executed/skipped counts and raw audit responses.
Current registry output is a point-in-time witness; it does not erase the
historical moderate tooling disposition in `tooling-advisories.json`.

The Node suites have no npm script. Their gate command is the direct invocation
from `easy1staking/` with the pinned runtime, `node scripts/check-<suite>.cjs`,
plus `node scripts/check-wallet-signature.cjs --browser` for native signature.
Run `node scripts/check-node-test-gate.cjs` first among the Node gate commands.
It uses plain `node:assert` and an explicit exit code, never node:test. It lists
`scripts/check-*.cjs` and `scripts/lib/*.cjs` (except the helper and itself),
strips comments, and fails any file that requires node:test and takes `after`
from it: destructured (also renamed), as a member of the require, through a
namespace binding, or by an ESM import. It also fails a bare `after(` call that
is not bound from `scripts/lib/node-test-gate.cjs`. A built-in self-test first
requires every planted shape to be flagged and the helper's correct use and a
comment-only line to pass. On success it prints one `NODE_TEST_GATE` line with
the scanned files, the node:test suites and the helper users; each violation
prints a line naming the file and shape, and the exit code is 1. It checks
declarations, not behaviour: an obfuscated or dynamic require is not detected.
Run this way, the Node 24.22.1 test runner prints a failing top-level `after()`
hook as a failing test, yet keeps `fail 0` and exits 0, so the zero-outward and
zero-wallet guards in those hooks could not fail a gate. The five suites with an
`after()` hook (chain-context, wallet-signature, wallet-session, stake-builder
and recovery-verifier) now register it through `scripts/lib/node-test-gate.cjs`.
When the hook throws, an assertion or any other error, the helper sets exit code
1, and rethrows so the runner still reports the failure. The commands, CLI
modes, tests, their names, order and expectations, and the healthy counts are
unchanged; stake-guard and pool-facts have no `after()` hook. Judge a run by its
exit code and its test count, never by the fail counter alone. The
recovery-verifier hook prints its identity line (with `outward` and
`walletAccess`) only after its guard assertions pass, which shows that the guard
ran.

Fail-first evidence for the gate: on the earlier invocation (F0), one
deliberately failing assertion or thrown error at the start of each of the five
hooks, and a recovery-verifier test that makes and swallows a forbidden outward
fetch, each exited 0 with the error printed. With the fail-closed hooks (F1),
every one of those runs exits non-zero, and the healthy suites still exit 0 with
the same counts. Node receipts recorded before this change are preserved and
still record what those runs observed, but they were taken on a gate that a hook
failure could not redden. As gate evidence they are superseded by receipts taken
with the fail-closed hooks.

Required bounded controls target six controller seams: display-approval
identity, authentic total deadline, post-sign source eligibility, retained
lease/intent, duplicate dispatch, and Unknown ID display retention. Seven more
target status confirmation: body binding (`confirm-wrong-body`), historical
point identity against T2 (`confirm-later-tip-fork`), account reconciliation
(`confirm-unreconciled-account`), the three-minute poll budget
(`confirm-timeout`), pairwise historical identity (`confirm-later-fork`), the
resumed-after-deadline apology (`confirm-resumed-after-deadline`) and the
protected confirmed status (`confirm-then-disconnect`). Three more target the
block-hash and active-ID rules: pairwise hash identity
(`confirm-later-hash-reuse`), hash identity against T2
(`confirm-tip-hash-reuse`) and the active ID (`confirm-then-other-tab-pending`,
whose mutant restores the earlier local-ID precedence and same-ID confirmation
gate). One more targets the T1 identity rule (`confirm-t1-hash-reuse`, whose
mutant removes the T1 identity call). Each control has `confirm-after-poll` as
its passing neighbor.

Every control and mutant victim is chosen so that only its own rule can fail.
When T1 = T2, a hash, slot or height contradiction against T2 is also one
against T1, so the T1 identity rule would mask the T2 rules. Those victims use
split tips instead. In the browser, the first status tip read after the POST
pins T2 at the live tip and answers T1 two slots below it (`confirm-tip-hash-reuse`,
`confirm-t1-hash-reuse` and `confirm-later-tip-fork`). In the recovery-verifier
suite, the fixture's `tipAdvance` adds a T2 ten slots above T1 for the inclusion
reporting T2's hash, the four later events checked against T2 (above T2's
height, at T2's slot in another block, at T2's slot in another block at a
height between the tips, and at T2's height in another block between T1 and T2)
and the T1 identity cases. The one at T2's slot between the tips is the only
case that the equal-slot clause alone rejects. An inclusion at T2's height cannot
be split this way: a transaction above T1 is pending (newer than T1), and live
progress puts T2 above T1. So `confirm-same-height-fork` and the suite's
same-height and same-slot inclusion forks keep T1 = T2 and are covered by both
rules, and the control for the relation against T2 uses `confirm-later-tip-fork`.

The recovery-verifier and coordination Node suites also carry mutation evidence
for the per-event historical-point loop, the 16-transaction limit, the later-event
row count, the resolution's lease identity, each of the two hash-identity
clauses (original/later and later/later pairs; inclusion against T2), the
equal-slot clause against T2 (only the later event at T2's slot between the tips
fails without it), and the T1 identity rule: its hash clause (inclusion and later event against T1), its
height clause, its call removed, and its call replaced by the T2 relation
against T1, which would reject a later event included between T1 and T2. The
recovery-verifier suite has 130 tests and the browser flow 81 cases (86 since the
failure-message cases; see the superseding receipt below). The POST
wait has its own harness-only race control. A 1.5-second delay before the route
records the POST makes `confirm-later-tip-fork` fail with a TypeError on the
harness without the wait and pass with it. Suppressing the record runs on
`confirm-after-poll`, which then fails `POST_OBSERVED` first and its exact POST
count second. The split-tip cases (`confirm-tip-hash-reuse`,
`confirm-t1-hash-reuse` and `confirm-later-tip-fork`) cannot host that control:
their route fixture pins T2 at the first tip read after the route has recorded
the POST, so without the record no T2 is pinned and the fixture fails before the
wait can expire. `confirm-after-poll`'s fixture reads no POST record before the
wait.

Recorded evidence for this candidate (superseded for the flow count by the
failure-message receipt at the end of this section): the browser flow passed 81 of 81 cases with
every declared dispatch and POST count, and the recovery-verifier suite 130 of
130 tests. The bounded controls on `confirm-later-tip-fork`, `confirm-later-fork`,
`confirm-later-hash-reuse`, `confirm-tip-hash-reuse` and `confirm-t1-hash-reuse`
each failed their victim first with the retained-record assertion while
`confirm-after-poll` passed, and the full 81-case flow passed after each
restoration. All eleven Node mutants above were killed. Removing the equal-slot
clause against T2 fails exactly one test, "later/T2 equal slot: a later event at
T2's slot between the tips in another block". Controls run
only against a committed candidate, restore exact source/index, rebuild any
served mutant, and rerun the full flow after each restoration. A failure must
show its named forbidden effect; compiler failures and earlier vetoes are
reported separately. A case's first failure is its verdict; later cleanup
failures are recorded separately and never replace it.

Failure-message receipt (supersedes the 81-case flow count above): on the
earlier harness, a non-wrapping transaction-ID `<code>` still passed
`registered`, because the first-paint `NO_360PX_OVERFLOW` check never sees a
state with an ID (F0-L). With the new tests on the earlier source, each new or
changed expectation failed first at its own label: `connect-denied`,
`pool-ineligible`, `wrong-network`, `unsupported-account`, `provider-error` and
the ordinary-build `missing-configuration` at `REFUSAL_COPY`; `sign-declined`,
`insufficient-funds`, `presign-179`, `account-change` and `partial-witness` at
`STOP_COPY`; `cancel-approval` at `CANCEL_OPEN_COPY`; `cancel-review` and
`disconnect-review` at `CANCEL_IDLE_COPY`; `confirm-then-disconnect` at
`DISCONNECT_KEEPS_STATUS` after its kept-caption check passed; and
`confirm-then-other-tab-removed` at `CHANGED_MESSAGE` after the kept-ID check
passed. Sixteen existing cases failed only `STATUS_TEXT_KNOWN`, on the two
retired stop texts. `provider-404`, `contradictory-account`, `already-EASY1`
and every case with unchanged text passed, and no layout probe fired on any
styled sample of the earlier source. One existing case, `status-dispose`, also
failed once in that table (`DISPOSE_RETAINS_RECORD`: its status check finished
before the page navigation took effect) and passed on each of three reruns; it
is a timing race in the case, not a source change, and it is tracked.

The kept-caption check accepts the confirmed text either inside the
confirmation region or as a status line exactly equal to it, because the panel
shows that text once: while the status line already reads the confirmation, the
region does not repeat it. The caption "Transaction ID — confirmed on chain" and
the ID are still required inside the region, and the pending captions are still
forbidden. The three cases that use the check were run again on the earlier
source with this check: `confirm-then-disconnect` still failed first at
`DISCONNECT_KEEPS_STATUS`, and `confirm-then-refresh-failure` and
`confirm-then-second-operation` still passed. On the new source the flow
passes 86 of 86 cases with every declared dispatch and POST count, and the
failure-message suite passes 110 of 110 tests.

Node-test gate receipt: before the meta-check, taking `after` directly from
node:test in `check-stake-builder.cjs` still exited 0 with 89 tests, so no
existing gate noticed the bypass (F0-G). The meta-check passes on this tree with
eight node:test suites (the seven above plus the failure-message suite) and five
helper users (chain-context, recovery-verifier, stake-builder, wallet-session
and wallet-signature).
