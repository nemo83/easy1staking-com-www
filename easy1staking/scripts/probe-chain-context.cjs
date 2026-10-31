#!/usr/bin/env node
"use strict";
// Operator only. Identifier and sampled public addresses remain ephemeral and unprinted.
const { loadDelegationSource } = require("./lib/load-delegation-source.cjs");
const { createHash } = require("node:crypto"), fs = require("node:fs");
async function hiddenIdentifier() {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") throw Error("TTY");
  return new Promise((resolve, reject) => {
    let value = "", ended = false;
    const cleanup = () => { process.stdin.removeListener("data", data); for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.removeListener(s, stop); process.stdin.setRawMode(false); process.stdin.pause(); };
    const finish = (error) => { if (ended) return; ended = true; cleanup(); process.stdout.write("\n"); error ? reject(Error("TTY")) : resolve(value); };
    const stop = () => finish(true);
    const data = chunk => {
      for (const b of chunk) {
        if (b === 3 || b === 4) return finish(true);
        if (b === 10 || b === 13) return finish(false);
        if (b === 127 || b === 8) value = value.slice(0, -1);
        else if (b >= 33 && b <= 126 && value.length < 256) value += String.fromCharCode(b);
        else return finish(true);
      }
    };
    for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(s, stop);
    process.stdin.setRawMode(true); process.stdin.on("data", data); process.stdin.resume();
    process.stdout.write("Browser-public mainnet project identifier (hidden): ");
  });
}
async function main() {
  const projectId = await hiddenIdentifier(), loader = loadDelegationSource();
  const { assessChainContext } = loader.load("chain-context"), { createBlockfrostRead, MAINNET_SOURCE } = loader.load("blockfrost-reader");
  const { field, list, text, hash, integer, decimal } = loader.load("provider-json"), { addressHex } = loader.load("source-cbor"), { bindWallet } = loader.load("wallet-codec");
  const originalFetch = globalThis.fetch, controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120000);
  const report = { indexOnly: true, ownershipProved: false, liveNewAccountGate: "pending", requests: 0, candidates: 0, registered: 0, neverRegistered: 0, deregisteredOrUnknownHistory: 0, alreadyEASY1: 0, refused: 0, coherent: 0, stopped: "bounded", source: MAINNET_SOURCE };
  globalThis.fetch = async (url, options) => {
    if (report.requests >= 200 || controller.signal.aborted) { controller.abort(); throw Error("BOUND"); }
    if (typeof url !== "string" || !url.startsWith(MAINNET_SOURCE + "/") || options?.method !== "GET") throw Error("METHOD");
    report.requests++; const response = await originalFetch(url, options);
    if ([401, 403, 418, 429].includes(response.status)) { report.stopped = "provider-refused"; controller.abort(); }
    return response;
  };
  let source;
  try {
    source = createBlockfrostRead(projectId, controller.signal);
    const txs = list((await source.get("/blocks/latest/txs", 1)).value).slice(0, 32), seen = new Set();
    for (const tx of txs) {
      if (report.candidates >= 32 || controller.signal.aborted) break;
      const id = hash(tx), outputs = list(field((await source.get("/txs/" + id + "/utxos")).value, "outputs"));
      for (const output of outputs) {
        if (report.candidates >= 32 || controller.signal.aborted) break;
        if (field(output, "collateral") !== false || field(output, "data_hash") !== null || field(output, "inline_datum") !== null || field(output, "reference_script_hash") !== null) continue;
        let address; try { address = addressHex(text(field(output, "address"))); } catch { continue; }
        const stake = address.slice(58); if (seen.has(stake)) continue; seen.add(stake);
        const amount = list(field(output, "amount")); if (amount.length !== 1 || text(field(amount[0], "unit")) !== "lovelace") continue;
        const lovelace = decimal(field(amount[0], "quantity")); if (lovelace === 0n) continue;
        const now = Date.now(), input = { txId: id, index: integer(field(output, "output_index"), 65535n), addressHex: address, lovelace, assets: {}, datum: null, referenceScript: null };
        const state = { phase: "observed", error: null, revision: 1, observation: { binding: bindWallet(1, address, []), inputs: { complete: true, utxos: [input] }, bindingObservedAt: now, rewardsObservedAt: now, inputsObservedAt: now, finalBindingObservedAt: now } };
        report.candidates++; const result = await assessChainContext(state, projectId, { signal: controller.signal });
        if (result.status === "refused") report.refused++;
        else {
          report.coherent++;
          if (result.status === "already-EASY1") report.alreadyEASY1++;
          else if (result.context.registration === "registered") report.registered++;
          else {
            const account = loader.load("source-cbor").stakeBech32(stake), history = list((await source.pages("/accounts/" + account + "/registrations")).value);
            if (history.length === 0) { report.neverRegistered++; report.liveNewAccountGate = "positive-index-observation"; } else report.deregisteredOrUnknownHistory++;
          }
        }
        if (report.registered > 0 && report.neverRegistered > 0) { report.stopped = "observed"; break; }
      }
      if (report.stopped === "observed") break;
    }
  } catch { if (report.stopped !== "provider-refused") report.stopped = controller.signal.aborted ? "bounded" : "unavailable"; }
  finally { source?.close(); clearTimeout(timer); controller.abort(); globalThis.fetch = originalFetch; }
  const identity = loader.identity(); loader.close();
  report.sourceIdentity = createHash("sha256").update(JSON.stringify(identity.production)).digest("hex");
  report.toolIdentity = createHash("sha256").update(fs.readFileSync(__filename)).digest("hex");
  process.stdout.write(JSON.stringify(report) + "\n");
}
main().catch(() => { process.stdout.write('{"indexOnly":true,"liveNewAccountGate":"pending","stopped":"unavailable"}\n'); process.exitCode = 1; });
