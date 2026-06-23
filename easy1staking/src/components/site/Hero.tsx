import { AnniversaryChip } from "./AnniversaryChip";

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[92vh] flex-col justify-center overflow-hidden bg-bg px-6 pb-16 pt-[72px] md:px-16"
    >
      <div aria-hidden className="hero-glow" />

      <div className="relative z-10 mb-12 flex items-center justify-between gap-4 md:mb-20">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mid">
          easy1staking · est. 28.10.2020
        </span>
        <AnniversaryChip />
      </div>

      <h1 className="relative z-10 text-[clamp(64px,9vw,160px)] font-black leading-[0.88] tracking-[-0.055em]">
        <span className="block">Six years.</span>
        <span className="block pl-[0.4em] font-serif font-normal italic tracking-[-0.025em] text-ink-mid">
          One pool.
        </span>
        <span className="block text-gradient">Many projects.</span>
      </h1>

      <div className="relative z-10 mt-12 grid items-end gap-8 md:mt-[72px] md:grid-cols-[1fr_auto_auto] md:gap-16">
        <div className="max-w-[52ch]">
          <p className="text-[18px] leading-[1.55] text-ink-mid">
            A Cardano{" "}
            <strong className="font-semibold text-ink-high">stake pool</strong>,
            a SundaeSwap{" "}
            <strong className="font-semibold text-ink-high">scooper</strong>, a
            Butane{" "}
            <strong className="font-semibold text-ink-high">oracle</strong>, and
            a set of{" "}
            <strong className="font-semibold text-ink-high">
              open-source tools
            </strong>{" "}
            you can actually use. Operated by a builder. Reliable since 2020.
          </p>
          <a
            href="#contribution"
            className="mt-5 inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-low transition-colors hover:text-ink-high"
          >
            Explore the tools <span className="arrow">↓</span>
          </a>
        </div>
        <a href="#delegate" className="btn btn-primary">
          Delegate stake <span className="arrow">→</span>
        </a>
        <a href="#delegate" className="btn btn-secondary">
          Voting power <span className="arrow">→</span>
        </a>
      </div>
    </section>
  );
}
