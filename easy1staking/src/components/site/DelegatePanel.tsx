"use client";

import { useEffect, useState } from "react";
import { rewardHexToStakeAddress } from "@/lib/site/bech32";
import { ExtraRewardsTable } from "./ExtraRewardsTable";
import {
  assess,
  executeDelegation,
  type Assessment,
  type DelegateAction,
} from "@/lib/site/staking";

type Cip30 = {
  enable: () => Promise<WalletApi>;
  name?: string;
  icon?: string;
  apiVersion?: string;
};
type WalletApi = {
  getNetworkId: () => Promise<number>;
  getRewardAddresses: () => Promise<string[]>;
};
type DetectedWallet = { key: string; name: string; icon?: string };

function shorten(addr: string, head = 10, tail = 6) {
  return addr.length > head + tail
    ? `${addr.slice(0, head)}…${addr.slice(-tail)}`
    : addr;
}

function detectWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];
  const cardano = (window as unknown as { cardano?: Record<string, Cip30> })
    .cardano;
  if (!cardano) return [];
  return Object.keys(cardano)
    .filter((k) => typeof cardano[k]?.enable === "function")
    .map((k) => ({ key: k, name: cardano[k].name ?? k, icon: cardano[k].icon }))
    // de-dupe by display name
    .filter((w, i, arr) => arr.findIndex((x) => x.name === w.name) === i);
}

type Status =
  | { kind: "idle" }
  | { kind: "busy"; msg: string }
  | { kind: "error"; msg: string }
  | { kind: "done"; txHash: string };

export function DelegatePanel() {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [api, setApi] = useState<WalletApi | null>(null);
  const [stakeAddress, setStakeAddress] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    setWallets(detectWallets());
  }, []);

  async function connect(walletKey: string) {
    setConnecting(true);
    setStatus({ kind: "idle" });
    try {
      const cardano = (window as unknown as { cardano: Record<string, Cip30> })
        .cardano;
      const walletApi = await cardano[walletKey].enable();
      const networkId = await walletApi.getNetworkId();
      if (networkId !== 1) {
        throw new Error("Please switch your wallet to Cardano mainnet.");
      }
      const rewardHexes = await walletApi.getRewardAddresses();
      const hex = rewardHexes?.[0];
      if (!hex) throw new Error("No stake address found in this wallet.");
      const stake = rewardHexToStakeAddress(hex);
      setApi(walletApi);
      setStakeAddress(stake);
      setAssessment(await assess(stake));
    } catch (e) {
      setStatus({ kind: "error", msg: errMsg(e) });
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    setApi(null);
    setStakeAddress(null);
    setAssessment(null);
    setStatus({ kind: "idle" });
  }

  async function delegate(action: DelegateAction) {
    if (!api || !assessment) return;
    setStatus({
      kind: "busy",
      msg: "Building transaction — approve in your wallet…",
    });
    try {
      const txHash = await executeDelegation(api, action, assessment.registered);
      setStatus({ kind: "done", txHash });
      if (stakeAddress) setAssessment(await assess(stakeAddress)); // refresh
    } catch (e) {
      setStatus({ kind: "error", msg: errMsg(e) });
    }
  }

  const busy = status.kind === "busy";

  return (
    <section
      id="delegate"
      className="scroll-mt-16 bg-bg px-6 py-20 md:px-16"
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="text-[clamp(28px,3.5vw,44px)] font-extrabold tracking-[-0.03em]">
          Stake with easy1.
        </h2>
        <p className="mt-3 max-w-[52ch] text-[16px] text-ink-mid">
          Connect your wallet to see where you stand — and what you&#39;re
          leaving on the table. 0% margin means it&#39;s all upside.
        </p>

        <div className="mt-8 rounded-box-lg border border-line bg-surface p-6 md:p-8">
          {!api ? (
            <ConnectView
              wallets={wallets}
              connecting={connecting}
              onConnect={connect}
            />
          ) : (
            <ConnectedView
              stakeAddress={stakeAddress!}
              assessment={assessment}
              busy={busy}
              onDelegate={delegate}
              onDisconnect={disconnect}
            />
          )}

          <StatusLine status={status} />
        </div>
      </div>
    </section>
  );
}

function ConnectView({
  wallets,
  connecting,
  onConnect,
}: {
  wallets: DetectedWallet[];
  connecting: boolean;
  onConnect: (key: string) => void;
}) {
  if (wallets.length === 0) {
    return (
      <div className="text-[14px] text-ink-mid">
        No Cardano wallet detected. Install{" "}
        <a
          href="https://eternl.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-teal hover:underline"
        >
          Eternl
        </a>
        ,{" "}
        <a
          href="https://www.lace.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-teal hover:underline"
        >
          Lace
        </a>
        , or another CIP-30 wallet, then refresh.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-low">
        Connect a wallet
      </div>
      <div className="flex flex-wrap gap-2">
        {wallets.map((w) => (
          <button
            key={w.key}
            disabled={connecting}
            onClick={() => onConnect(w.key)}
            className="flex items-center gap-2.5 rounded-box-sm border border-line-strong bg-surface-2 px-4 py-3 text-[14px] font-semibold capitalize transition hover:border-brand hover:bg-surface-3 disabled:opacity-50"
          >
            {w.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.icon} alt="" className="h-5 w-5 rounded" />
            )}
            {w.name}
          </button>
        ))}
      </div>
      {connecting && (
        <div className="mt-4 text-[13px] text-ink-mid">Connecting…</div>
      )}
    </div>
  );
}

function ConnectedView({
  stakeAddress,
  assessment,
  busy,
  onDelegate,
  onDisconnect,
}: {
  stakeAddress: string;
  assessment: Assessment | null;
  busy: boolean;
  onDelegate: (action: DelegateAction) => void;
  onDisconnect: () => void;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <span className="font-mono text-[12px] text-ink-mid">
          {shorten(stakeAddress)}
        </span>
        <button
          onClick={onDisconnect}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-low transition hover:text-ink-high"
        >
          Disconnect
        </button>
      </div>

      {!assessment ? (
        <div className="text-[14px] text-ink-mid">Assessing your wallet…</div>
      ) : (
        <div className="flex flex-col gap-6">
          <StakeAxisView
            assessment={assessment}
            busy={busy}
            onDelegate={() => onDelegate("stake")}
          />
          <div className="h-px bg-line" />
          <VoteAxisView
            assessment={assessment}
            busy={busy}
            onDelegate={() => onDelegate("vote")}
          />
          {assessment.stake.kind !== "easy1" && (
            <ExtraRewardsTable stakeAddress={stakeAddress} />
          )}
        </div>
      )}
    </div>
  );
}

function AxisHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-low">
      {children}
    </div>
  );
}

function ActionButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="btn btn-primary mt-3 px-4 py-2.5 text-[14px] disabled:opacity-50"
    >
      {label} <span className="arrow">→</span>
    </button>
  );
}

function StakeAxisView({
  assessment,
  busy,
  onDelegate,
}: {
  assessment: Assessment;
  busy: boolean;
  onDelegate: () => void;
}) {
  const { stake } = assessment;
  return (
    <div>
      <AxisHeading>Stake</AxisHeading>
      {stake.kind === "easy1" ? (
        <p className="text-[15px] text-ink-high">
          <span className="text-brand-teal">✓</span> You&#39;re delegating to
          easy1 — thank you.
          {assessment.rewardsAvailableAda > 0 && (
            <span className="text-ink-mid">
              {" "}
              {assessment.rewardsAvailableAda.toFixed(1)} ₳ rewards available.
            </span>
          )}
        </p>
      ) : stake.kind === "other" ? (
        <>
          <p className="text-[15px] text-ink-high">
            You&#39;re with{" "}
            <span className="font-mono text-ink-mid">
              {shorten(stake.pool, 10, 4)}
            </span>
            {stake.marginPct != null && (
              <>
                {" "}
                at <span className="text-ink-high">{stake.marginPct}%</span>{" "}
                margin
              </>
            )}
            . easy1 charges <span className="text-brand-teal">0%</span> — more
            rewards to you.
          </p>
          <ActionButton label="Switch to easy1" busy={busy} onClick={onDelegate} />
        </>
      ) : (
        <>
          <p className="text-[15px] text-ink-high">
            You&#39;re earning <span className="text-brand-magenta">0</span>{" "}
            staking rewards right now. Delegate to easy1 — 0% margin, it&#39;s
            all upside.
          </p>
          <ActionButton label="Delegate stake" busy={busy} onClick={onDelegate} />
        </>
      )}
    </div>
  );
}

function VoteAxisView({
  assessment,
  busy,
  onDelegate,
}: {
  assessment: Assessment;
  busy: boolean;
  onDelegate: () => void;
}) {
  const { vote } = assessment;
  return (
    <div>
      <AxisHeading>Voting power</AxisHeading>
      {vote.kind === "ours" ? (
        <p className="text-[15px] text-ink-high">
          <span className="text-brand-teal">✓</span> Your voting power is with
          the easy1 DRep.
        </p>
      ) : vote.kind === "other" ? (
        <>
          <p className="text-[15px] text-ink-high">
            Your voting power is delegated elsewhere. Move it to the easy1 DRep
            to back the roadmap.
          </p>
          <ActionButton
            label="Delegate voting power"
            busy={busy}
            onClick={onDelegate}
          />
        </>
      ) : (
        <>
          <p className="text-[15px] text-ink-high">
            Your vote is idle — not delegated to any DRep. Put it to work with
            the easy1 DRep.
          </p>
          <ActionButton
            label="Delegate voting power"
            busy={busy}
            onClick={onDelegate}
          />
        </>
      )}
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  if (status.kind === "busy") {
    return (
      <div className="mt-6 rounded-box-sm border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-mid">
        {status.msg}
      </div>
    );
  }
  if (status.kind === "error") {
    return (
      <div className="mt-6 rounded-box-sm border border-[rgba(247,37,133,0.35)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-[13px] text-brand-magenta">
        {status.msg}
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-box-sm border border-[rgba(6,214,160,0.35)] bg-[rgba(6,214,160,0.08)] px-4 py-3 text-[13px] text-brand-teal">
      ✓ Submitted!{" "}
      <a
        href={`https://cardanoscan.io/transaction/${status.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono underline"
      >
        {shorten(status.txHash, 10, 6)}
      </a>
    </div>
  );
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object") {
    // CIP-30 user-rejection
    const code = (e as { code?: number }).code;
    if (code === 2) return "Connection request was rejected.";
    const info = (e as { info?: string }).info;
    if (info) return info;
    const message = (e as { message?: string }).message;
    if (message) return message;
  }
  return "Something went wrong. Please try again.";
}
