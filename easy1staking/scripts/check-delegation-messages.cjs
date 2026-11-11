#!/usr/bin/env node
"use strict";
// W8 failure messages: every owned code maps to its exact plain text, forged keys give each kind's fallback, and the
// text set is the browser flow's enumerated status-line set. Executes the production module; expectations are literals.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { test } = require("node:test"), { loadDelegationSource, sha256 } = require("./lib/load-delegation-source.cjs");
const ts = require("typescript");
const source = loadDelegationSource(), messages = source.load("messages");
const dir = path.resolve(__dirname, "../src/lib/site/delegation"), flow = require("./fixtures/delegation-flow.json");

const CONNECT_FALLBACK = "The wallet or current chain information could not be verified. Only mainnet key accounts are supported.";
const SOURCE_FALLBACK = "Current chain information could not be verified. Use your wallet directly or reconnect later.";
const STOP_FALLBACK = "Delegation stopped before sending. Information changed or a safety check failed. Reconnect to build a new review.";
const COORDINATION = "Browser coordination or the operation is unavailable. Check any prior operation from its originating browser.";
const T = {
  WALLET_MISSING: "The selected wallet is not available in this browser. Open this page in your wallet's browser or enable its extension, then choose it again.",
  CONNECT_DENIED: "The wallet did not allow the connection or refused a request. Approve the request in your wallet, then connect again.",
  WALLET_TIMEOUT: "The wallet did not answer in time. Unlock it, then connect again.",
  WALLET_UNSUPPORTED: "This wallet account cannot be used here. Switch the wallet to Cardano mainnet and choose an ordinary key-based account, then connect again.",
  WALLET_CHANGED: "The wallet changed while connecting. Connect again.",
  PROVIDER_CONFIG: "This page's chain data service is not set up correctly, so delegation is unavailable here. Use your wallet directly.",
  PROVIDER_DOWN: "Chain data is unavailable right now. Try again in a few minutes, or use your wallet directly.",
  POOL: "EASY1 cannot accept new delegations right now: the pool is retiring, retired or not yet active. Nothing was built. Check back later.",
  NO_FUNDS: "This wallet has no ADA available for a delegation. Add ADA to this account, then connect again.",
  DECLINED: "Delegation stopped before sending. You declined the signature in your wallet. Reconnect to build a new review.",
  SIGN_FAILED: "Delegation stopped before sending. The wallet could not sign this transaction. Reconnect to build a new review, or use your wallet directly.",
  EXPIRED: "Delegation stopped before sending. The review expired before the transaction could be sent. Reconnect to build a new review.",
  CHANGED: "Delegation stopped before sending. Your wallet's account, network or funds changed. Reconnect to build a new review.",
  FUNDS: "Delegation stopped before sending. This wallet does not have enough ADA for the fee, any registration deposit and the minimum change. Add ADA, then reconnect.",
  FEE: "Delegation stopped before sending. The fee was higher than this page allows. Reconnect to build a new review.",
  BUILD: "Delegation stopped before sending. The transaction could not be built or checked safely. Reconnect to build a new review, or use your wallet directly.",
  WITNESS: "Delegation stopped before sending. The wallet's signature did not match the reviewed transaction. Reconnect to build a new review.",
  POOL_STOP: "Delegation stopped before sending. EASY1 cannot accept new delegations right now. Check back later.",
  PROVIDER_CONFIG_STOP: "Delegation stopped before sending. This page's chain data service is not set up correctly. Use your wallet directly.",
  PROVIDER_DOWN_STOP: "Delegation stopped before sending. Chain data became unavailable. Try again in a few minutes.",
  ALREADY: "This account already delegates to EASY1. No transaction is needed.",
  CANCEL_OPEN: "Cancelled here. Any open wallet request may still finish; its late reply cannot submit.",
  CANCEL_IDLE: "Cancelled here. Nothing was sent.",
  BUSY: "Another delegation operation is active in this browser.",
};
// W7 manual-dismissal status texts (kind "recovery"); DISMISS_KEPT is also its fallback.
const R = {
  EXPIRED_UNSEEN: "This transaction has expired and was not found on chain when checked. That does not prove it was never included. After you check its ID in your wallet or a chain explorer, you can dismiss this record.",
  SPENT_BY_ID: "This transaction was not found, but one of its inputs is recorded as spent by this same transaction ID, so it may be on chain. Nothing was cleared. Check it in your wallet or a chain explorer.",
  SEEN_UNVERIFIED: "An earlier chain-data response reported this transaction, but verification is still unresolved. Nothing was cleared. Check again later, or check it in your wallet or a chain explorer.",
  DISMISSED: "You dismissed this record after checking the transaction ID yourself. This page did not confirm it. Keep the ID; a new delegation needs a new review and your approval.",
  DISMISS_KEPT: "The record was kept in this browser. To dismiss it, check status again, or check the ID in your wallet or a chain explorer.",
};
const DISMISSAL = {
  disclosure: "Dismiss clears the pending record in this browser. Save the transaction ID for later checks. The transaction may already have confirmed, or it may confirm later after a rollback. A new delegation requires your approval and may incur another fee and a registration deposit.",
  spentElsewhere: "One of its inputs was spent by a different transaction, so it can no longer be included on the chain as observed.",
  attestationLabel: 'Type "I checked this ID" to confirm that you checked this exact transaction ID in your wallet or a chain explorer.',
  attestationPhrase: "I checked this ID", offer: "Dismiss this record", confirm: "Confirm dismissal", keep: "Keep the record",
  region: "Dismiss pending record", dismissedRegion: "Dismissed record", dismissedCaption: "Transaction ID — dismissed by you",
  priorNotice: "A prior operation is unresolved in this browser. Keep its ID. This page can check its status and, after it expires, let you dismiss it once you have checked the ID yourself. Only the tab that signed it can send the same transaction again, until that tab reloads or its wallet disconnects or changes.",
};
// W7 deliberate-retry copy (RETRY_COPY), test-local literals.
const RETRY = {
  offer: "Send the same signed transaction again",
  note: "This sends the exact transaction you already approved, with the same ID, once more. Your wallet is not asked to sign again and nothing new is built.",
  checking: "Checking this transaction's status and fresh account, input and pool information before sending it again.",
  sending: "Sending the same signed transaction again. Submission does not mean confirmation.",
  easy1: "This account now delegates to EASY1, but this transaction was not confirmed when checked. Nothing was sent again. Keep the ID and check its status, or check it in your wallet or a chain explorer.",
  expired: "Too little validity remains to send this signed transaction again. Nothing was sent again. Keep the ID and check its status, or check it in your wallet or a chain explorer.",
  stopped: "The signed transaction was not sent again: a check failed or information changed. Keep the ID and check its status, or check it in your wallet or a chain explorer.",
  unresolved: "This transaction's status is not settled, so it was not sent again. Check its status again later, or check it in your wallet or a chain explorer.",
};
const expected = {
  wallet: { UNAVAILABLE: T.WALLET_MISSING, REFUSED: T.CONNECT_DENIED, TIMEOUT: T.WALLET_TIMEOUT, UNSUPPORTED: T.WALLET_UNSUPPORTED, CHANGED: T.WALLET_CHANGED },
  source: { CONFIGURATION: T.PROVIDER_CONFIG, AUTHORIZATION: T.PROVIDER_CONFIG, TRANSPORT: T.PROVIDER_DOWN, QUOTA: T.PROVIDER_DOWN, TIMEOUT: T.PROVIDER_DOWN,
    INELIGIBLE: T.POOL, NO_FUNDS: T.NO_FUNDS, NOT_FOUND: SOURCE_FALLBACK, RESPONSE: SOURCE_FALLBACK, JSON: SOURCE_FALLBACK, LIMIT: SOURCE_FALLBACK,
    CANCELLED: SOURCE_FALLBACK, WALLET: SOURCE_FALLBACK, STALE: SOURCE_FALLBACK, COHERENCE: SOURCE_FALLBACK, PARAMETERS: SOURCE_FALLBACK, INPUT: SOURCE_FALLBACK },
  "source-stop": { CONFIGURATION: T.PROVIDER_CONFIG_STOP, AUTHORIZATION: T.PROVIDER_CONFIG_STOP, TRANSPORT: T.PROVIDER_DOWN_STOP, QUOTA: T.PROVIDER_DOWN_STOP,
    TIMEOUT: T.PROVIDER_DOWN_STOP, INELIGIBLE: T.POOL_STOP, NO_FUNDS: T.FUNDS, NOT_FOUND: STOP_FALLBACK, RESPONSE: STOP_FALLBACK, JSON: STOP_FALLBACK,
    LIMIT: STOP_FALLBACK, CANCELLED: STOP_FALLBACK, WALLET: STOP_FALLBACK, STALE: STOP_FALLBACK, COHERENCE: STOP_FALLBACK, PARAMETERS: STOP_FALLBACK, INPUT: STOP_FALLBACK },
  signature: { DECLINED: T.DECLINED, REFUSED: T.SIGN_FAILED, UNSUPPORTED: T.SIGN_FAILED, BUSY: T.SIGN_FAILED, TIMEOUT: T.EXPIRED, CHANGED: T.CHANGED,
    WITNESS: T.WITNESS, REVIEW: STOP_FALLBACK, ABORTED: STOP_FALLBACK },
  guard: { VALIDITY: T.EXPIRED, REVISION: T.CHANGED, BINDING: T.CHANGED, NETWORK: T.CHANGED, FEE: T.FEE, CBOR: T.BUILD, BODY: T.BUILD, CERTIFICATE: T.BUILD,
    ADDRESS: T.BUILD, VALUE: T.BUILD, ASSETS: T.BUILD, ADA: T.BUILD, MIN_ADA: T.BUILD, SIZE: T.BUILD, SIGNER: T.BUILD, WITNESS: T.WITNESS, SIGNATURE: T.WITNESS,
    CRYPTO: T.WITNESS, CONTEXT: STOP_FALLBACK, STALE: STOP_FALLBACK, PARAMETERS: STOP_FALLBACK, INPUT: STOP_FALLBACK, REVIEW: STOP_FALLBACK },
  build: { ALREADY_DELEGATED: T.ALREADY, INSUFFICIENT_FUNDS: T.FUNDS, BUILD: T.BUILD, CORROBORATION: T.BUILD, SINGLE_CHANGE: T.BUILD },
  stop: { "cancel-open": T.CANCEL_OPEN, "cancel-idle": T.CANCEL_IDLE, changed: T.CHANGED, expired: T.EXPIRED },
  coordination: { BUSY: T.BUSY, CANCELLED: STOP_FALLBACK, UNAVAILABLE: COORDINATION, PENDING: COORDINATION, LOST: COORDINATION, RECORD: COORDINATION,
    LEASE: COORDINATION, INTENT: COORDINATION, RESOLUTION: COORDINATION, OPERATION: COORDINATION },
  recovery: { "expired-unseen": R.EXPIRED_UNSEEN, "spent-by-id": R.SPENT_BY_ID, "seen-unverified": R.SEEN_UNVERIFIED, dismissed: R.DISMISSED, "dismiss-kept": R.DISMISS_KEPT },
};
const fallbacks = { wallet: CONNECT_FALLBACK, source: SOURCE_FALLBACK, "source-stop": STOP_FALLBACK, signature: STOP_FALLBACK, guard: STOP_FALLBACK,
  build: STOP_FALLBACK, stop: STOP_FALLBACK, coordination: COORDINATION, recovery: R.DISMISS_KEPT };
// The owned unions, parsed from the production declarations (not from messages.ts).
function union(file, name) {
  const text = fs.readFileSync(path.join(dir, file), "utf8"), match = new RegExp("export type " + name + " =([^;]+);").exec(text);
  assert(match, "UNION_DECLARED " + name);
  return match[1].split("|").map(part => { const m = /^\s*"([^"]+)"\s*$/.exec(part); assert(m, "UNION_LITERAL " + name); return m[1]; }).sort();
}
const unions = { wallet: ["wallet-session.ts", "SessionError"], source: ["provider-json.ts", "SourceCode"], "source-stop": ["provider-json.ts", "SourceCode"],
  signature: ["wallet-session.ts", "SignatureCode"], guard: ["types.ts", "GuardCode"], build: ["builder.ts", "BuildCode"], coordination: ["coordination.ts", "CoordinationCode"],
  stop: ["messages.ts", "StopReason"], recovery: ["messages.ts", "RecoveryText"] };
const kinds = Object.keys(expected);

test("the failure kinds are exactly the expected kinds", () => assert.deepEqual(kinds.slice().sort(), Object.keys(unions).sort()));
for (const kind of kinds) {
  const [file, name] = unions[kind];
  test(`${kind} table keys equal the ${name} union in ${file}`, () => {
    assert.deepEqual(messages.failureCodes(kind).slice().sort(), union(file, name));
    assert.deepEqual(Object.keys(expected[kind]).sort(), union(file, name));
  });
  for (const [code, text] of Object.entries(expected[kind])) test(`${kind} ${code}`, () => {
    assert.equal(messages.failureMessage(kind, code), text);
    assert.equal(messages.failureCode(kind, code), code);
  });
  test(`${kind} forged keys give the fallback`, () => {
    for (const forged of ["__proto__", "constructor", "toString", "hasOwnProperty", "", " RESPONSE", 1, null, undefined, {}]) {
      assert.equal(messages.failureMessage(kind, forged), fallbacks[kind], `${kind} ${String(forged)}`);
      assert.equal(messages.failureCode(kind, forged), null, `${kind} code ${String(forged)}`);
    }
  });
}
// Every text the module can produce: each kind's table values and fallback.
const produced = () => [...new Set(kinds.flatMap(kind => [...messages.failureCodes(kind).map(code => messages.failureMessage(kind, code)), messages.failureMessage(kind, null)]))];
test("every message is plain: it ends with a period and has no markup, error words or code identifiers", () => {
  // "EASY1" is the pool's name and "ADA" the currency; any other all-capitals token would be a leaked code identifier.
  for (const text of produced()) {
    assert(text.endsWith("."), text);
    for (const banned of ["{", "<", "Error", "undefined"]) assert(!text.includes(banned), text);
    for (const token of text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? []) assert(["EASY1", "ADA"].includes(token), text);
  }
});
test("every produced message is in the browser flow's enumerated status texts", () => {
  for (const text of produced()) assert(flow.statusTexts.includes(text), text);
});
test("DISMISSAL_COPY has exactly the expected keys and literals", () => {
  const copy = messages.DISMISSAL_COPY;
  assert(Object.isFrozen(copy), "DISMISSAL_COPY_FROZEN");
  assert.deepEqual(Object.keys(copy).sort(), Object.keys(DISMISSAL).sort());
  for (const [key, text] of Object.entries(DISMISSAL)) assert.equal(copy[key], text, key);
});
test("DISMISSAL_COPY is plain: no markup, error words or code identifiers, and its sentences end with a period", () => {
  const copy = messages.DISMISSAL_COPY;
  for (const [key, text] of Object.entries(copy)) {
    for (const banned of ["{", "<", "Error", "undefined"]) assert(!text.includes(banned), key);
    for (const token of text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? []) assert(["EASY1", "ADA"].includes(token), key);
  }
  for (const key of ["disclosure", "spentElsewhere", "attestationLabel", "priorNotice"]) assert(copy[key].endsWith("."), key);
});
test("RETRY_COPY has exactly the expected keys and literals", () => {
  const copy = messages.RETRY_COPY;
  assert(Object.isFrozen(copy), "RETRY_COPY_FROZEN");
  assert.deepEqual(Object.keys(copy).sort(), Object.keys(RETRY).sort());
  for (const [key, text] of Object.entries(RETRY)) assert.equal(copy[key], text, key);
});
test("RETRY_COPY is plain: no markup, error words or code identifiers, and every entry except the offer ends with a period", () => {
  const copy = messages.RETRY_COPY;
  for (const [key, text] of Object.entries(copy)) {
    for (const banned of ["{", "<", "Error", "undefined"]) assert(!text.includes(banned), key);
    for (const token of text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? []) assert(["EASY1", "ADA"].includes(token), key);
    if (key !== "offer") assert(text.endsWith("."), key);
  }
});
test("every RETRY_COPY status-line text is in the browser flow's enumerated status texts", () => {
  const copy = messages.RETRY_COPY;
  for (const key of ["checking", "sending", "easy1", "expired", "stopped", "unresolved"]) assert(flow.statusTexts.includes(copy[key]), key);
});
test("the compiled module has no require calls", () => {
  const file = path.join(dir, "messages.ts"), original = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(original, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true } }).outputText;
  const loaded = source.identity().production.find(m => m.file === "src/lib/site/delegation/messages.ts");
  assert(loaded && loaded.sourceSha256 === sha256(original) && loaded.compiledSha256 === sha256(compiled), "COMPILED_IDENTITY");
  assert.equal(source.identity().production.length, 1, "ONLY_MESSAGES_LOADED");
  assert(!/\brequire\s*\(/.test(compiled), "NO_REQUIRE");
  assert(original.split("\n").filter(line => /^\s*import\b/.test(line)).every(line => /^\s*import type\b/.test(line)), "TYPE_ONLY_IMPORTS");
});
