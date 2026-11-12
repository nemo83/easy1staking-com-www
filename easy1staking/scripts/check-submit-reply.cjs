#!/usr/bin/env node
"use strict";
// W8 first-attempt submit-reply classifier: only a 400 in the narrow local form (the three required fields exactly, status_code the number 400,
// error "Bad Request", and a message that is one ledger-rejection list without ambiguous wording) is reported; everything else stays unknown.
// Executes the production module; every expectation is a literal.
const fs = require("node:fs"), path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadDelegationSource } = require("./lib/load-delegation-source.cjs");
const source = loadDelegationSource(); let loaded = null; const reply = () => loaded ?? (loaded = source.load("submit-reply"));

const json = o => Buffer.from(JSON.stringify(o), "utf8");
const ok = message => ({ status_code: 400, error: "Bad Request", message });
const ledger = item => "ConwayApplyTxError [ConwayUtxowFailure (UtxoFailure (" + item + "))]";
const cls = (body, status = 400, redirected = false, type = "application/json") => reply().reportedValidationError(status, redirected, type, body);
const FEE = "FeeTooSmallUTxO (Mismatch (RelGTEQ) {supplied: Coin 150000, expected: Coin 170000})";
// Exactly the bundled cip30-test-wallet literal.
const LEDGER = ledger(FEE);
// Synthetic, era-prefix-free form.
const OLDER = "ApplyTxError [UtxowFailure (UtxoFailure (OutsideValidityIntervalUTxO (ValidityInterval {invalidBefore = SNothing, invalidHereafter = SJust (SlotNo 100)}) (SlotNo 200)))]";
// A ledger-rejection body of exactly n bytes: k one-byte characters inside the failure fill the remainder.
const sized = n => { const k = n - json(ok(ledger("FeeTooSmallUTxO ()"))).length; return json(ok(ledger("FeeTooSmallUTxO (" + "x".repeat(k) + ")"))); };
const raw = text => Buffer.from(text, "utf8");

test("a ledger rejection in the bundled 400 schema is classified", () => assert.equal(cls(json(ok(LEDGER))), true));
test("the JSON content type with charset utf-8 is accepted", () => assert.equal(cls(json(ok(LEDGER)), 400, false, "application/json; charset=utf-8"), true));
test("the older ApplyTxError form is classified", () => assert.equal(cls(json(ok(OLDER))), true));
test("a body of exactly the byte limit is read", () => {
  const body = sized(16384); assert.equal(body.length, 16384);
  assert.equal(cls(body), true);
});
test("a body one byte over the limit is not classified", () => {
  const body = sized(16385); assert.equal(body.length, 16385);
  assert.equal(cls(body), false);
});
test("a status other than 400 is not classified", () => {
  for (const status of [200, 201, 401, 402, 403, 404, 409, 418, 425, 429, 500, 502, 503, 504]) assert.equal(cls(json(ok(LEDGER)), status), false, String(status));
});
test("a redirected reply is not classified", () => assert.equal(cls(json(ok(LEDGER)), 400, true), false));
test("a content type other than JSON is not classified", () => {
  for (const type of ["text/plain", "application/json-patch+json", "application/json; charset=iso-8859-1", "", null]) assert.equal(cls(json(ok(LEDGER)), 400, false, type), false, String(type));
});
test("malformed UTF-8 is not classified", () => {
  const body = Buffer.concat([raw('{"status_code":400,"error":"Bad Request","message":"ConwayApplyTxError [ConwayUtxowFailure (UtxoFailure (FeeTooSmallUTxO ('), Buffer.from([0xff]), raw(')))]"}')]);
  assert.equal(cls(body), false);
});
test("malformed JSON is not classified", () => assert.equal(cls(raw('{"status_code":400,"error":"Bad Request","message":' + JSON.stringify(LEDGER))), false));
test("a duplicate key is not classified", () => assert.equal(cls(raw('{"status_code":400,"error":"Bad Request","message":"benign","message":' + JSON.stringify(LEDGER) + "}")), false));
test("an extra key is not classified", () => assert.equal(cls(json({ ...ok(LEDGER), detail: "x" })), false));
test("a missing key is not classified", () => assert.equal(cls(json({ error: "Bad Request", message: LEDGER })), false));
test("a body status code other than the number 400 is not classified", () => {
  for (const code of ["500", '"400"', "400.0", "4e2"]) assert.equal(cls(raw('{"status_code":' + code + ',"error":"Bad Request","message":' + JSON.stringify(LEDGER) + "}")), false, code);
});
test("an error text other than Bad Request is not classified", () => {
  for (const error of ["Internal Server Error", "bad request", "Bad Request "]) assert.equal(cls(json({ status_code: 400, error, message: LEDGER })), false, error);
});
test("a message that is not a string is not classified", () => {
  assert.equal(cls(json(ok([LEDGER]))), false, "array");
  assert.equal(cls(json(ok({ text: LEDGER }))), false, "object");
});
test("a message without a ledger rejection is not classified", () => {
  for (const message of ["Backend did not understand your request.", "applytxerror [UtxowFailure (x)]"]) assert.equal(cls(json(ok(message))), false, message);
});
test("a spent-input failure is not classified", () => {
  for (const message of [ledger("BadInputsUTxO (fromList [])"), ledger("badinputsutxo (fromList [])")]) assert.equal(cls(json(ok(message))), false, message);
});
test("an already-known transaction is not classified", () => {
  for (const message of [ledger("AlreadyInLedger (TxId 0)"), ledger("already been included (TxId 0)")]) assert.equal(cls(json(ok(message))), false, message);
});
test("a duplicate transaction is not classified", () => assert.equal(cls(json(ok(ledger("Transaction is a duplicate")))), false));
test("a mempool reply is not classified", () => assert.equal(cls(json(ok(ledger("Mempool is full, please try resubmitting again later.")))), false));
test("a missing or non-byte body is not classified", () => {
  for (const body of [null, [123], "abc"]) assert.equal(cls(body), false, JSON.stringify(body));
});
test("the byte limit is 16384", () => assert.equal(reply().REPORT_BODY_LIMIT, 16384));
test("only submit-reply and provider-json are loaded, and the only import is provider-json", () => {
  reply();
  assert.deepEqual(source.identity().production.map(m => m.file).sort(), ["src/lib/site/delegation/provider-json.ts", "src/lib/site/delegation/submit-reply.ts"]);
  const text = fs.readFileSync(path.resolve(__dirname, "../src/lib/site/delegation/submit-reply.ts"), "utf8");
  assert.deepEqual(text.split("\n").filter(line => /^\s*import\b/.test(line)), ['import { JsonNumber, parseProviderJson } from "./provider-json";']);
});
// Synthetic list forms: one fee failure with an ambiguous member after it.
test("a mixed failure list carrying an ambiguous failure is not classified", () => {
  for (const message of ["ConwayApplyTxError [ConwayUtxowFailure (UtxoFailure (" + FEE + ")),ConwayUtxowFailure (UtxoFailure (BadInputsUTxO (fromList [])))]",
    "ConwayApplyTxError [ConwayUtxowFailure (UtxoFailure (" + FEE + ")),ConwayMempoolFailure (MempoolFull)]"]) assert.equal(cls(json(ok(message))), false, message);
});
// The leading form is killed only by N17 and N11, the trailing form only by N18 and N11.
test("narrative text around the ledger token is not classified", () => {
  for (const message of ["The node reported " + LEDGER, LEDGER + " was seen yesterday"]) assert.equal(cls(json(ok(message))), false, message);
});
// The capital-letter constructor rule: killed only by MA2.
test("a list whose first member does not start with a capital letter is not classified", () => {
  for (const message of ["ConwayApplyTxError [conwayUtxowFailure (UtxoFailure (" + FEE + "))]", "ConwayApplyTxError [ (UtxoFailure (" + FEE + "))]"]) assert.equal(cls(json(ok(message))), false, message);
});
