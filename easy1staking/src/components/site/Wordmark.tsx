export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <a
      href="#top"
      className={`flex items-center gap-2.5 text-[17px] font-bold tracking-tight ${className}`}
    >
      <span className="grid h-7 w-7 place-items-center rounded-box-sm bg-grad-signature font-mono text-[12px] font-bold text-white">
        e1
      </span>
      <span>
        easy1<span className="font-normal text-ink-mid">staking</span>
      </span>
    </a>
  );
}
