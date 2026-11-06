# Staged EASY1 Pool wallet flow

The `/pool` page mounts a private stake-only controller. A visitor explicitly
chooses a CIP-30 wallet, connects, obtains independently reconciled mainnet
observations and builds an inline review. The review shows the stake credential,
fixed EASY1 pool ID, exact fee, separate registration deposit and absolute expiry.
Only its original display object can authorize approval. No voting action is
available. The legacy combined staking/voting helper has been removed.

This is a local candidate. Public activation still requires the remaining
recovery, mobile, operator and release gates. The current page can retain and
show Submitted or Unknown with a known ID; it cannot confirm, clear an unresolved
record or retry. Submitted means that the provider returned the matching ID,
not chain confirmation. Use the originating browser and an independent wallet
or explorer to check an unresolved operation. Do not delete recovery storage to
make a new attempt.

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
`--cases all` now executes 56 cases and `--cases first` executes six.

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
stake-guard and pool-facts suites, native signature/coordination suites, installed
security/compatibility checks, build/lint, raw production/full audits and source
export checks. Record actual executed/skipped counts and raw audit responses.
Current registry output is a point-in-time witness; it does not erase the
historical moderate tooling disposition in `tooling-advisories.json`.

Required bounded controls target six new controller seams: display-approval
identity, authentic total deadline, post-sign source eligibility, retained
lease/intent, duplicate dispatch, and Unknown ID display retention. Controls run
only against a committed candidate, restore exact source/index, rebuild any
served mutant, and rerun the full flow after each restoration. A failure must
show its named forbidden effect; compiler failures and earlier vetoes are
reported separately.
