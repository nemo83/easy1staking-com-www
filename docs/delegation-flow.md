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
confirms the delegation when every check agrees. It never clears an
unconfirmed record on its own: after the transaction has expired, a visitor who
has checked its ID can dismiss the record by hand (see "Expired records and
manual dismissal"). It never resends on its own; after an unknown outcome the tab
that signed can deliberately send the same signed transaction again (see
"Deliberate resend of the same signed transaction"). Submitted means that the
provider returned the
matching ID, not chain confirmation. When the provider's reply to the first
submission matches a narrow form of a ledger validation error, the page says
that Blockfrost reported a validation error; that is a provider report, never
proof, and the ID, the record and the resend are kept exactly as after an
unknown outcome (see "Reported validation errors"). Use the originating browser and an
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
A first-attempt 400 reply is the only non-200 reply whose body this page reads,
and only to choose its words: when Blockfrost words it as a ledger validation
error, that is a provider report, not proof that the transaction was not sent or
included. Through it the derived ID, the recovery record (stage
`unknown`), the retained signed bytes and the deliberate resend are kept exactly
as after an unknown outcome (see "Reported validation errors").

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
provider payloads. Only a confirmed check obtains a single-use confirmed
resolution from the coordinator's one issuer (a deliberate check of an expired,
unseen record may obtain a dismissible one instead; see "Expired records and
manual dismissal"); it binds the exact record, recovery lease,
status generation, observed T2 and a deadline, and it is checked synchronously
immediately before the record is removed. A 404, timeout, provider error,
contradiction or lagged index never removes the record, and there is no
time-based or automatic removal. A confirmation is shown as a historical fact for the
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
submission is never proof that it was not included. A validation error that
Blockfrost reported for the first submission has its own words (see "Reported
validation errors"), but it is never proof either, and it changes no record and
no resend. Pending confirmation keeps its existing texts.

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
offers no Check status, and never shows an earlier confirmation again. An
expired recorded transaction can be dismissed by hand as described in the next
section. Only the tab that signed a transaction can send its identical signed
bytes again, as described in "Deliberate resend of the same signed transaction";
a tab showing another tab's record cannot.

## Reported validation errors

When Blockfrost's reply to this tab's first submission of a transaction matches
a narrow form of a ledger validation error, the page shows that Blockfrost
reported a validation error for the transaction. It is the provider's report
about one handling of one request, never proof that the transaction was not
sent, relayed or included, and nothing else changes.

The form is this page's own local policy, deliberately narrower than the
provider's documented 400 schema, which requires `status_code`, `error` and
`message` and gives 400, "Bad Request" and a sample text only as example values.
The page requires HTTP 400, not redirected, with a JSON content type (optionally
`charset=utf-8`); a body of at most 16384 bytes that decodes as strict UTF-8 and
parses as bounded JSON with exactly the keys `status_code` (the number 400),
`error` ("Bad Request") and `message`; and a message that begins with
`ApplyTxError [` or `ConwayApplyTxError [` followed by a constructor name
(letters only, the first a capital letter), a space and an opening parenthesis,
that ends with the closing `)]`, and that contains none of the words "already",
"duplicate", "mempool" or "BadInputsUTxO" in any letter case. Those words can
mean that the transaction is already known, queued, duplicated or has spent its
own inputs. This is a textual shape check, not a parser: narrative text before
or after the list is refused, but text between two such lists is not, and a
comparison with real Blockfrost replies remains a release check. Everything else
stays unknown with the existing texts: timeouts, network and cross-origin
failures, every other status (403, 418, 425, 429 and 5xx included), malformed,
oversized, duplicate-key or extra-key bodies, narrative text before or after the
list, an ambiguous member anywhere in the list, and every non-200 reply to a
deliberate resend, whose body is not read. The body is read in memory only to
classify it; no part of it is shown, stored or logged.

Only the first attempt is classified, within the existing 60-second reply
deadline, so a slow 400 body ends as a timeout and stays unknown. On the
reported outcome the recovery record is written exactly as for an unknown
outcome (stage `unknown`), the signed bytes are kept, and after the status work
the deliberate resend is offered exactly as after an unknown outcome. The
automatic read-only poll runs as before. A confirmation, a positive sighting and
a spend by the transaction's own ID override the reported text, and so does any
later attempt: once a resend's POST is invoked, the page no longer shows the
report for that ID. The not-found, busy and poll-budget endings of status work
keep the reported text for an ID this page latched, unless that ID was since
seen or spent; every other ending (confirmed, seen but unverified, spent by its
own ID, inconsistent, changed, or a dismissal offer) shows as before.

The record keeps blocking a new delegation until it is confirmed or, after
expiry, dismissed. The next step is to check the status here; after the
transaction expires, the existing check and manual dismissal apply, and a
dismissal is the visitor's override, not proof that the transaction was not
included. The report is held in page memory only: after a reload the generic
pending texts show, and the record is unchanged.

Absent evidence: the bundled provider documentation does not say what text
Blockfrost places in a `/tx/submit` 400 `message`, whether a 400 reply is
readable across origins, or what a 400 implies about acceptance or relay by any
provider backend. If the real wording differs, or the reply is not readable, the
category never appears and the outcome stays unknown. A comparison with real
replies remains a release-gate item.

The status line reads:

"Blockfrost reported a validation error for this transaction. That does not prove it was not sent or included. Keep the ID and check its status here; once it expires and the check allows it, you can choose to dismiss it."

and the transaction ID caption reads "Transaction ID — validation error reported".

## Expired records and manual dismissal

The page never removes an unconfirmed record on its own. After the transaction
has expired and was not found, a visitor who has checked its ID in a wallet or a
chain explorer can dismiss the record in this browser.

Only a deliberate Check status asks for dismissal; the automatic poll never does,
even when it runs past the expiry. A check can offer dismissal only when the
transaction lookup answers not found and the check's first latest block (T1) is
at or past the transaction's TTL, its exclusive `invalidHereafter` slot. Local
time never establishes expiry. In the same bounded session the check then reads
the funding transaction's outputs for every recorded input, in record order, and
the latest block again (T2), which must not have moved back. Each recorded input
must be exactly one non-collateral output at its exact index with an explicit
`consumed_by_tx` field; an absent field or a missing or malformed row gives
`unavailable:INPUT_ROWS` and no offer. Only the recorded index is matched, so an
unrecorded sibling output consumed by this ID is ignored. An eligible check
gives `not-found:EXPIRED_UNSEEN`, shows "This transaction has expired and was
not found on chain when checked. That does not prove it was never included.
After you check its ID in your wallet or a chain explorer, you can dismiss this
record." and offers a "Dismiss this record" button.

A recorded input reported as spent by this same transaction ID means the
transaction may be on chain: the check gives `inconsistent:SPENT_BY_ID`, shows
"This transaction was not found, but one of its inputs is recorded as spent by
this same transaction ID, so it may be on chain. Nothing was cleared. Check it in
your wallet or a chain explorer." and offers nothing. The page remembers that ID
for its lifetime, so a later answer with no spend still shows that text and no
offer. Any check that positively witnessed the transaction (its content read
under the exact ID, or an input consumed by it), including an automatic poll,
latches the ID the same way: a later expired, unseen answer shows "An earlier
chain-data response reported this transaction, but verification is still
unresolved. Nothing was cleared. Check again later, or check it in your wallet
or a chain explorer." and offers nothing. An input spent by a different
transaction keeps the offer and adds "One of its inputs was spent by a different
transaction, so it can no longer be included on the chain as observed.", because
two transactions that spend the same input cannot both be included on the same
chain.

"Dismiss this record" opens the region "Dismiss pending record" with this
disclosure, verbatim:

> Dismiss clears the pending record in this browser. Save the transaction ID for later checks. The transaction may already have confirmed, or it may confirm later after a rollback. A new delegation requires your approval and may incur another fee and a registration deposit.

The region asks: Type "I checked this ID" to confirm that you checked this exact transaction ID in your wallet or a chain explorer. Typing calls nothing in the
page's controller, reads no chain data and takes no browser lock. "Confirm
dismissal" is enabled only for the exact phrase "I checked this ID", with no
trimming or case folding, and an offer allows one attempt. Confirm takes the
recovery lock (if another tab holds it, nothing is read and the record is kept)
and rechecks under that lease. The record is removed only when the recheck is
again expired and unseen and the record read synchronously at removal equals
the record the offer was issued for; both single-use tokens are then consumed and
the removal is read back. A same-ID change of the record, for example its stage,
is therefore refused at Confirm. If the recheck instead confirms the
transaction, the page shows the ordinary confirmation and no dismissed state.
"Keep the record", also while the recheck runs, keeps the record and shows "The
record was kept in this browser. To dismiss it, check status again, or check the
ID in your wallet or a chain explorer."

Every interruption before removal leaves the record: Keep, a reload, leaving the
page, a busy lock, a failed, lagging or rolled-back recheck, or a record that
changed. If another tab removes or replaces the record while an offer is shown,
the offer is withdrawn, the changed guidance is shown and nothing is healed. A
new Check status issues a new offer. No dismissal path enables or calls the
wallet, builds, signs or posts.

After a dismissal the page shows "You dismissed this record after checking the
transaction ID yourself. This page did not confirm it. Keep the ID; a new
delegation needs a new review and your approval." and the region "Dismissed
record" with the caption "Transaction ID — dismissed by you" and the ID. The
caption is kept through Connect and a new review, and the record is never shown
as confirmed. While a record is pending the page says: A prior operation is unresolved in this browser. Keep its ID. This page can check its status and, after it expires, let you dismiss it once you have checked the ID yourself. Only the tab that signed it can send the same transaction again, until that tab reloads or its wallet disconnects or changes.

Nothing new is stored. The two latches and the dismissed state live in page
memory only, so a reload forgets them; the record schema is unchanged. A
dismissed record's transaction can still land (an index lag before expiry, or a
rollback below the TTL), as the disclosure says. A consistent-looking lagged
index with no positive witness can still produce an offer: dismissal is a
manual override, and the visitor's own check of the ID is its safeguard.

## Deliberate resend of the same signed transaction

When the first submission ends with an unknown outcome, the tab that signed it
keeps a private in-memory copy of the exact signed bytes, together with the
review they were checked against. It keeps them only when that unknown outcome
was recorded and the wallet session is unchanged. The bytes are never stored,
logged or shown; only a yes/no offer and a machine ending code reach the view.

The page then offers a button labelled:

Send the same signed transaction again

with the note:

This sends the exact transaction you already approved, with the same ID, once more. Your wallet is not asked to sign again and nothing new is built.

The offer appears only in the signing tab, only after an unknown outcome, only
while no status check, operation or dismissal offer is live, only while the
browser record still names that ID and the wallet session is unchanged, and never
for an ID already seen on chain, spent by its own ID or found expired and unseen
by a deliberate check (see below). Nothing is resent
automatically: no timer, listener or status result starts a resend.

One click runs these steps in order, under the browser's origin lock and against
the exact record this page last wrote:

1. the record must still be exactly the one this page wrote;
2. a status check of the ID: a confirmation is shown and its record removed as
   usual, and any outcome other than "not found" stops the resend;
3. a fresh wallet observation and a fresh account assessment without the
   original review's identities: an account that now delegates to EASY1 stops the
   resend, and any refusal stops it with its own code;
4. a fresh assessment bound to the original review's semantics and eligibility;
   any changed identity stops the resend;
5. at least 120 slots of validity must remain at that fresh tip;
6. the retained signed bytes are verified again (body, ID, witnesses and every
   signature);
7. the existing final barrier, against a fresh 30-second deadline measured from
   this click, checks the record again and compares the bytes and the
   observations once more; then the same bytes are posted once, on the same
   captured transport, with the existing 60-second response deadline.

A reconciled status other than "not found", an account already delegating to
EASY1, too little remaining validity, any changed identity or refused check,
and the 30-second deadline each suppress the POST. Nothing is rebuilt or signed
again, and the resend never writes the browser record: its stage stays
"unknown" before, during and after every resend, because the cross-tab stage
rules do not allow an unknown record to move back. Another tab cannot resend at
the same time: the origin lock gives it "Another delegation operation is active
in this browser.", and a second click while one resend runs does nothing. An
authentic reply shows the submitted text and drops the bytes; any other ending
after the POST keeps them and shows the unknown text, and the read-only status
poll runs as after the first attempt. The resend can be offered again once that
status work ends; each click is a full deliberate resend with its own fresh
deadline.

A resend that stops before posting sends nothing and changes nothing stored. Its
status line says why: "This account now delegates to EASY1, but this transaction
was not confirmed when checked. Nothing was sent again. …", "Too little validity
remains to send this signed transaction again. Nothing was sent again. …", "The
signed transaction was not sent again: a check failed or information changed. …"
or "This transaction's status is not settled, so it was not sent again. …".
Cancel, Disconnect or an account change during a resend keep their own stop
text. The bytes are dropped on reload, Disconnect, any change of the wallet
session, leaving the page, a record removed or replaced in another tab, a
confirmation or dismissal of the ID, a successful resend, an EASY1 or
too-little-validity ending, and a record that changed during the resend. A
status result that latches the ID as seen or spent disables the resend for that
ID; when the resend's own status check latches it, that check also drops the
copy. A dropped copy is never restored. After a reload the record can still be
checked, but it cannot be resent. Whether a provider reply to a resend of an
already-known transaction is a definite rejection is not distinguished: every
non-authentic reply stays unknown. A resend's reply is never classified. A
non-200 reply to a resend, a 400 included, ends unknown at once without its body
being read, and keeps the resend's approved timing; an authentic 200 reply (not
redirected, with a JSON content type) is read, within the same 256-byte bound as
on the first attempt, only to check that it names this transaction ID. A resend
also supersedes an earlier reported validation error: once its POST is invoked,
the page no longer shows that report for the ID.

Once a deliberate Check status, or the recheck at Confirm, finds the ID expired
and unseen, this page no longer offers the resend for that ID, also after Keep,
because such a resend could only end without sending. This is a conservative
page rule, not a proof that the transaction can never be included. The latch is
kept per transaction ID, in page memory only, for the page's lifetime: a later
check that no longer finds the expiry (for example after a rollback) does not
clear it, and a reload forgets it together with the bytes. The automatic poll
and the resend's own status check never set it. Until a deliberate check
observes the expiry, the offer can remain after the transaction's validity has
run out, and a click then ends with the too-little-validity text and nothing
sent. While a background wallet refresh is in progress the offer is hidden; it
returns once the same wallet is observed again, and a changed wallet drops the
copy.

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
`--cases all` now executes 146 cases (139 before the gate-hardening cases, 128
before the reported-validation-error cases, 105 before the deliberate-resend cases,
86 before the manual-dismissal cases and 81 before the failure-message cases
were added) and `--cases first` executes
six. Selectors
are strict: `--case` must name one registered case (the 146 plus
`missing-configuration`) and `--cases` must be `all` or `first`; anything else
exits before a server or browser starts.

The eleven reported-validation-error cases answer the first POST with a
synthetic 400 whose canary must never be shown: `submit-400-bad-inputs` (a
ledger list carrying `BadInputsUTxO`), `submit-400-not-ledger` (the provider's
generic wording) and `submit-400-oversized` (the ledger body one byte over 16384)
stay unknown; `reported-ledger` (resumed past the poll budget) shows the report,
its caption, the resend offer, the record at stage `unknown`, no status reads and
no new delegation, keeps the report through a deliberate check
(`not-found:NOT_FOUND`) with the record unchanged, and through Disconnect;
`reported-then-confirmed` shows the report before the confirmation;
`reported-poll-budget` keeps it while the automatic poll runs and after its
budget ends, then offers the resend; `dismiss-after-report` dismisses the
expired record by hand; `dismiss-reported-seen-then-404` drops the report once
the ID is seen and keeps it dropped after a later 404;
`dismiss-reported-spent-by-id` drops it on a spend by the ID and keeps it
dropped when a later check is busy; `retry-after-report` drops it when the
resend is sent; and `retry-reported-held-body` answers the resend with a 400
whose body never arrives and requires an unknown ending at once, no body read,
no held lock and no report. Every case of the submit branch also requires that
no report is shown (`NOT_REPORTED`).

Every registered case declares its exact page dispatches and intercepted POSTs
in the fixture: 0 for veto and refusal cases, 1 for single-attempt cases, 2
for `confirm-then-second-operation` and each resend case that sends again, and
3 for `retry-again-after-unknown`. Page
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
its ID with 404, as it does for the other tab's record and the second operation. The per-run source hashes include `recovery-verifier.ts`, the submit-reply classifier (`submit-reply.ts`) and the panel (`DelegatePanel.tsx`).

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

Eighteen `dismiss-*` cases cover manual dismissal. Each makes the identical
registered submission, moves the page clock 181 seconds on at the POST (so
status work shows the apology with no reads; `dismiss-poll-after-expiry`
instead moves to TTL minus 130 slots inside signTx and to TTL plus 2 seconds at
the POST), hides the document, serves the funding outputs with an own
`consumed_by_tx` key after the POST (`dismiss-missing-rows` keeps the earlier
shape), sets the page clock and tips, clicks Check status and asserts the exact
`statusReason` first. Each also asserts no wallet call since its baseline, no
building, review, signing, checking or submitting phase, one POST and one
dispatch, and no read outside the status paths. The cases are
`dismiss-expired` (the full dismissal at TTL+5: disclosure, phrase, Confirm,
removal, two eligibility row reads, a copyable dismissed ID, nothing new stored,
then a reconnect whose new review is never approved), `dismiss-at-ttl` (a tip
pinned at the TTL offers), `dismiss-before-expiry` (a fresh tip at TTL−1 with
the local clock past the TTL's wall time does not, with no row read),
`dismiss-spent-by-id`, `dismiss-spent-elsewhere` (then a reconnect gives
`source:INPUT`), `dismiss-missing-rows`, `dismiss-then-already-easy1`,
`dismiss-cancel` (typing reads nothing and holds no lock; Keep before and during
a held recheck, after which the recheck makes no further provider read),
`dismiss-without-attestation` (an empty and a case-folded
phrase through the controller remove nothing), `dismiss-double-confirm` (one
recheck), `dismiss-reload`, `dismiss-busy`, `dismiss-dispose`,
`dismiss-stale-record` (a same-ID stage rewrite in another tab is refused at
Confirm; a later removal withdraws the new offer), `dismiss-rollback-on-confirm`
(T2 three slots below T1 gives `unavailable:TIP`), `dismiss-confirmed-on-confirm`
(the recheck finds an inclusion at TTL−10 and shows the ordinary confirmation),
`dismiss-seen-then-404` (an index-lag witness latches the ID) and
`dismiss-poll-after-expiry` (the automatic poll past the TTL makes no offer and
no row read; the deliberate check then does). `confirm-resumed-after-deadline`
also asserts that no dismissal is offered. A full run is one attempt, with no
re-run: `status-dispose` and `dismiss-dispose` are deterministic, as described
after the sampler below.

Twenty-three `retry-*` cases cover the deliberate resend. Each makes the
identical registered submission and moves the page clock 181 seconds on at the
first POST, which answers 500, so the page shows the unknown outcome and then
the apology with no status reads. It hides the document, takes the wallet
baseline, asserts one offer button with the exact note, and captures the record
and the storage keys. At its end each case asserts one signature request, no
building, review or signing phase after the first POST, the record unchanged
(unless the case removes it), nothing new stored, every POST body equal to the
first, and its exact dispatches and POSTs. After a click it asserts the view's
machine `retryReason` first, then its failure and status reasons where named,
then the exact status line. The cases are `retry-same-bytes` (no POST before the
click; one held origin lock at the second POST; the status lookup precedes the
account read; Submitted, then no offer), `retry-double-click` (two synchronous
calls make one status lookup), `retry-busy` (another tab holds the lock: no
reads, then offered again), `retry-record-changed` (another tab removes the
record during a held read: the changed guidance, nothing healed),
`retry-already-easy1` (no POST and no already-delegated acknowledgement),
`retry-confirmed-first` (the resend's own status check confirms),
`retry-seen-pending` (a lagging index latches the ID), `retry-parameters-change`
(`source:COHERENCE`), `retry-pool-retiring` (`source:INELIGIBLE`),
`retry-presubmit-120` (a tip leaving exactly 120 slots sends),
`retry-presubmit-119` (119 slots: too little validity), `retry-wallclock-119`
(the tip leaves 121 slots but the clock leaves 119: the final barrier stops with
`stop:expired`), `retry-barrier-timeout` (five reads held eight seconds each:
`stop:expired` with no POST, at least 30 seconds after the click; a second click
without holds then sends), `retry-post-timeout` (a held second POST ends unknown;
no automatic POST and no offer while the poll runs), `retry-reload`,
`retry-disconnect`, `retry-account-change` (no offer afterwards, and a call
through the controller does nothing), `retry-dispose` (leaving the page during a
held read sends nothing), `retry-inflight-disconnect`,
`retry-inflight-account-change` and `retry-inflight-cancel` (an invalidation
while a fresh assessment or verification is suspended sends nothing and keeps the
record), `retry-post-unknown-disconnect` (Disconnect during a held resend POST
ends unknown, with no offer afterwards) and `retry-again-after-unknown` (after an
unknown resend and its status work, a second resend posts bytes identical to
both earlier POSTs). `submit-bad-status` also asserts no offer while its poll
runs, and `confirm-resumed-after-deadline` no offer after Submitted.

Seven cases were added with the gate hardening, each with one dispatch and one
POST. `confirm-then-unrelated-storage`: after confirmation another tab sets and
removes an unrelated storage key, and the confirmed result and its status line
stay. `status-same-id-storage`: during the automatic poll another tab moves this
page's own record from submitted to unknown under the same ID, and the page
keeps its own ID and pending record and shows no other-tab message.
`confirm-then-review-other-tab`: after confirmation a new Connect and review
start, another tab writes a pending record for a different ID while the review
is open, and the review stays with no other-tab message; Cancel then sends
nothing. Its zero-wallet-call check applies up to the confirmation, and after it
the deliberate reconnect and build call the wallet without a signature
request. `dismiss-recheck-withdraws`: Check status while a dismissal offer is
shown withdraws the offer before the check, which then finds a spend by the ID
and offers nothing. `dismiss-cross-id`: a deliberate check confirms one ID,
another tab then writes a pending record for a second ID with the same TTL, and
a deliberate check of that ID finds it expired and unseen and offers its
dismissal, because the witness latch is per ID. `dismiss-keep-hides-retry`: the
first POST answers 500, the resend is offered after the apology, a deliberate
check past the TTL finds the ID expired and unseen, and after Keep the resend is
no longer offered. `retry-refresh-hold`: while a background wallet refresh holds
the wallet's enable call, the resend offer is hidden, and it returns once the
same wallet is observed again.

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
panel's committed React fiber and never calls the controller. At teardown a case
also fails `PHASE_LABEL_MATCHES_DOM` if a sampled phase disagrees with the DOM: a
busy phase must show the Cancel control and any other phase must not, and only
the review phase shows the review region.

The two disposal cases are deterministic. `status-dispose` answers its found
lookup only after an explicit check that the panel has unmounted; if that check
fails, the lookup is aborted and the case fails at `FOUND_ANSWERED_AFTER_DETACH`
before any product label. `dismiss-dispose` releases its held row read only
after the panel has unmounted; its 20-second watchdog never answers the read, so
a hold that times out fails the case at `HELD_ROWS_RELEASED_AFTER_DETACH`. Each
case with a pinned stop text records the stored recovery record before its first
assertion, so a failing run still shows what was stored.

Limits of the browser evidence. The resend cases also check the sequence of
views that the controller emitted, recorded through a test-only subscription.
Those checks show what the controller presented to the panel, not that the
browser painted every intermediate state; the 360 px sampler sees only states
that reached the DOM. Cases that move the page clock 181 seconds on at the POST,
the `dismiss-*` and `retry-*` templates among them, compress the status poll:
they show how it ends, not its full duration, which `confirm-timeout` observes in
real time 185 seconds after dispatch.

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
(`node scripts/check-delegation-messages.cjs`, 125 tests, 122 before the
reported-validation-error copy and 119 before the resend copy: the failure kinds
are read from the `FailureKind` union in messages.ts, and every code of every
owned union, parsed from its declaration, maps to its exact text, including the
manual-dismissal `recovery` texts; forged keys give the fallback; every text is
plain and in the flow's `statusTexts`; the dismissal copy has exactly its keys
and texts and is plain; the resend copy has exactly its keys and texts, is
plain, ends every entry except the offer with a period, and its six status-line
texts are in `statusTexts`; the reported-validation-error copy has exactly its
keys and texts, is plain, ends its status line with a period and has that line
in `statusTexts`; the compiled module has no `require`), the submit-reply suite
(`node scripts/check-submit-reply.cjs`, 27 tests, 26 before the constructor test:
the narrow form is classified, including its byte limit exactly, and every near
miss of status, redirect, content type, encoding, JSON, keys, field values,
message form (a constructor starting with a lower-case letter included) or
ambiguous wording is not; only the classifier and the JSON parser are loaded), native signature/coordination suites, installed
security/compatibility checks, build/lint, raw production/full audits and source
export checks. Record actual executed/skipped counts and raw audit responses.
Current registry output is a point-in-time witness; it does not erase the
historical moderate tooling disposition in `tooling-advisories.json`.

The Node suites have no npm script. Their gate command is the direct invocation
from `easy1staking/` with the pinned runtime, `node scripts/check-<suite>.cjs`,
plus `node scripts/check-wallet-signature.cjs --browser --playwright <dir> --chromium <file>`
for native signature, where both tool paths are absolute and have no default.
Run `node scripts/check-node-test-gate.cjs` first among the Node gate commands.
It uses plain `node:assert` and an explicit exit code, never node:test. It lists
`scripts/check-*.cjs` and `scripts/lib/*.cjs` (except the helper and itself),
strips comments, and fails any file that requires node:test and takes `after`
from it: destructured (also renamed), as a member of the require, through a
namespace binding, or by an ESM import. It also fails `.after`, `?.after` or
`["after"]` on a binding of node:test's `test` or `it` export (destructured,
renamed, defaulted, imported, or destructured from a namespace), and a bare
`after(` call that is not bound from `scripts/lib/node-test-gate.cjs`. It reads
binding lists as text: a default value is cut at its first `=`, one level of
nested braces is tolerated, each list is also read flat, and a node:test require
may be wrapped in parentheses. A built-in self-test first requires every planted
shape (46) to be flagged and every clean control (7), among them the helper's
correct use and a comment-only line, to pass. It then runs real temporary suites
under the running Node (`HELPER_RESPONDS`): through the helper a failing hook
exits non-zero, hook options are refused, and neither an exit listener
registered later nor a hook that never settles lets the run exit 0, while
healthy synchronous and asynchronous hooks exit 0. It also records, without
asserting, how a failing hook registered through node:test's `test.after`
without the helper ends (`ALIAS_WITNESS`); on Node 24.22.1 that run exits 0. On
success it prints one `NODE_TEST_GATE` line with the scanned files, the
node:test suites and the helper users; each violation prints a line naming the
file and shape, and the exit code is 1. It checks declarations, not behaviour,
and it is a textual guard, not a parser. Known undetected forms include
obfuscated, dynamic or computed requires, `import()`, `module.require`, a
require bound inside a sequence, conditional or logical expression, chained
members such as `require("node:test").test.after`, a namespace held in an array
or object, a namespace named outside ASCII, braces inside string literals in a
binding list, and a hook destructured under another name from a `test` or `it`
binding in a separate statement. Some of these still fail the gate by another
rule (a member taken directly on such a require, or a bare `after(` call), and a
name bound from `(require("node:test"), other)` is read as a namespace although
it holds the other value, which fails closed.
Run this way, the Node 24.22.1 test runner prints a failing top-level `after()`
hook as a failing test, yet keeps `fail 0` and exits 0, so the zero-outward and
zero-wallet guards in those hooks could not fail a gate. The five suites with an
`after()` hook (chain-context, wallet-signature, wallet-session, stake-builder
and recovery-verifier) now register it through `scripts/lib/node-test-gate.cjs`.
When the hook throws, an assertion or any other error, the helper sets exit code
1, and rethrows so the runner still reports the failure. The helper takes exactly
one hook function and refuses hook options, and at process exit it ends a run
whose helper hook failed or never settled with code 1, from inside an exit
listener, so an exit listener registered later cannot reset it. The commands, CLI
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
failure-message suite passes 110 of 110 tests. (These counts are superseded by
the manual-dismissal receipt below.)

Node-test gate receipt: before the meta-check, taking `after` directly from
node:test in `check-stake-builder.cjs` still exited 0 with 89 tests, so no
existing gate noticed the bypass (F0-G). The meta-check passes on this tree with
eight node:test suites (the seven above plus the failure-message suite) and five
helper users (chain-context, recovery-verifier, stake-builder, wallet-session
and wallet-signature).

Expiry-copy receipt: with the expiry latch removed from the post-reply timer,
the earlier harness still passed `post-reply-deadline` and
`post-reply-deadline-hidden`, because it did not pin the stop text (F0-E). The
exact expiry copy and machine reason now fail both at `STOP_COPY` (F1-E), and
removing either expiry latch (the post-reply timer or the final-barrier
`expire()`) is killed by the browser flow.

Manual-dismissal receipt (supersedes the 86-case flow count, the 130-test
recovery-verifier count and the 110-test failure-message count above): the
recovery-verifier suite has 182 tests covering the eligibility reads, the
`SPENT_BY_ID` and `INPUT_ROWS` outcomes, the positive-witness signal and every
dismissal-authority clause, each pinned by a mutant that its own test kills.
With the new browser and message tests on the earlier source, every new
`dismiss-*` case except `dismiss-before-expiry` failed first at
`DISMISS_STATUS_REASON` (`not-found:NOT_FOUND`, because the earlier page never
asks for dismissal); `dismiss-poll-after-expiry` passed its poll assertions and
`dismiss-seen-then-404` its first check before failing there.
`dismiss-before-expiry` and `confirm-resumed-after-deadline` passed. The message
suite failed 11 of 119 tests: the seven `recovery` tests, the two dismissal-copy
tests and the two whole-set tests. Its kind-list test compares two lists inside
the test file and so passes on either source (superseded: the test now reads the
`FailureKind` union in messages.ts). On the new source the flow passes
105 of 105 cases with every declared dispatch and POST count and no layout or
unknown-status failure, the failure-message suite passes 119 of 119 tests, the
recovery-verifier suite 182 of 182, and the meta-check finds eight node:test
suites and five helper users. Each of these mutants was killed, its source was
restored exactly, and the full flow then passed 105 of 105 again: DB1 (the eligibility guard made strict) killed: `dismiss-at-ttl` failed first at `DISMISS_STATUS_REASON` while `dismiss-expired` passed; DB1W (the guard admitting TTL−1) killed: `dismiss-before-expiry` failed first at `DISMISS_STATUS_REASON` while `dismiss-at-ttl` passed; DB2 (a spend by the recovery ID treated as spent elsewhere) killed: `dismiss-spent-by-id` failed first at `DISMISS_STATUS_REASON` while `dismiss-spent-elsewhere` passed; DB3 (the attestation equality removed) killed: `dismiss-without-attestation` failed first at `RECORD_RETAINED_WITHOUT_ATTESTATION` while `dismiss-expired` passed; DB4 (the authority's record equality removed) killed: `dismiss-stale-record` failed first at `RECORD_RETAINED_AFTER_CHANGE` while `dismiss-expired` passed; DB5 (the confirm recheck's confirmed branch removed) killed: `dismiss-confirmed-on-confirm` failed first at `CONFIRMED_RECORD_REMOVED` while `dismiss-expired` passed; DB6 (the witness latch removed) killed: `dismiss-seen-then-404` failed first at `DISMISS_STATUS_TEXT` while `dismiss-expired` passed.

Deliberate-resend receipt (supersedes the 105-case flow count and the 119-test
failure-message count above): with the new browser and message tests on the
earlier source, all 23 `retry-*` cases failed first at `RETRY_OFFERED` (the
earlier panel has no resend control), `dismiss-at-ttl` failed first at
`PRIOR_NOTICE_COPY` (the earlier notice), and `submit-bad-status` and
`confirm-resumed-after-deadline` passed. The message suite failed 4 of 122
tests: the dismissal-copy literal test and the three resend-copy tests. On the
new source the flow passes 128 of 128 cases with every declared dispatch and
POST count and no layout or unknown-status failure, the failure-message suite
passes 122 of 122 tests, and the meta-check still finds eight node:test suites
and five helper users. With the offer button as first written, its label kept
the button style's no-wrap rule and overflowed the 360 px viewport by about 14
px (`LAYOUT_360`), so the new button alone also wraps its text; no existing
element or stylesheet changed. Each controller mutant below was run on the
committed source over every `retry-*` case, one case at a time, and its source
was then restored exactly: RM1 (every non-confirmed status admitted) killed:
`retry-seen-pending` failed first at `RETRY_REASON`; RM2 (the confirmed branch
removed) killed: `retry-confirmed-first` at `CONFIRMED_RECORD_REMOVED`; RM3 (the
EASY1 branch removed) killed: `retry-already-easy1` at `RETRY_REASON`; RM4 (the
120-slot check made 119) killed: `retry-presubmit-119` at `RETRY_REASON`, where
the guard's own validity refusal gave a stop instead of the too-little-validity
ending; RM4S (made 121) killed: `retry-presubmit-120` at `RETRY_REASON`; RM5 (the
deadline from the click made 45 seconds) killed: `retry-barrier-timeout` failed
at `RETRY_REASON` with a resend POST recorded about 40 seconds after the click,
and the barrier's unchanged lower bound (deadline minus 30 seconds) also stopped
the fast `retry-same-bytes`, `retry-double-click`, `retry-presubmit-120`,
`retry-post-timeout` and `retry-again-after-unknown` with `stop:expired` and
held `retry-post-unknown-disconnect` short of its resend POST; RM6 (the resend's
final barrier skipped) killed: `retry-wallclock-119` at `RETRY_REASON`; RM8 (a
successful resend keeps the bytes) killed: `retry-same-bytes` at
`NO_RETRY_AFTER_SENT`; RM9 (an unknown resend restores the dropped copy, with
the offer's wallet-session clause removed) killed:
`retry-post-unknown-disconnect` at `NO_RETRY_RESURRECTION`; RM9N (only that
wallet-session clause removed) failed no case, because every wallet-session
change already drops the copy, which is why RM9 removes both; RM10 (the
operation check after the re-verification removed) killed:
`retry-inflight-account-change`, `retry-inflight-disconnect` and
`retry-inflight-cancel` at `RETRY_TEXT`, each sending nothing but losing its own
stop text. RM7 (the offer's status-work clause removed), run over the whole flow, killed: `submit-bad-status` and `retry-post-timeout` failed first at `NO_RETRY_OFFER_DURING_POLL`, and no other case failed. After the last restore the full flow passed 128 of 128 again.

Dependency residue (superseded by the dependency repair below): `npm audit` (production and full) still reports nine
moderate entries, all GHSA-chp3-j5qr-2vfr (`@effect/platform` below 0.97.1 via
`@evolution-sdk/evolution`), with the lockfile unchanged. It is a release-gate
dependency item, not a manual-dismissal result.

Dependency repair (supersedes the residue above): with `@evolution-sdk/evolution`
0.5.14 the vulnerable `@effect/platform` package is no longer installed, and
`npm audit --omit=dev --json` and `npm audit --json` both exit 0 with zero
findings on this tree.

Reported-validation-error receipt (supersedes the 128-case flow count, the
122-test failure-message count and the eight-suite meta-check count above): with
the new browser, message and submit-reply tests on the earlier source, the
submit-reply suite failed 26 of 26 tests, each on the missing classifier module;
the message suite failed 3 of 125 tests, the three reported-copy tests; and of
19 browser cases run one at a time, `reported-ledger`, `dismiss-after-report`,
`dismiss-reported-seen-then-404` and `dismiss-reported-spent-by-id` failed first
at `REPORTED_TEXT`, `reported-then-confirmed` at `REPORTED_THEN_CONFIRMED`,
`reported-poll-budget` at `REPORTED_DURING_POLL` and `retry-after-report` at
`COMMON_REPORTED`, while the three `submit-400-*` cases,
`retry-reported-held-body` (the earlier resend already ended unknown without
reading the body) and the eight submit-branch cases with the new `NOT_REPORTED`
assertion passed. On the new source the flow passes 139 of 139 cases with every
declared dispatch and POST count and no layout or unknown-status failure, the
failure-message suite passes 125 of 125 tests, the submit-reply suite 26 of 26,
and the meta-check finds nine node:test suites and five helper users. Each
classifier mutant was killed by exactly its named tests, and its source was then
restored exactly: N1 (status check removed) by the other-status test; N2
(redirect check removed) by the redirected test; N3 (content-type check
removed) by the content-type test; N4a (limit made exclusive) by the
exact-limit test; N4b (length check removed) by the one-byte-over test; N5
(UTF-8 made non-fatal) by the malformed UTF-8 test; N6 (the older form
refused) by the older-form test; N7 (exact keys not required) by the extra-key
test; N8 (status_code check removed) by the status-code test; N9 (error check
removed) by the error-text test; N10 (string check removed) by the non-string
message test; N11 (ledger form not required) by the non-ledger and narrative
tests; N12 (`BadInputsUTxO` no longer ambiguous) by the spent-input and mixed
list tests; N13 (`already`) by the already-known test; N14 (`duplicate`) by the
duplicate test; N15 (`mempool`) by the mempool and mixed list tests; N16 (case
sensitive) by the spent-input, already-known, mempool and mixed list tests;
N17 (leading anchor removed) and N18 (trailing anchor removed) by the narrative
test. Each controller and panel mutant was built and run over its crossing set,
one case at a time, and its source was then restored exactly; every other case
of the set passed: BM1 (the resumed budget ending shows the apology) killed:
`reported-ledger`, `dismiss-after-report`, `dismiss-reported-seen-then-404` and
`dismiss-reported-spent-by-id` at `REPORTED_TEXT` and `retry-after-report` at
`COMMON_REPORTED`; BM2 (the status-work ending shows the apology) killed:
`reported-ledger` at `REPORTED_AFTER_CHECK` and `reported-poll-budget` at
`REPORTED_AFTER_POLL_BUDGET`; BM3 (the caption choice removed) killed:
`reported-ledger` at `REPORTED_CAPTION`; BM-W (the seen veto removed) killed:
`dismiss-reported-seen-then-404` at `REPORT_GONE_ON_SEEN`, while `reported-ledger`
and `dismiss-reported-spent-by-id` passed; BM-S (the spent veto removed) failed
no case and is equivalent by construction, because every result that finds an
input spent by the transaction's own ID also marks the ID as seen, so the seen
veto always holds as well; BM-WS (both vetoes removed) killed:
`dismiss-reported-seen-then-404` at `REPORT_GONE_ON_SEEN` and
`dismiss-reported-spent-by-id` at `NO_REPORT_AFTER_SPENT`; BM-R (classification
enabled on the resend) killed: `retry-reported-held-body` at
`RETRY_400_NO_BODY_READ`; BM-L (a later attempt keeps the report) killed:
`retry-after-report` at `REPORT_SUPERSEDED_BY_RESEND`.

Gate-hardening receipt (supersedes the 139-case flow count, the 26-test
submit-reply count and the 182-test recovery-verifier count above). Node-test
gate: on the earlier meta-check, a temporary suite that took `test` from
node:test and registered a failing hook through `test.after` passed the
meta-check, and the suite itself exited 0 with its one test passing. The
hardened meta-check flags it as `alias test.after` and exits 1. With the earlier
helper, the hook-options, later-exit-listener and never-settling witnesses
failed; with the hardened helper all six witnesses behave as described above.
Each of the following mutants was killed, and its source was then restored
exactly: the option refusal removed, by the hook-options witness; the exit
listener's `process.exit(1)` replaced by an exit code, by the
later-exit-listener witness; the never-settled clause removed, by the
never-settling witness; the pending count never decremented, by the two healthy
witnesses; the alias check removed, by the `test.after` planted shape; and
`?.after` removed from the member pattern, by the `nt?.after` planted shape.
Twenty-four further detector mutants, covering the later reading rules
(defaulted, nested and `default as` bindings, the brace-aware list pattern, the
flat second reading of each list and parenthesised requires), each made the
meta-check fail. The meta-check now flags 46 planted shapes, passes 7 clean
controls, scans 19 files and finds nine node:test suites and five helper users.

Suite pins: four source mutants each passed the earlier suites and fail a new or
changed test, and each source was then restored exactly. An extra failure kind
added to messages.ts fails the kind test, which now reads the `FailureKind`
union from messages.ts (the failure-message suite stays at 125 tests). A
recovery verifier that stops reading the remaining inputs after a second
unusable one fails the new three-input test, in which two unusable inputs
precede one spent by the recovery ID and every input must still be read (the
recovery-verifier suite now has 183 tests). A classifier that admits a
constructor starting with a lower-case letter fails the new constructor test
(the submit-reply suite now has 27 tests). Removing the site's `addr1` prefix
check changes the refusal code for an `addr_test` provider address, which the
new mismatched-address test detects (the chain-context suite now has 183
tests).

Disposal ordering and the sampler: on the earlier harness, delaying the home
navigation (2 seconds in `status-dispose`, 4 seconds in `dismiss-dispose`) made
the two cases fail at `DISPOSE_RETAINS_RECORD` and
`DISMISS_DISPOSE_RETAINS_RECORD` respectively; with the new ordering the same
delays pass. Reading the phase the earlier way, with the new DOM check in place,
fails `registered`, `unregistered`, `cancel-review`, `double-approval` and
`long-consent` at `PHASE_LABEL_MATCHES_DOM` and at no other label. On the
healthy run of 139 cases the earlier reading lagged the committed phase on 735
samples across 138 cases, and no sample disagreed with the DOM. A control that
keeps the panel mounted fails `status-dispose` at `FOUND_ANSWERED_AFTER_DETACH`
with no found answer served and no confirmation read; a control that moves
detachment past the 20-second watchdog fails `dismiss-dispose` at
`HELD_ROWS_RELEASED_AFTER_DETACH` with no held rows served and the record kept.
These two aborts have no assertion of their own: their effect is shown only by
those recorded fields, because a run that reaches either outcome fails anyway. A
control in which the watchdog itself releases the rows fails at the ordering
check, but its release comes about 20 seconds after the hold began, after the
product's 10-second read timeout has already ended that read, so it shows only
that the ordering check refuses a release before detachment. The consequence is
shown by a control that releases the rows just before the home click while the
panel is still present: the page then removes the record and shows the dismissed
text, and the ordering check fails it. With either expiry latch removed, the
affected cases fail at `STOP_COPY` and now record the stored record, which
matches the healthy run's apart from its creation time. With the final barrier's
wall-clock clause disabled, `final-barrier-expiry` makes a forbidden POST to the
intercepted route; with its tip clause disabled the case still passes, so the
wall-clock clause is the one that stops it.

Storage events, offer withdrawal, Keep and per-ID witness latches: the five new
cases and the `dismiss-cancel` additions pass on the earlier source, and each of
six controller mutants that the earlier cases did not detect is killed by a new
case or check: the changed-record guidance made to ignore the other-tab phase,
by `confirm-then-unrelated-storage` at `UNRELATED_STORAGE_KEEPS_RESULT`; the
other-tab message made to ignore the ID, by `status-same-id-storage` at
`SAME_ID_NO_OTHER_PENDING`; the other-tab message made to ignore an open
operation, by `confirm-then-review-other-tab` at
`NO_OTHER_PENDING_DURING_REVIEW`; Check status no longer withdrawing a shown
dismissal offer, by `dismiss-recheck-withdraws` at
`NO_DISMISS_OFFER_AFTER_RECHECK`; Keep no longer aborting the recheck, by
`dismiss-cancel` at `NO_READS_AFTER_KEEP` (and `dismiss-dispose` at
`NO_READS_AFTER_DISPOSE`); and the witness latch made global, by
`dismiss-cross-id` at `CROSS_ID_OFFERED`. Removing
`confirm-then-review-other-tab` from the cutoff-aware wallet check makes it fail
at `STATUS_ZERO_WALLET_CALLS` after its body completed. The flow then passed 144
of 144 cases.

Expiry latch and refresh hold: on the earlier controller,
`dismiss-keep-hides-retry` failed first at `NO_RETRY_AFTER_EXPIRY`, because
after Keep the resend was offered again, while `retry-refresh-hold`,
`retry-account-change` and `dismiss-cancel` passed. With the latch both new
cases pass. Mutants that remove the expiry check from the offer, or never set
the latch, are killed by `dismiss-keep-hides-retry` at `NO_RETRY_AFTER_EXPIRY`.
A mutant that removes the offer's observed-wallet clause still passes
`retry-account-change`, `retry-disconnect` and `retry-same-bytes` on the earlier
harness, because a changed wallet drops the copy first, and is killed by
`retry-refresh-hold` at `NO_RETRY_DURING_REFRESH`. The refresh hold stayed well
under the case's 8-second bound (about half a second). In each of these mutant
runs the other nine resend and dismissal cases of its set passed. No case yet
shows that the expiry latch for one ID leaves another ID's resend offered: with
the latch made global, so that one expiry would block every resend, those ten
cases still pass. The per-ID scope therefore rests on review of the code, and
that mutant fails toward withholding the resend, never toward sending. On this
source the flow passes 146 of 146 cases in one attempt; the Node suites pass at
chain-context 183, wallet-signature 106, wallet-session 143, stake-builder 89,
stake-guard 206, pool-facts 10, recovery-verifier 183, failure-message 125 and
submit-reply 27 tests; the native signature campaign runs 938 assertions; and
the native coordination suite runs 101 Node checks and 48 Chromium scenarios.
