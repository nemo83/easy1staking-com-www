import { siteConfig } from "./config";
import { bech32Encode, hexToBytes } from "./bech32";
import { BLOCKFROST_URL, blockfrostProjectId, bfGet } from "./blockfrost";

/**
 * Client-side staking assessment + delegation execution.
 *
 * Architecture: fully client-side, no backend. Everything goes through
 * Blockfrost — assessment reads `/accounts/{stake}`, delegation builds/signs/
 * submits via Evolution SDK with `withBlockfrost` + the connected CIP-30
 * wallet (`withCip30`). The project id is exposed to the browser by design
 * (rate-limit-scoped, the intended dApp pattern).
 *
 * Evolution SDK is heavy (WASM) — it's dynamically imported only inside
 * `executeDelegation`, so connecting + assessing never pays that cost.
 */

const POOL = siteConfig.pool.id;

/**
 * Blockfrost `/accounts` returns the CIP-105 DRep id (bech32 of the raw key
 * hash); our config stores the CIP-129 form. Compute the CIP-105 form from the
 * key hash and accept either, so a future Blockfrost format change is a no-op.
 */
const DREP_CIP129 = siteConfig.governance.drepId;
const DREP_CIP105 = bech32Encode(
  "drep",
  hexToBytes(siteConfig.governance.drepIdHex),
);

export type StakeAxis =
  | { kind: "easy1" } // already delegating to easy1
  | { kind: "other"; pool: string; marginPct: number | null } // another pool
  | { kind: "none" }; // unregistered or undelegated — "all bonus"

export type VoteAxis =
  | { kind: "ours" } // already delegating voting power to our DRep
  | { kind: "other"; drep: string } // another DRep (incl. abstain/no-confidence)
  | { kind: "none" }; // voting power idle

export type Assessment = {
  registered: boolean;
  stake: StakeAxis;
  vote: VoteAxis;
  rewardsAvailableAda: number;
  stakeBalanceAda: number;
};

type BfAccount = {
  active: boolean;
  registered?: boolean;
  pool_id: string | null;
  drep_id: string | null;
  withdrawable_amount: string | null;
  controlled_amount: string | null;
};

/** Assess a connected wallet's stake address against the easy1 pool + DRep. */
export async function assess(stakeAddress: string): Promise<Assessment> {
  // 404 = the stake address has never appeared on chain — brand-new wallet
  const acct = await bfGet<BfAccount>(`accounts/${stakeAddress}`);
  if (!acct) {
    return {
      registered: false,
      stake: { kind: "none" },
      vote: { kind: "none" },
      rewardsAvailableAda: 0,
      stakeBalanceAda: 0,
    };
  }

  const registered = acct.registered ?? acct.active;
  const delegatedPool = acct.pool_id;
  const delegatedDrep = acct.drep_id;

  // STAKE axis
  let stake: StakeAxis;
  if (delegatedPool === POOL) {
    stake = { kind: "easy1" };
  } else if (delegatedPool) {
    let marginPct: number | null = null;
    try {
      const pool = await bfGet<{ margin_cost: number | null }>(
        `pools/${delegatedPool}`,
      );
      const m = pool?.margin_cost;
      marginPct = m == null ? null : Math.round(m * 1000) / 10;
    } catch {
      // comparison is a bonus; degrade gracefully if the pool lookup fails
    }
    stake = { kind: "other", pool: delegatedPool, marginPct };
  } else {
    stake = { kind: "none" };
  }

  // VOTING-POWER axis
  let vote: VoteAxis;
  if (delegatedDrep === DREP_CIP105 || delegatedDrep === DREP_CIP129) {
    vote = { kind: "ours" };
  } else if (delegatedDrep) {
    // abstain / no-confidence count as "delegated elsewhere" for our pitch
    vote = { kind: "other", drep: delegatedDrep };
  } else {
    vote = { kind: "none" };
  }

  return {
    registered,
    stake,
    vote,
    rewardsAvailableAda: Number(acct.withdrawable_amount ?? 0) / 1_000_000,
    stakeBalanceAda: Number(acct.controlled_amount ?? 0) / 1_000_000,
  };
}

export type DelegateAction = "stake" | "vote";

/**
 * Build, sign, and submit a delegation transaction with the connected CIP-30
 * wallet. Picks the combined register+delegate cert when the stake key isn't
 * registered yet (saves a separate registration tx + deposit handling).
 * Returns the submitted transaction hash.
 */
export async function executeDelegation(
  walletApi: unknown,
  action: DelegateAction,
  registered: boolean,
): Promise<string> {
  const projectId = blockfrostProjectId();
  if (!projectId) {
    throw new Error(
      "Blockfrost project id is not configured (NEXT_PUBLIC_BLOCKFROST_PROJECT_ID).",
    );
  }

  const { Client, mainnet, PoolKeyHash, KeyHash, DRep } = await import(
    "@evolution-sdk/evolution"
  );

  const readClient = Client.make(mainnet).withBlockfrost({
    baseUrl: BLOCKFROST_URL,
    projectId,
  });
  // walletApi is `unknown` (a CIP-30 handle); cast to the exact param type the
  // SDK expects rather than `any`, so no eslint-disable is needed.
  const client = readClient.withCip30(
    walletApi as Parameters<typeof readClient.withCip30>[0],
  );

  const address = await client.address();
  const stakeCredential = address.stakingCredential;
  if (!stakeCredential) {
    throw new Error("This wallet has no staking credential.");
  }

  let builder = client.newTx();

  if (action === "stake") {
    const poolKeyHash = PoolKeyHash.fromBech32(POOL);
    builder = registered
      ? builder.delegateToPool({ stakeCredential, poolKeyHash })
      : builder.registerAndDelegateTo({ stakeCredential, poolKeyHash });
  } else {
    const drep = DRep.fromKeyHash(KeyHash.fromHex(siteConfig.governance.drepIdHex));
    builder = registered
      ? builder.delegateToDRep({ stakeCredential, drep })
      : builder.registerAndDelegateTo({ stakeCredential, drep });
  }

  const tx = await builder.build();
  const signed = await tx.sign();
  const txHash = await signed.submit();
  // submit() returns a TransactionHash class; .toJSON().hash is the hex string
  return txHash.toJSON().hash;
}
