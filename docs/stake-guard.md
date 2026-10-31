# Independent stake-only transaction guard

The delegation core in `easy1staking/src/lib/site/delegation/` independently decodes original CBOR, checks stake-only effects and accounting, issues an immutable review, and verifies the final transaction and Ed25519 signatures. It has no application caller yet. The website's wallet flow remains disabled; this core alone does not establish complete wallet or submission safety.

`reviewBody(bodyHex, context)` validates before review and derives the BLAKE2b-256 transaction ID from the exact original body. `validateBeforeSigning(review, freshContext)` repeats the checks with at least 180 slots remaining. `verifySignedTransaction(signedHex, review, freshContext)` requires at least 120 remaining slots, the identical original body, and exactly the deduplicated payment/stake keys, each with a real signature over that ID. It returns immutable signed hex and ID. `assembleSignedTransaction(witnessHex, review, freshContext)` accepts a wallet witness set, verifies it, and creates a canonical witness container while copying the original body unchanged. Reviews are opaque, process-local objects; copying or deserializing a review does not create a valid review.

The parser permits bounded, definite, minimally encoded CBOR and preserves original item spans. It rejects duplicate map keys/set members, trailing bytes, indefinite containers, unsupported tags, excessive counts/depth and malformed values. Tag 258 is accepted only in supported set positions. No SDK decoder, builder summary, transaction-ID convenience decoder or body reserialization supplies the policy decision.

Only explicit mainnet network ID 1 and ordinary 57-byte payment-key/stake-key base addresses are supported. The fixed pool hash is `20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9`. Registered accounts allow exactly certificate tag 2. Unregistered accounts allow tag 11, or tag 7 followed by tag 2, with the current explicit deposit. Credentials, pool, constructor arity/order and deposit must match. Other body keys, withdrawals, mint, scripts, collateral, reference inputs, governance and auxiliary data are refused, including empty fields. This flow does not change voting delegation.

Selected inputs must be unique members of a complete wallet snapshot with matching provider contents and explicit unspent state. Selected reference-script outputs are protected. Every output must return to the exact full fresh change address with no datum/reference script. Multiple change outputs and native assets are supported. ADA and native asset quantities use BigInt throughout; ADA inputs equal outputs plus fee plus registration deposit, and every native asset must be preserved exactly. Quantities above Number's precision remain exact. The supported native quantity/sum ceiling is signed 64-bit; ADA/sums cannot exceed Cardano's maximum supply. Unsupported resource shapes fail closed.

The controller must supply a validated `GuardContext` using plain objects, arrays, lowercase hex and BigInt quantities. Each account, registration, parameters, wallet, provider and current-tip observation must be no more than 30 seconds old and cannot come from the future. Wallet input records contain exact address/value content, `datum` as exact correlated opaque hex content or explicit `null`, and `referenceScript` as exact hex content or explicit `null`; missing/undefined does not mean absence. A selected reference script must be explicitly absent in both views. Provider `unspent: true` and wallet `complete: true` describe validated observations, not independent proof created by the type system. Unknown registration cannot be represented as unregistered. The supported slot configuration is mainnet Shelley start time 1596059091000 ms, slot 4492800, and 1000 ms per slot; tip epoch/slot/time must agree. The effective parameter epoch must match construction/current epochs.

The review binds network, revision, full address/stake credential, registration/current delegation, construction tip, parameter identity/epoch/coefficient values and all selected-input content. It privately retains the actual current slot and hash at issuance and after every successful pre-sign/final check. Normal monotonic tip advancement and refreshed observation timestamps preserve a review. A slot regression or replacement hash at the latest accepted slot permanently revokes that candidate, including rollback above issuance; returning to an earlier context cannot revive it. Tip primitives are copied into private state, so caller mutation cannot rewrite history. Failed semantic, stale or signature checks never advance the accepted envelope. The final recheck after asynchronous signature verification compares the latest private envelope: an older in-flight verification cannot downgrade it or accept after another check advances or revokes it. Semantic changes, already-EASY1 assessment, incoherent epochs, stale observations or short validity require reassessment. The upper validity bound must be construction tip plus 600 slots. Review and returned bytes are immutable strings/frozen records; the accepted envelope is ephemeral private process state. The controller must reacquire current observations immediately before outward wallet/provider operations.

Fee checks use the official ledger encoding **ARRAY3 `[originalBody, originalWitnesses, null]`**, which omits `isValid`. The mempool transaction is ARRAY4 and is one byte longer. The original registered fixture has a 192-byte body and 208-byte tagged witness set: its official size is 192 + 208 + 2 = 402 bytes. Normalizing only its witness container gives 205-byte canonical witnesses and planned fee size 192 + 205 + 2 = 399. Minimum fee is `constant + coefficient * feeSize`; scripts/reference scripts are excluded. The unsigned plan uses exact canonical witness container size for the derived distinct keys. Final verification uses the actual original witness span and repeats fee/size checks. Fees must be at least this independent minimum, at most minimum + 10,000 lovelace, and at most 500,000 lovelace. Registration deposit is separate. Minimum output ADA is `(160 + original serialized output size) * coinsPerUTxOByte`; current maximum value and transaction sizes are enforced. Protocol parameters cannot raise the fixed site fee caps.

Hashing uses the existing SDK-resolved `@noble/hashes` 2.2.0, now pinned directly. Its 1.8.0 dependency remains available for the existing 1.x parent; SDK/Effect/crypto versions were preserved. Ed25519 uses standard WebCrypto and fails with a typed capability limitation if unavailable. Errors contain fixed redacted messages, never supplied transaction/account/provider payloads.

## Reproduction

Use Node 24 and the locked dependency tree. Run these commands from `easy1staking/` after applying the repository's safe-source execution requirements:

```sh
npm ci --ignore-scripts
node scripts/check-stake-guard.cjs
node scripts/check-pool-facts.cjs
node scripts/check-framework-security.cjs
node scripts/check-runtime-security.cjs
npm run build
npm run lint
npm audit --omit=dev
```

The stake runner transpiles the actual production TypeScript into a fresh in-memory module graph and executes real WebCrypto. Its separate fixture codec only creates raw mutations; it contains no copy of the guard policy. Public deterministic synthetic fixtures are in `scripts/fixtures/stake-guard.json`; they contain no real wallet/account assets or secrets. Literal body IDs were independently checked with Python `hashlib.blake2b(..., digest_size=32)`. Positive fixtures include the original registered/tag-11 bytes, new original SDK tag-7-plus-2 bytes, token quantities above 2^53 with multiple exact-address outputs, required signers/lower validity, payment/stake key deduplication, and 24 distinct valid witnesses. Mutation pairs cover all forbidden body fields/certificates, input/provider/reference-script state, X/A and P/B outputs, asset loss/diversion/extra units, fee/minADA/size, malformed CBOR, signatures/witness contents and context/179–180/119–120 boundaries. No test calls a wallet, provider or real chain.

The validity boundaries use separate reviews and monotonic observations: construction +420 accepts 180 remaining slots before +421 rejects 179; construction +480 accepts the original real signed bytes with 120 remaining before +481 rejects 119. Expiry uses another never-revoked review at construction +600. This prevents rollback or earlier permanent revocation from masking the remaining-slot check. Candidate-local revocation is tested separately: revoking one review cannot poison an independently issued identical review, and the first review stays revoked.

Duplicate-key probes call the production parser directly and require `CBOR`, with unique-key neighbors. A complete registered body also duplicates integer fee key 2 with the same value: fee 180000 and change 99820000 preserve ADA balance and fund the six extra bytes within the fee caps. Its single-key neighbor passes review; the duplicate must fail specifically at parsing.

Final-fee tests use standard Node Ed25519 signing over the exact modified body ID, with the original fixture generator's public, valueless seeds. Canonical witnesses accept the exact 172937 minimum; adding only the supported tag 258 increases witness length by three bytes and requires 132 more lovelace, so the unchanged fee must fail `FEE`. The signatures and body remain identical across that pair. A real signed canonical minimum +10000 neighbor accepts; minimum +10001 is refused before signing. Final-size neighbors issue independent reviews with fixed limits: the original 403-byte signed transaction accepts at 403 and fails `SIZE` at 402, although its unsigned plan passes. No post-review parameter change supplies the refusal.

Source-neutralization checks must run against the committed runner. In an isolated checkout, disable exactly one check below, keep its positive fixtures intact, and execute `node --test-reporter=tap scripts/check-stake-guard.cjs`. Require the named actual `FORBIDDEN_ACCEPTANCE` failure, then restore the exact committed source and index and run the full suite green after **each** control. Never commit a neutralization. The 27 controls cover:

| Check neutralized | Required forbidden acceptance(s) |
|---|---|
| Exact output address | X/A and P/B outputs |
| Native-asset conservation | Burn, diversion unit, extra unit |
| Ed25519 verification | Corrupt same-body signature; corrupt assembly |
| Accepted-tip envelope | Issuance/latest same-slot replacement; rollback above issuance; older in-flight and conflicting concurrent observations |
| Minimum output ADA | One lovelace below minimum |
| Required-signer membership | Foreign required signer |
| Body network ID | Wrong network |
| Certificate sequence | Empty certificates; reversed tag 7/tag 2 |
| Certificate target | Wrong pool |
| Explicit deposit | Wrong tag 11 and tag 7 deposits |
| Wallet/provider content correlation | Value, address and datum mismatches |
| Selected reference-script exclusion | Reference-script input |
| ADA conservation | ADA diversion |
| Fee minimum +10000 cap | Fee 182938 |
| Absolute fee cap | Fee above 500000 with independently valid minimum |
| Fee minimum | Fee 172936; below final minimum with real signatures |
| Transaction size | Unsigned size limit; final size above unchanged limit |
| Semantic fingerprint | Delegation and parameter identity changes |
| Exact construction +600 validity | Different TTL |
| Observation freshness | Stale binding |
| Future-observation exclusion | Future binding |
| Exact final body | Changed signed body |
| Exact witness key set | Partial witnesses |
| Post-crypto recheck | Context changed during verification; older accepted/revoked in-flight tip |
| Duplicate-map rejection, retaining key tracking | Complete valid duplicate-fee body |
| Remaining-slot clause, retaining exact TTL | Isolated 179 pre-sign, 119 pre-submit and expiry |
| Body-key whitelist | Empty forbidden keys 5 and 99 |

Chain-envelope regressions use valid original signatures, including delayed real WebCrypto completion versus newer accepted/revoked observations. The minADA-one-below control remains ADA balanced, and the foreign-required-signer control includes sufficient fees, so other guards cannot mask those branches. Missing imports, compiler failures, timeouts, crypto-instrument failures and earlier guard errors do not count as a policy kill. Require every original SDK positive fixture to pass under each neutralization, and inspect executed/failed/skipped/cancelled counts rather than relying on an exit code or a fixed historical test count.

This hardening changes only the runner and this guide; production modules, dependencies, configuration and portable fixtures are unchanged. These bounded regression controls compose with the prior independent runtime and ledger evidence above. They do not establish exhaustive parser coverage, independent funded-ledger acceptance for the added fee neighbors, or completion of the wallet/controller and release obligations below.

## Independent ledger evidence

The external offline funded ledger harness used the full official Conway `applyTxWithFullValidation`, not a local certificate emulator. Its authority was cardano-ledger commit `f649f9751074d2ab3de033fc3912f29c9862c1f5`, cardano-base `060819b59c184b951a54e3c563304983c53a3eac`, and Evolution SDK 0.5.9 commit `b1e42443010e9c88a1b64e0c9a6b6061adcd16d5`. The immutable executable SHA-256 was `38093dae37d77b8fa5c54558c4da8326713a5a2bcf704bf88a920422c7f10fb7`; image config digest was `sha256:e7dd64d35141251ce62b7db653b5858c6e6183d5e36aaab4bf302d6075c7bea3`. Those external build artifacts are not bundled or published by this change.

| Original SDK fixture | Transaction ID | Signed bytes | Official minimum fee | Actual fee |
|---|---|---:|---:|---:|
| Registered tag 2 | `da32dcf11c5c3175d5645712e4f01d0fff739c9d5f2fd97619edf63705239ea2` | 403 | 173069 | 173113 |
| Unregistered tag 11 | `be8da2092793b4066b9d18d7a8e45d6fc2de12c9d68a4f5b3129d9d599f7cec1` | 408 | 173289 | 173333 |
| Unregistered tag 7 then 2 | `d9449eba76c8545add0a22aafdfe4bef4b1000bf1515f457700f818b5c98b222` | 442 | 174785 | 174829 |

The new tag-7-plus-2 campaign ran with networking disabled, a read-only filesystem/mount, and an unprivileged user. It retained the original registered and wrong-pool fixtures and changed only the synthetic unregistered fixture. Eight full-ledger transitions exercised four registered voting states (unset, representative, Abstain, No Confidence), unregistered registration/delegation, both wrong-registration controls, and the valid wrong-pool control. Six were ledger accepted; the two registration-state controls were rejected. Original body and full signed CBOR survived decode/application/reserialization byte-for-byte; input consumption, change, fee/deposit pots, stake target and unchanged voting state were asserted. Wrong pool is ledger-valid and site-forbidden; it is deliberately rejected by this guard. Token/many-key positive fixtures execute the independent guard and actual signatures but have no separate funded-ledger acceptance claim.

To repeat the ledger comparison independently, build a full-ledger harness at the pinned commits, decode the portable original fixture bytes at protocol version 11 without fixups, seed the exact synthetic input address/ref/value with 100,000,000 lovelace and matching registration/voting state, and register both the fixed and wrong-pool targets. Apply each original transaction at slot 201835488/epoch 664 against the archived protocol parameters. Verify original bytes/ID, `getMinFeeTx`, input consumption, all resulting pots/change, and unchanged voting. Run all eight transition/control combinations above; accepting only a tag parser is insufficient. Full archived protocol parameters and the new campaign's deciding result summary are included with the fixture data. A locally rebuilt harness is a separate empirical witness and must establish its own source/binary identity.

The fee-size authority is `eras/alonzo/impl/src/Cardano/Ledger/Alonzo/Tx.hs` (`toCBORForSizeComputation`, `alonzoMinFeeTx`); minADA is `eras/babbage/impl/src/Cardano/Ledger/Babbage/TxOut.hs` (`babbageMinUTxOValue`). Hash source authority is noble-hashes commit `81983c2fffac48aa69dabc260b4192ad597d2734`. The `dependency-sources`, `build-transaction` and `evolution-sdk-transaction-traps` skills and bundled Evolution staking documentation informed source inspection; actual pinned SDK/ledger sources determine these encoding claims.

## Remaining integration obligations

The future controller must acquire/authenticate complete wallet and provider observations, choose the unique matching reward credential, enforce pool eligibility and network/SDK identity, and serialize semantic refreshes under connection revisions. It must integrate actual balancing, show the immutable review, enforce origin-wide locking/recovery/storage rules, reacquire context around wallet approval, and gate actual sign/submit calls. Outcome uncertainty, retry/reload/cross-tab behavior, provider deadlines and source reconciliation still need complete end-to-end tests. Types and pure checks provide no atomic provider snapshot or external account lock. Packaging must exclude development fixtures and scripts from the runtime artifact. No complete W1–W8, release-readiness or absence-of-vulnerabilities claim follows from this core.
