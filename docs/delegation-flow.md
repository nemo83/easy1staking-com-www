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
`--cases all` now executes 81 cases and `--cases first` executes six. Selectors
are strict: `--case` must name one registered case (the 81 plus
`missing-configuration`) and `--cases` must be `all` or `first`; anything else
exits before a server or browser starts.

Every registered case declares its exact page dispatches and intercepted POSTs
in the fixture: 0 for veto and refusal cases, 1 for single-attempt cases and 2
for `confirm-then-second-operation`. Page
dispatches accumulate across the tab's navigations and reloads; both counts are
asserted on success and recorded on failure. Served-chunk identity reads are
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
resolution refusal), native signature/coordination suites, installed
security/compatibility checks, build/lint, raw production/full audits and source
export checks. Record actual executed/skipped counts and raw audit responses.
Current registry output is a point-in-time witness; it does not erase the
historical moderate tooling disposition in `tooling-advisories.json`.

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
reporting T2's hash, the three later events checked against T2 (above T2's
height, at T2's slot in another block, and at T2's height in another block
between T1 and T2) and the T1 identity cases. An inclusion at T2's height cannot
be split this way: a transaction above T1 is pending (newer than T1), and live
progress puts T2 above T1. So `confirm-same-height-fork` and the suite's
same-height and same-slot inclusion forks keep T1 = T2 and are covered by both
rules, and the control for the relation against T2 uses `confirm-later-tip-fork`.

The recovery-verifier and coordination Node suites also carry mutation evidence
for the per-event historical-point loop, the 16-transaction limit, the later-event
row count, the resolution's lease identity, each of the two hash-identity
clauses (original/later and later/later pairs; inclusion against T2), and the
T1 identity rule: its hash clause (inclusion and later event against T1), its
height clause, its call removed, and its call replaced by the T2 relation
against T1, which would reject a later event included between T1 and T2. Controls run
only against a committed candidate, restore exact source/index, rebuild any
served mutant, and rerun the full flow after each restoration. A failure must
show its named forbidden effect; compiler failures and earlier vetoes are
reported separately. A case's first failure is its verdict; later cleanup
failures are recorded separately and never replace it.
