import { siteConfig } from "./config";
import {
  poolStatMeta,
  samplePoolStats,
  sampleEpochLabel,
  STAT_ORDER,
  type PoolStat,
} from "./projects";

/**
 * Blockfrost is the single data provider for the site — pool stats (server),
 * wallet assessment (browser), and Evolution SDK tx building (browser) all go
 * through it. One provider, one key. The project id is public by design
 * (NEXT_PUBLIC_*): Blockfrost keys are rate-limit-scoped, not billing-attached,
 * and browser dApps are their intended use. Koios was dropped because its
 * keyless public tier blocks CORS, so browser calls can't use it anyway.
 */
export const BLOCKFROST_URL = "https://cardano-mainnet.blockfrost.io/api/v0";

export function blockfrostProjectId(): string | undefined {
  return process.env.NEXT_PUBLIC_BLOCKFROST_PROJECT_ID;
}

/** GET a Blockfrost endpoint. Returns null on 404 (entity never seen on chain). */
export async function bfGet<T>(
  path: string,
  opts?: { revalidate?: number },
): Promise<T | null> {
  const projectId = blockfrostProjectId();
  if (!projectId) {
    throw new Error(
      "Blockfrost project id is not configured (NEXT_PUBLIC_BLOCKFROST_PROJECT_ID).",
    );
  }
  const res = await fetch(`${BLOCKFROST_URL}/${path}`, {
    headers: { project_id: projectId },
    ...(opts?.revalidate ? { next: { revalidate: opts.revalidate } } : {}),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Blockfrost ${path} ${res.status}`);
  return (await res.json()) as T;
}

const REVALIDATE_SECONDS = 300;

type BfPool = {
  blocks_minted: number | null;
  live_stake: string | null; // lovelace
  live_saturation: number | null; // ratio 0..1 (Koios returned a percentage!)
  live_delegators: number | null;
  declared_pledge: string | null; // lovelace
  live_pledge: string | null; // lovelace
  margin_cost: number | null; // ratio 0..1
  fixed_cost: string | null; // lovelace
};

function lovelaceToAda(lovelace: string | null): number {
  if (!lovelace) return 0;
  return Number(lovelace) / 1_000_000;
}

/** Compact ADA: 33.4M ₳ / 200K ₳ / 950 ₳ */
function formatAda(lovelace: string | null): { value: string; unit: string } {
  const ada = lovelaceToAda(lovelace);
  if (ada >= 1_000_000) return { value: (ada / 1_000_000).toFixed(1), unit: "M ₳" };
  if (ada >= 1_000) return { value: Math.round(ada / 1_000).toString(), unit: "K ₳" };
  return { value: Math.round(ada).toString(), unit: "₳" };
}

function formatCount(n: number | null): string {
  return (n ?? 0).toLocaleString("en-US");
}

export type PoolStatsResult = {
  stats: PoolStat[];
  epochLabel: string;
  live: boolean;
};

function fallback(): PoolStatsResult {
  return { stats: samplePoolStats, epochLabel: sampleEpochLabel, live: false };
}

/**
 * Fetched server-side and cached; this is a marketing site, so a few minutes
 * of staleness is fine. Falls back to sample data when no Blockfrost key is
 * configured or the API is unreachable — the strip always renders.
 */
export async function getPoolStats(): Promise<PoolStatsResult> {
  if (!blockfrostProjectId()) return fallback();

  try {
    const [pool, epochData] = await Promise.all([
      bfGet<BfPool>(`pools/${siteConfig.pool.id}`, {
        revalidate: REVALIDATE_SECONDS,
      }),
      bfGet<{ epoch: number }>("epochs/latest", {
        revalidate: REVALIDATE_SECONDS,
      }),
    ]);
    if (!pool) return fallback();

    const liveStake = formatAda(pool.live_stake);
    // declared pledge (the committed amount), not live_pledge (actual locked)
    const pledge = formatAda(pool.declared_pledge ?? pool.live_pledge);
    const marginPct =
      pool.margin_cost == null
        ? "0"
        : Math.round(pool.margin_cost * 1000) / 10 + "";
    const fixedAda = Math.round(lovelaceToAda(pool.fixed_cost));
    const saturationPct =
      pool.live_saturation == null
        ? "—"
        : (pool.live_saturation * 100).toFixed(1);

    const valueByKey: Record<string, { value: string; unit?: string }> = {
      saturation: { value: saturationPct, unit: "%" },
      blocks: { value: formatCount(pool.blocks_minted) },
      delegators: { value: formatCount(pool.live_delegators) },
      liveStake: liveStake,
      pledge: pledge,
      marginFixed: { value: marginPct, unit: `% · ${fixedAda}₳` },
    };

    const stats: PoolStat[] = STAT_ORDER.map((key) => ({
      label: poolStatMeta[key].label,
      spin: poolStatMeta[key].spin,
      ...valueByKey[key],
    }));

    const epoch = epochData?.epoch;
    return {
      stats,
      epochLabel: epoch ? `epoch ${epoch} · live` : "live",
      live: true,
    };
  } catch {
    return fallback();
  }
}
