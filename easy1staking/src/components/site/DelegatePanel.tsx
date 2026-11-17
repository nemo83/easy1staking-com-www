"use client";

import { useEffect, useRef, useState } from "react";
import type { DelegationView, createDelegationController } from "@/lib/site/delegation/controller";
import { DISMISSAL_COPY, RETRY_COPY, SUBMIT_COPY } from "@/lib/site/delegation/messages";
import styles from "./EditorialPages.module.css";

type Controller = ReturnType<typeof createDelegationController>;
const busyPhases = ["connecting", "assessing", "building", "review", "signing", "checking", "submitting"];
const accountCopy = { "EASY1": "This stake account currently delegates to EASY1.", "other-pool": "This stake account has since delegated to another pool.",
  "deregistered": "This stake account has since been deregistered.", "undelegated": "This stake account is registered but not currently delegated to a pool." } as const;
function ada(lovelace: string): string {
  const value = BigInt(lovelace);
  return `${value / BigInt(1000000)}.${(value % BigInt(1000000)).toString().padStart(6, "0")} ADA`;
}
export function DelegatePanel() {
  const controller = useRef<Controller | null>(null);
  const [view, setView] = useState<DelegationView | null>(null);
  const [wallets, setWallets] = useState<string[]>([]);
  const [chosen, setChosen] = useState("");
  // The typed attestation is panel-local: the controller sees it only on Confirm.
  const [attestation, setAttestation] = useState("");
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    void import("@/lib/site/delegation/controller").then(({ createDelegationController }) => {
      if (!active) return;
      const instance = createDelegationController(process.env.NEXT_PUBLIC_BLOCKFROST_PROJECT_ID ?? "");
      controller.current = instance;
      const update = () => { if (active) setView(instance.getView()); };
      const unsubscribe = instance.subscribe(update); update();
      dispose = () => { unsubscribe(); instance.dispose(); };
    });
    const detect = () => {
      try {
        const providers = (window as unknown as { cardano?: Record<string, { enable?: unknown }> }).cardano;
        setWallets(Object.keys(providers ?? {}).filter(id => /^[a-zA-Z0-9_-]{1,64}$/.test(id) && typeof providers![id]?.enable === "function"));
      } catch { setWallets([]); }
    };
    detect(); const timer = window.setInterval(detect, 2000);
    return () => { active = false; window.clearInterval(timer); dispose?.(); controller.current = null; };
  }, []);
  const busy = !!view && busyPhases.includes(view.phase);
  const prior = view?.recovery.status !== "absent";
  // A confirmed result keeps its own label whatever the wallet/action phase shows, but only while its ID is the active one; other IDs are labelled by phase.
  const confirmed = view?.confirmation && view.confirmation.txId === view.txId ? view.confirmation : null;
  const dismissed = view?.dismissed && view.dismissed.txId === view.txId ? view.dismissed : null;
  const dialog = view?.dismissal?.stage === "open" || view?.dismissal?.stage === "confirming";
  useEffect(() => { if (!dialog) setAttestation(""); }, [dialog]);
  // Keyboard focus around the dismissal region. When the control holding focus unmounts, focus falls to the page body; it then moves to the
  // attestation input once the region opens, and to the status line once the region closes, whatever closed it. Focus held elsewhere stays.
  const statusLine = useRef<HTMLParagraphElement | null>(null), attestationInput = useRef<HTMLInputElement | null>(null), dialogShown = useRef(false);
  useEffect(() => {
    const opened = dialog && !dialogShown.current, closed = !dialog && dialogShown.current;
    dialogShown.current = dialog;
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (lost && opened) attestationInput.current?.focus();
    else if (lost && closed) statusLine.current?.focus();
  }, [dialog]);
  return <section id="delegate" className={`wrap section ${styles.authored}`} aria-labelledby="delegate-title">
    <div className="eyebrow">Stake-only delegation / staged candidate</div>
    <h2 id="delegate-title">Stake with <em>EASY1.</em></h2>
    <p>Your wallet signs an independently checked mainnet stake delegation. Your voting delegation stays unchanged. Public activation awaits recovery and release checks.</p>
    <div className={styles.notice}>
      <p>On mobile, open this exact page in your wallet’s built-in dApp browser, then select and connect that wallet. A regular browser may have no wallet bridge.</p>
      <p>Wallet browsers, deployments, profiles and devices do not share connections or recovery state. Check an unresolved operation in its originating browser before starting elsewhere.</p>
      {view?.walletBrowseHref && <a className="text-link" href={view.walletBrowseHref}>Open this page in a compatible wallet browser</a>}
    </div>
    <div className={styles.facts}>
      {!view && <p role="status">Preparing wallet controls…</p>}
      {view && <>
        <p role="status" aria-live="polite" aria-atomic="true" tabIndex={-1} ref={statusLine}>{view.message}</p>
        {view.walletDisconnected && <p className="mt-4">Wallet disconnected.</p>}
        {view.account && <div className={styles.poolIdentity}>Connected stake credential<code>{view.account}</code></div>}
        {prior && <p className="mt-4">{DISMISSAL_COPY.priorNotice}</p>}
        {view.txId && view.txId !== confirmed?.txId && view.txId !== dismissed?.txId && <div className={styles.poolIdentity}>Transaction ID — {view.reported ? SUBMIT_COPY.reportedCaption : view.phase === "submitted" ? "submitted, confirmation pending" : "outcome pending or unknown"}<code>{view.txId}</code></div>}
        {confirmed && <div className="mt-4" role="region" aria-label="Delegation confirmation">
          <div className={styles.poolIdentity}>Transaction ID — confirmed on chain<code>{confirmed.txId}</code></div>
          {view.message !== confirmed.message && <p>{confirmed.message}</p>}
          <div className={styles.poolIdentity}>Stake credential in this transaction<code>{confirmed.credential}</code></div>
          <p>{accountCopy[confirmed.account]}</p>
        </div>}
        {dismissed && <div className="mt-4" role="region" aria-label={DISMISSAL_COPY.dismissedRegion}>
          <div className={styles.poolIdentity}>{DISMISSAL_COPY.dismissedCaption}<code>{dismissed.txId}</code></div>
        </div>}
        {view.statusRunning && <p className="mt-4">Checking the chain for this transaction. This uses read-only chain data, never your wallet.</p>}
        {view.canCheckStatus && !busy && <button type="button" className="btn btn-primary mt-6" onClick={() => { void controller.current?.checkStatus(); }}>Check status</button>}
        {view.canRetry && !busy && <>
          <p className="mt-4">{RETRY_COPY.note}</p>
          <button type="button" className="btn btn-primary mt-6 whitespace-normal" onClick={() => { void controller.current?.retry(); }}>{RETRY_COPY.offer}</button>
        </>}
        {view.dismissal?.stage === "offered" && <button type="button" className="btn btn-primary mt-6" onClick={() => { if (view.dismissal) controller.current?.openDismissal(view.dismissal); }}>{DISMISSAL_COPY.offer}</button>}
        {view.dismissal && dialog && <div className="mt-6" role="region" aria-label={DISMISSAL_COPY.region}>
          <p>{DISMISSAL_COPY.disclosure}</p>
          {view.dismissal.spentElsewhere && <p>{DISMISSAL_COPY.spentElsewhere}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label htmlFor="dismiss-attestation">{DISMISSAL_COPY.attestationLabel}</label>
            <input id="dismiss-attestation" ref={attestationInput} type="text" autoComplete="off" value={attestation} onChange={event => setAttestation(event.target.value)} className="max-w-full rounded border border-line bg-bg p-3" />
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <button type="button" className="btn btn-primary" disabled={attestation !== DISMISSAL_COPY.attestationPhrase || view.dismissal.stage !== "open"}
              onClick={() => { if (view.dismissal) void controller.current?.confirmDismissal(view.dismissal, attestation); }}>{DISMISSAL_COPY.confirm}</button>
            <button type="button" className="text-link" onClick={() => { if (view.dismissal) controller.current?.closeDismissal(view.dismissal); }}>{DISMISSAL_COPY.keep}</button>
          </div>
        </div>}
        {!busy && !prior && <div className="mt-6 flex flex-wrap items-center gap-3">
          <label htmlFor="wallet-choice">Wallet</label>
          <select id="wallet-choice" value={chosen} onChange={event => setChosen(event.target.value)} className="max-w-full rounded border border-line bg-bg p-3">
            <option value="">Choose a wallet</option>{wallets.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
          <button type="button" className="btn btn-primary" disabled={!chosen} onClick={() => { void controller.current?.connect(chosen); }}>Connect selected wallet</button>
          {wallets.length === 0 && <p>No CIP-30 wallet detected. Open your wallet browser or install a compatible extension, then return here.</p>}
        </div>}
        {view.phase === "ready" && !prior && <button type="button" className="btn btn-primary mt-6" onClick={() => { void controller.current?.prepare(); }}>Build delegation review</button>}
        {view.review && <div className="mt-6" role="region" aria-label="Delegation review">
          <h3>Review stake delegation</h3>
          <div className={styles.poolIdentity}>Account<code>{view.review.account}</code>EASY1 pool ID<code>{view.review.poolId}</code></div>
          <p>Exact fee: {ada(view.review.fee)}</p>
          <p>Separate registration deposit: {ada(view.review.deposit)}</p>
          <p>Review expires: <time dateTime={new Date(view.review.expiresAt).toISOString()}>{new Date(view.review.expiresAt).toISOString()}</time></p>
          <p>This transaction changes only stake delegation to EASY1.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => { if (view.review) controller.current?.approve(view.review); }}>Approve and sign in wallet</button>
        </div>}
        <div className="mt-6 flex flex-wrap gap-4">
          {busy && <button type="button" className="text-link" onClick={() => controller.current?.cancel()}>Cancel here</button>}
          {view.walletId && <button type="button" className="text-link" onClick={() => controller.current?.disconnect()}>Disconnect wallet</button>}
        </div>
      </>}
    </div>
    <p>Recovery is saved only in this browser while its storage is retained. Browser coordination cannot prevent actions in other apps, origins or devices. If storage or Web Locks are unavailable, use your wallet directly.</p>
  </section>;
}
