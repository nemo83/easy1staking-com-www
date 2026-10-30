"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isCurrentSnapshot, POOL_MAX_AGE_MS, type PoolSnapshot } from "@/lib/site/pool-facts";

export function PoolFacts({ snapshot, renderedAt }: { snapshot: PoolSnapshot; renderedAt: number }) {
  const router = useRouter();
  const [now, setNow] = useState(renderedAt);
  const [refreshing, startTransition] = useTransition();
  useEffect(() => {
    let lastRefresh = Date.now();
    const check = () => {
      const time = Date.now();
      setNow(time);
      if (document.visibilityState === "visible" && (time - lastRefresh >= 30_000 || time < lastRefresh)) {
        lastRefresh = time;
        startTransition(() => router.refresh());
      }
    };
    check();
    const interval = setInterval(check, 1_000);
    const remaining = snapshot.fetchedAt === null ? 0 : snapshot.fetchedAt + POOL_MAX_AGE_MS - Date.now();
    const expiry = setTimeout(check, Math.max(0, Math.min(POOL_MAX_AGE_MS, remaining)));
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(interval); clearTimeout(expiry); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [snapshot, router]);

  const current = isCurrentSnapshot(snapshot, now);
  const facts = current ? snapshot.facts : null;
  const unknown = <><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></>;
  return <div className="pool-data" aria-busy={refreshing}>
    <div className="pool-id"><Image src="/brand/assets/easy1-symbol-colour-dark.svg" alt="" width={38} height={38} /><div><span>Stake pool</span><strong>EASY1</strong></div></div>
    <dl>
      <div style={{ minWidth: 0 }}><dt>Active stake</dt><dd style={{ overflowWrap: "anywhere" }}>{facts?.activeStake ?? unknown}<small style={{ whiteSpace: "nowrap" }}>ADA</small></dd></div>
      <div style={{ minWidth: 0 }}><dt>Pool saturation</dt><dd style={{ overflowWrap: "anywhere" }}>{facts?.saturation ?? unknown}<small style={{ whiteSpace: "nowrap" }}>%</small></dd></div>
      <div style={{ minWidth: 0 }}><dt>Lifetime blocks</dt><dd style={{ overflowWrap: "anywhere" }}>{facts?.blocks ?? unknown}</dd></div>
      <div style={{ minWidth: 0 }}><dt>Margin / fixed cost</dt><dd style={{ overflowWrap: "anywhere" }}>{facts?.margin ?? unknown}<small style={{ whiteSpace: "nowrap" }}>% / </small>{facts?.fixedCost ?? unknown}<small style={{ whiteSpace: "nowrap" }}>ADA</small></dd></div>
    </dl>
    <p className="data-note">{current && snapshot.fetchedAt !== null ? <>Observed <time dateTime={new Date(snapshot.fetchedAt).toISOString()}>{new Date(snapshot.fetchedAt).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}</time>. {snapshot.epoch === null ? "Epoch unavailable." : `Epoch ${snapshot.epoch}.`} Unavailable fields show —. Snapshots expire after five minutes.</> : "Live pool data is unavailable. Figures are unknown."}</p>
  </div>;
}
