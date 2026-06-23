"use client";

import { useEffect, useState } from "react";

/**
 * "Extra rewards" you'd unlock by delegating to easy1 — surfaced inside the
 * delegate flow when the connected wallet is NOT already with easy1. Data comes
 * from the operator's own API (api.easy1staking.com/extra_rewards), keyed by
 * stake address. Mesh-free port of the legacy AirdropEligibilityTable, restyled
 * to the site's dark design language.
 */

type ExtraReward = {
  symbol: string;
  amount: number;
  dollar_value: number;
  logo?: string;
  description?: string;
};

const EXTRA_REWARDS_API = "https://api.easy1staking.com/extra_rewards";

export function ExtraRewardsTable({ stakeAddress }: { stakeAddress: string }) {
  const [rewards, setRewards] = useState<ExtraReward[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${EXTRA_REWARDS_API}?stake_address=${encodeURIComponent(stakeAddress)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: ExtraReward[]) => {
        if (!cancelled) setRewards(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRewards([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stakeAddress]);

  // Stay invisible until we have something worth showing — this is a bonus
  // pitch, not a core control, so it should never show an error or empty state.
  if (loading || !rewards || rewards.length === 0) return null;

  const totalUsd = rewards.reduce((sum, r) => sum + (r.dollar_value || 0), 0);

  return (
    <div className="rounded-box-sm border border-[rgba(6,214,160,0.25)] bg-[rgba(6,214,160,0.05)] p-5">
      <div className="mb-1 flex items-center gap-2">
        <span aria-hidden>🎁</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-teal">
          Bonus — unlocked by delegating to easy1
        </span>
      </div>
      <p className="mb-4 max-w-[52ch] text-[13px] text-ink-mid">
        Extra tokens you&#39;d become eligible for as an easy1 delegator,
        claimable on{" "}
        <a
          href="https://tosidrop.me/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-teal hover:underline"
        >
          TosiDrop
        </a>
        .
      </p>

      <div className="flex flex-col divide-y divide-line">
        {rewards.map((r, i) => (
          <div key={`${r.symbol}-${i}`} className="flex items-center gap-3 py-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.logo || "/Coin.png"}
              alt=""
              className="h-7 w-7 rounded-full bg-surface-2 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink-high">
                {r.symbol}
              </div>
              {r.description && (
                <div className="truncate text-[11px] text-ink-low">
                  {r.description}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-mono text-[14px] text-ink-high">
                {r.amount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="font-mono text-[11px] text-brand-teal">
                ${r.dollar_value.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[12px] text-ink-low">
          Estimated value per epoch
        </span>
        <span className="font-mono text-[14px] text-brand-teal">
          ${totalUsd.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
