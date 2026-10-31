# Pure stake transaction builder

`easy1staking/src/lib/site/delegation/builder.ts` exports `buildStakeTransaction(context)`.
It consumes a `GuardContext`, constructs an actual Evolution SDK 0.5.9 unsigned
transaction, and returns frozen `{ unsignedHex, review }` only after the independent
[stake guard](stake-guard.md) issues the review. The unsigned wrapper contains the
exact reviewed body, an empty witness map, `isValid: true`, and null auxiliary data.
The opaque review is recognized by the actual guard's pre-sign and final checks;
copying or deserializing it does not create an issued review.

This module is dormant. It acquires no wallet/provider observations and performs no
network, wallet, signing, submission, storage or telemetry operation. Context types
do not authenticate chain state. A later controller must obtain and reconcile fresh
complete observations, verify current EASY1 eligibility, and enforce all account,
approval, recovery, locking and submission requirements before activation.

## Construction and supported limits

The target is fixed EASY1 hash
`20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9` on explicit mainnet ID 1.
Every balancing candidate includes that network ID before serialization. Registered
stake uses certificate tag 2; unregistered stake uses tag 11 with the validated
current deposit. Validity ends at the construction tip plus 600 slots. There are no
caller target, fee-limit, network or validity overrides. An already-EASY1 observation
raises `ALREADY_DELEGATED` without creating new bytes. That observation still needs
authentication by the future controller.

Selection prefers corroborated ADA-only inputs, then mixed-asset inputs, with larger
ADA first and stable transaction-reference ties. Each selected reference is unique,
belongs to the complete wallet snapshot, matches the provider's full contents and
explicit unspent status, and has an explicitly absent reference script. Known
reference-script outputs remain protected. Missing/mismatched corroboration raises
`CORROBORATION`; it is never treated as zero funds. Correlated datum-bearing inputs
are supported. Inputs and change use the guard's ordinary 57-byte mainnet
payment-key/stake-key base-address format; enterprise, pointer and script-controlled
addresses are unsupported. Only the exact full fresh change address receives outputs.

The builder emits **one complete change output** and preserves all selected ADA and
every native asset using BigInt. It does not support arbitrary payments,
consolidation, or splitting a large token bundle across outputs. Oversized single
change values raise `SINGLE_CHANGE`; insufficient supported funding for the deposit,
fee and minimum change raises `INSUFFICIENT_FUNDS`. It never donates dust or drops
tokens. Lists and values are bounded before SDK work: at most 2,048 inputs/assets,
ADA up to the maximum supply and native quantities/sums up to signed 64-bit. Opaque
datum/reference-script observation hex is additionally bounded to 65,536 bytes.
Unsupported values fail closed. Selection has at most 2,048 additions and each
candidate at most eight fee iterations; there is no unbounded balancing loop.

Minimum change ADA is `(160 + actual serialized output bytes) * coinsPerUTxOByte`.
Actual serialized value length and planned final transaction size must fit current
parameters. The canonical witness count is the deduplicated union of all selected
payment keys and the stake key, including the CBOR array-header change at 24 keys.
Its witness-set size is `2 + arrayHeaderBytes(count) + 101 * count`.
The official linear-fee size is ARRAY3 `[originalBody, canonicalWitnesses, null]`;
the full wire ARRAY4 is one byte longer. The bounded loop computes that minimum,
allowing a conservative fixed point only within the guard's unchanged minimum
plus 10,000 and absolute 500,000 lovelace caps. The actual issued review must agree.
The stake deposit is separate from the fee.

The future wallet path must use the guard's canonical witness assembly and final
fee/signature checks. SDK-default tagged witnesses can be three bytes larger and
are not this declared fee plan. The runner proves tagged witnesses fail the final
minimum-fee check when the canonical exact minimum was funded. Reviewed bodies are
never patched or reserialized after hashing/signing. Unknown SDK exceptions become
a fixed `BUILD` message; supplied payloads are not forwarded.

## Reproduction and evidence

Use Node 24 and the pinned lockfile, applying the repository's safe-source execution
requirements before every npm command. From `easy1staking/`:

```sh
npm ci --ignore-scripts
node scripts/check-stake-builder.cjs
node scripts/check-stake-guard.cjs
node scripts/check-pool-facts.cjs
node scripts/check-framework-security.cjs
node scripts/check-runtime-security.cjs
npm run build
npm run lint
npm audit --omit=dev
```

The new runner's 89 cases execute the actual production builder, installed SDK public
subpaths, independent core, BLAKE2b and real Ed25519 signatures. It reports source
and in-memory compiled module hashes, the actual transitive loaded graph, and
requires zero outward calls with fetch, wallet
and socket tripwires. `--emit /absolute/owned/directory` writes its original synthetic
registered/unregistered bodies, canonical signed bytes, metadata, seven raw-accounting
cases (including tokens and 24 witnesses), and the full module identity graph for
independent oracle work. Those files contain public valueless test data only. Development
scripts/fixtures must stay outside the deployed runtime artifact.

The committed literal vectors were produced by a separate fixed low-level SDK
construction without importing the builder or guard. A small independent Python
decoder checked original spans, network, certificates, target, deposit, full change,
ADA accounting, sizes and BLAKE2b-256 IDs. They are in
`easy1staking/scripts/fixtures/stake-builder.json`.

| Original builder transaction | Body bytes | Canonical signed bytes | Actual and official minimum fee | Deposit |
|---|---:|---:|---:|---:|
| Registered tag 2 | 192 | 400 | 172,937 | 0 |
| Unregistered tag 11 | 197 | 405 | 173,157 | 2,000,000 |

Registered ID: `389aa08d5fefbe84c939b7243b6477a0c716fc66609dc66cbde49c64f2ed0d38`.
Unregistered ID: `e28a9dadcdfff8f04040672e228ebe623a6b4e6466bdf0e6c08c41ded8486fdb`.
Both outputs are 65 bytes, values are five bytes and minimum ADA is 969,750 lovelace
at the archived parameters. These are frozen synthetic observations, not current
chain-state or source-authentication proof.

The unchanged official full Conway ledger oracle ran all eight funded transitions
with the new production builder originals and guard-canonicalized real signatures:
four registered voting states, unregistered registration/delegation, both wrong
registration-state controls, and the original ledger-valid/site-forbidden wrong-pool
control. Six were accepted and two registration controls rejected. The oracle
asserted unchanged voting, original body/full signed-byte identity, input consumption,
target, change and fee/deposit pots. Official minimum fees exactly matched the new
canonical plan. No token or many-key funded-ledger acceptance is claimed; those
cases execute the actual guard, independent raw accounting and real signatures.

Oracle authority: cardano-ledger `f649f9751074d2ab3de033fc3912f29c9862c1f5`,
cardano-base `060819b59c184b951a54e3c563304983c53a3eac`, immutable executable SHA-256
`38093dae37d77b8fa5c54558c4da8326713a5a2bcf704bf88a920422c7f10fb7`,
image config `sha256:e7dd64d35141251ce62b7db653b5858c6e6183d5e36aaab4bf302d6075c7bea3`.
The container used no networking, a read-only filesystem/mount, user 1000:1000,
and exited zero/nonrunning. Reproduction needs those external retained artifacts or
an independently identified full-ledger harness, as described in the stake-guard
guide; no parser-only substitute establishes ledger acceptance.

API choices came from Evolution SDK 0.5.9 source
`b1e42443010e9c88a1b64e0c9a6b6061adcd16d5`, especially
`packages/evolution/src/{TransactionBody,Certificate,Assets,TxOut,Transaction}.ts`.
The applied skills were `dependency-sources`, `build-transaction`,
`evolution-sdk-transaction-traps` and `toolchain-false-greens`, with bundled
`docs/sources/evolution-sdk/staking/delegation.mdx`. Exact pinned sources determine
the low-level API and encoding choices.

Tests include registered/unregistered literals, one/two/24 witnesses, multi-input
BigInt tokens, deterministic ordering, reference-script protection, corroborated
datum, exact minimum ADA, fee/witness boundaries, redacted SDK exceptions, and
malformed/stale/inconsistent/oversized/insufficient contexts. Postcommit construction
controls remove network emission, asset aggregation and the registration deposit;
each must fail an actual healthy construction case. The independent core may safely
refuse a bad candidate: that is a failed positive build, not escaped unsafe output.
Restore exact committed source/index and rerun the builder and existing guard suite
after each control. The old 27 core neutralizations are unchanged prior evidence.

The module's Node tests and a dormant Next build do not establish actual SDK browser
compatibility. The later controller must load and exercise this module on the actual
production browser path before activation. Fresh-source acquisition and new-wallet
corroboration, live pool eligibility, complete W1–W8, controller/sign/submit/recovery,
dependency composition/security repairs, credential rotation and release/containment
gates remain open. No real wallet, provider account, key or mainnet action was used.
