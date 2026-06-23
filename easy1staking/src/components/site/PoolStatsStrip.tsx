import { getPoolStats } from "@/lib/site/blockfrost";

export async function PoolStatsStrip() {
  const { stats, epochLabel, live } = await getPoolStats();

  return (
    <section
      id="pool"
      className="relative scroll-mt-16 border-y border-line bg-bg-deep py-14"
    >
      <div className="flex items-center justify-between px-6 pb-8 md:px-16">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-low">
          <span className={live ? "live-dot" : "h-2 w-2 rounded-full bg-ink-faint"} />
          easy1 · {live ? "live pool stats" : "pool stats"}
        </div>
        <div className="font-mono text-[11px] text-ink-low">{epochLabel}</div>
      </div>

      <div className="grid grid-cols-2 gap-y-10 px-6 md:grid-cols-3 md:px-16 lg:grid-cols-6 lg:gap-y-0">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`px-6 first:pl-0 lg:border-r lg:border-line lg:last:border-r-0 ${
              i === 0 ? "lg:pl-0" : ""
            }`}
          >
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-low">
              {stat.label}
            </div>
            <div className="font-mono text-[32px] leading-none tracking-[-0.02em] text-ink-high">
              {stat.value}
              {stat.unit && (
                <span className="ml-1 text-[14px] text-ink-low">
                  {stat.unit}
                </span>
              )}
            </div>
            <div className="mt-2.5 max-w-[20ch] text-[11px] leading-[1.4] text-ink-mid">
              {stat.spin}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
