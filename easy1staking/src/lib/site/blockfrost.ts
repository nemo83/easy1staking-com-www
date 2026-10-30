/**
 * Fixed mainnet provider. The public project identifier is shared with browser
 * reads; operators must provision it for public use and monitor/revoke it.
 */
export const BLOCKFROST_URL = "https://cardano-mainnet.blockfrost.io/api/v0";

export function blockfrostProjectId(): string | undefined {
  // Keep this static reference: Next inlines public browser configuration at build time.
  return process.env.NEXT_PUBLIC_BLOCKFROST_PROJECT_ID;
}

/** GET a Blockfrost endpoint. A 404 is index absence, not proof of chain state. */
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
