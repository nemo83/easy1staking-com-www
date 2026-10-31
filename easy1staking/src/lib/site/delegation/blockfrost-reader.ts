import { ensure, field, list, parseProviderJson, SourceError, sourceFailure, JSON_LIMITS } from "./provider-json";
import type { Json } from "./provider-json";
export const MAINNET_SOURCE = "https://cardano-mainnet.blockfrost.io/api/v0";
export interface SourceRuntime { readonly now?: () => number; readonly readTimeoutMs?: number; readonly totalTimeoutMs?: number }
export interface Observation { readonly value: Json; readonly observedAt: number }
const fixed = /^\/(?:blocks\/latest(?:\/txs)?|epochs\/latest(?:\/parameters)?|epochs\/[0-9]{1,16}\/parameters|pools\/(?:retired|retiring)|pools\/[0-9a-f]{56}(?:\/(?:updates|metadata))?|accounts\/stake1[023456789acdefghjklmnpqrstuvwxyz]{1,120}(?:\/(?:registrations|delegations))?|addresses\/addr1[023456789acdefghjklmnpqrstuvwxyz]{1,200}\/utxos|txs\/[0-9a-f]{64}(?:\/(?:stakes|delegations|pool_updates|pool_retires|utxos))?)$/;
/** An operation owns all requests and deadlines; no observations survive it as a cache. */
export function createBlockfrostRead(projectId: string, signal?: AbortSignal, runtime: SourceRuntime = {}) {
  ensure(typeof projectId === "string" && projectId.trim().length >= 1 && projectId.length <= 256 && /^[\x20-\x7e]+$/.test(projectId), "CONFIGURATION");
  const now = runtime.now ?? Date.now, readMs = runtime.readTimeoutMs ?? 10000, totalMs = runtime.totalTimeoutMs ?? 30000;
  ensure(Number.isSafeInteger(readMs) && readMs > 0 && readMs <= 10000 && Number.isSafeInteger(totalMs) && totalMs > 0 && totalMs <= 30000, "CONFIGURATION");
  const controller = new AbortController(), start = clock(); let closed = false, reason: SourceError | null = null, requests = 0, items = 0;
  const cancel = () => abort(new SourceError("CANCELLED"));
  function clock(): number { try { const n = now(); ensure(Number.isSafeInteger(n) && n >= 0, "STALE"); return n; } catch (error) { throw sourceFailure(error, "STALE"); } }
  function abort(error: SourceError): void { reason ??= error; controller.abort(); }
  signal?.addEventListener("abort", cancel, { once: true }); if (signal?.aborted) cancel();
  const totalTimer = setTimeout(() => abort(new SourceError("TIMEOUT")), totalMs);
  function check(): void { if (reason) throw sourceFailure(reason, "CANCELLED"); ensure(!closed, "CANCELLED"); ensure(clock() - start < totalMs && clock() >= start, "TIMEOUT"); }
  async function get(path: string, page?: number): Promise<Observation> {
    check(); ensure(fixed.test(path) && (page === undefined || Number.isSafeInteger(page) && page >= 1 && page <= 64), "CONFIGURATION");
    ensure(++requests <= 512, "LIMIT");
    const observedAt = clock(), requestController = new AbortController(); let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancelRead: (() => void) | undefined, bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const operation = new Promise<Observation>((resolve, reject) => {
      let settled = false;
      const finish = (value?: Observation, error?: unknown) => {
        if (settled) return; settled = true; if (timeout !== undefined) clearTimeout(timeout);
        controller.signal.removeEventListener("abort", cancelRead!);
        if (error) { requestController.abort(); void bodyReader?.cancel().catch(() => {}); reject(error); } else resolve(value!);
      };
      cancelRead = () => finish(undefined, sourceFailure(reason, "CANCELLED"));
      controller.signal.addEventListener("abort", cancelRead, { once: true });
      timeout = setTimeout(() => finish(undefined, new SourceError("TIMEOUT")), readMs);
      void (async () => {
        try {
          check();
          const response = await fetch(MAINNET_SOURCE + path + (page === undefined ? "" : `?count=100&page=${page}&order=asc`), {
            method: "GET", headers: { project_id: projectId, accept: "application/json" }, cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: requestController.signal,
          });
          ensure(!requestController.signal.aborted, "TIMEOUT"); check();
          ensure(!response.redirected && (response.url === "" || response.url === MAINNET_SOURCE + path + (page === undefined ? "" : `?count=100&page=${page}&order=asc`)), "RESPONSE");
          if (response.status !== 200) throw new SourceError(response.status === 401 || response.status === 403 ? "AUTHORIZATION" : response.status === 418 || response.status === 429 ? "QUOTA" : response.status === 404 ? "NOT_FOUND" : "TRANSPORT");
          ensure(/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type") ?? ""), "RESPONSE");
          const length = response.headers.get("content-length");
          ensure(length === null || /^(0|[1-9][0-9]{0,9})$/.test(length) && BigInt(length) <= BigInt(JSON_LIMITS.bytes), "LIMIT");
          ensure(response.body !== null, "RESPONSE"); bodyReader = response.body.getReader();
          let buffer = new Uint8Array(0), size = 0;
          while (true) {
            const result = await bodyReader.read(); if (result.done) break;
            ensure(result.value instanceof Uint8Array, "RESPONSE"); const next = size + result.value.byteLength; ensure(next <= JSON_LIMITS.bytes, "LIMIT");
            if (next > buffer.length) { const grown = new Uint8Array(Math.min(JSON_LIMITS.bytes, Math.max(next, buffer.length * 2, 4096))); grown.set(buffer); buffer = grown; }
            buffer.set(result.value, size); size = next; check();
          }
          // Fetch has already decoded content; Content-Length is only a bounded wire hint.
          const value = parseProviderJson(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size))); check(); ensure(clock() - observedAt < readMs, "TIMEOUT"); finish(Object.freeze({ value, observedAt }));
        } catch (error) { finish(undefined, sourceFailure(reason ?? error, "TRANSPORT")); }
        finally { try { bodyReader?.releaseLock(); } catch { /* An abandoned stream may still be settling. */ } }
      })();
    });
    return operation;
  }
  async function pages(path: string): Promise<Observation> {
    const rows: Json[] = []; let observedAt = 0;
    for (let page = 1; page <= 64; page++) {
      const read = await get(path, page); if (page === 1) observedAt = read.observedAt;
      const part = list(read.value); ensure(part.length <= 100, "RESPONSE"); items += part.length; ensure(items <= 8192, "LIMIT"); rows.push(...part);
      if (part.length < 100) return Object.freeze({ value: Object.freeze(rows), observedAt });
    }
    throw new SourceError("LIMIT");
  }
  function close(): void { if (closed) return; closed = true; clearTimeout(totalTimer); signal?.removeEventListener("abort", cancel); controller.abort(); }
  return Object.freeze({ get, pages, check, clock, close, get requests() { return requests; }, source: MAINNET_SOURCE });
}
/** Only explicit positive required fields can be read; absence is never null. */
export { field };
