import "server-only";
import { unstable_cache } from "next/cache";
import { BLOCKFROST_URL, blockfrostProjectId } from "./blockfrost";
import { EASY1_POOL_ID, POOL_MAX_AGE_MS, isCurrentSnapshot, normalizeEpoch, normalizePool, type PoolSnapshot } from "./pool-facts";

const unavailable = (): PoolSnapshot => ({ facts: null, epoch: null, fetchedAt: null });
const REQUEST_TIMEOUT_MS = 10_000;

type Dependencies = {
  projectId: () => string | undefined;
  fetch: typeof fetch;
  now: () => number;
  readShared?: (key: string, bucket: number, load: () => Promise<PoolSnapshot>) => Promise<PoolSnapshot>;
};

/** Deduplicate locally; the production adapter also shares verified bucket entries. */
export function createPoolSnapshotOwner(deps: Dependencies) {
  let cached: { key: string; bucket: number; snapshot: PoolSnapshot } | undefined;
  let pending: { key: string; bucket: number; promise: Promise<PoolSnapshot> } | undefined;
  const bucketAt = (time: number) => Math.floor(time / POOL_MAX_AGE_MS);

  async function read(path: string, key: string) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await deps.fetch(`${BLOCKFROST_URL}/${path}`, {
            headers: { project_id: key }, cache: "no-store", signal: controller.signal,
          });
          if (!response.ok) throw new Error("Pool provider unavailable");
          const raw: unknown = await response.json();
          return { raw, observedAt: deps.now() };
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error("Pool provider timeout")); }, REQUEST_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchSnapshot(key: string, bucket: number): Promise<PoolSnapshot> {
    const [pool, epoch] = await Promise.allSettled([read(`pools/${EASY1_POOL_ID}`, key), read("epochs/latest", key)]);
    if (pool.status !== "fulfilled") return unavailable();
    const facts = normalizePool(pool.value.raw);
    if (!facts || Object.values(facts).every((value) => value === null)) return unavailable();
    const snapshot = { facts, fetchedAt: pool.value.observedAt, epoch: epoch.status === "fulfilled" ? normalizeEpoch(epoch.value.raw) : null };
    if (!isCurrentSnapshot(snapshot, deps.now()) || bucketAt(snapshot.fetchedAt) !== bucket) return unavailable();
    return snapshot;
  }

  async function refresh(key: string, bucket: number): Promise<PoolSnapshot> {
    try {
      // A new bucket always fills from transport, never from a local old response.
      const load = () => fetchSnapshot(key, bucket);
      const snapshot = deps.readShared ? await deps.readShared(key, bucket, load) : await load();
      if (!isCurrentSnapshot(snapshot, deps.now()) || snapshot.fetchedAt === null || bucketAt(snapshot.fetchedAt) !== bucket || bucketAt(deps.now()) !== bucket) return unavailable();
      if (deps.projectId() === key) cached = { key, bucket, snapshot };
      return snapshot;
    } catch {
      return unavailable();
    }
  }

  return async function getSnapshot(): Promise<PoolSnapshot> {
    const key = deps.projectId();
    if (!key) { cached = undefined; return unavailable(); }
    const now = deps.now();
    if (!Number.isSafeInteger(now) || now < 0 || now > 8_640_000_000_000_000) return unavailable();
    const bucket = bucketAt(now);
    if (cached?.key === key && cached.bucket === bucket && isCurrentSnapshot(cached.snapshot, now)) return cached.snapshot;
    cached = undefined;
    if (!pending || pending.key !== key || pending.bucket !== bucket) {
      const entry = { key, bucket, promise: refresh(key, bucket) };
      pending = entry;
      void entry.promise.finally(() => { if (pending === entry) pending = undefined; });
    }
    const snapshot = await pending.promise;
    return deps.projectId() === key && bucketAt(deps.now()) === bucket && isCurrentSnapshot(snapshot, deps.now()) ? snapshot : unavailable();
  };
}

// Route bundles can instantiate modules separately; share one owner across them.
const shared = globalThis as typeof globalThis & { __easy1PoolSnapshotOwner?: ReturnType<typeof createPoolSnapshotOwner> };
shared.__easy1PoolSnapshotOwner ??= createPoolSnapshotOwner({
  projectId: blockfrostProjectId, fetch: (...args) => fetch(...args), now: () => Date.now(),
  readShared: (key, bucket, load) => unstable_cache(async () => {
    const snapshot = await load();
    // Throwing keeps failures out of the successful persistent cache.
    if (!isCurrentSnapshot(snapshot, Date.now())) throw new Error("Pool snapshot unavailable");
    return snapshot;
  }, ["easy1-pool-snapshot-v1", key, String(bucket)], { revalidate: false })(),
});

export async function getPoolSnapshot() {
  const snapshot = await shared.__easy1PoolSnapshotOwner!();
  return { snapshot, renderedAt: Date.now() };
}
