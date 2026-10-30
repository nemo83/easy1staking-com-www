export const EASY1_POOL_ID = "pool1yr0cv3dtmhcfgqa6yetvmf769ngk89e6tepecmjrmjl2jzcw2lm";
export const EASY1_POOL_HEX = "20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9";
export const POOL_MAX_AGE_MS = 300_000;

export type PoolFacts = {
  activeStake: string | null;
  saturation: string | null;
  blocks: string | null;
  margin: string | null;
  fixedCost: string | null;
};

export type PoolSnapshot = {
  facts: PoolFacts | null;
  epoch: number | null;
  fetchedAt: number | null;
};

export function isCurrentSnapshot(snapshot: PoolSnapshot, now: number): boolean {
  if (snapshot.facts === null || snapshot.fetchedAt === null) return false;
  const age = now - snapshot.fetchedAt;
  return Number.isSafeInteger(now) && Number.isSafeInteger(snapshot.fetchedAt) && snapshot.fetchedAt >= 0 && now <= 8_640_000_000_000_000 && age >= 0 && age < POOL_MAX_AGE_MS;
}

function record(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

/** Keep all six lovelace decimals without passing currency through Number. */
export function formatLovelace(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const value = BigInt(raw);
  const whole = (value / BigInt(1_000_000)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (value % BigInt(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function percent(raw: unknown, maximum = Infinity): string | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > maximum) return null;
  // Decimal shifting avoids overflow and floating point multiplication artefacts.
  const [coefficient, exponent = "0"] = raw.toString().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = whole + fraction;
  const point = whole.length + Number(exponent) + 2;
  const shifted = point <= 0 ? `0.${"0".repeat(-point)}${digits}`
    : point >= digits.length ? digits + "0".repeat(point - digits.length)
      : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return shifted.replace(/^0+(?=\d)/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function normalizePool(raw: unknown): PoolFacts | null {
  if (!record(raw) || raw.pool_id !== EASY1_POOL_ID || raw.hex !== EASY1_POOL_HEX) return null;
  return {
    activeStake: formatLovelace(raw.active_stake),
    saturation: percent(raw.live_saturation),
    blocks: typeof raw.blocks_minted === "number" && Number.isSafeInteger(raw.blocks_minted) && raw.blocks_minted >= 0
      ? raw.blocks_minted.toLocaleString("en-US") : null,
    margin: percent(raw.margin_cost, 1),
    fixedCost: formatLovelace(raw.fixed_cost),
  };
}

export function normalizeEpoch(raw: unknown): number | null {
  return record(raw) && typeof raw.epoch === "number" && Number.isSafeInteger(raw.epoch) && raw.epoch >= 0 ? raw.epoch : null;
}
