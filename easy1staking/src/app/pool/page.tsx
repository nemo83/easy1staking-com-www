import { PoolFacts } from "@/components/site/PoolFacts";
import { getPoolSnapshot } from "@/lib/site/pool-snapshot";
import type { Metadata } from "next";
import Link from "next/link";
import { easy1PoolId, poolPreviewNotice } from "@/lib/site/editorial";
import styles from "@/components/site/EditorialPages.module.css";

const description = "Read-only EASY1 pool facts with observation times. Wallet connection and in-site delegation are unavailable.";
export const metadata: Metadata = {
  title: "EASY1 pool information preview", description, alternates: { canonical: "/pool" },
  openGraph: { title: "EASY1 pool information preview | EASY1", description, url: "/pool", type: "website", images: [{ url: "/brand/assets/easy1-share-card-dark.png", width: 1200, height: 630, alt: "easy1staking — Connected Soft identity" }] },
};

export const dynamic = "force-dynamic";

export default async function PoolPage() {
  const pool = await getPoolSnapshot();
  return <main id="main-content" className="editorial" tabIndex={-1}>
    <section className={`wrap ${styles.hero}`} aria-labelledby="pool-title"><div><div className="eyebrow">EASY1 / Cardano stake pool</div><h1 id="pool-title">Where it started.<br /><em>Still EASY1.</em></h1><div className={styles.notice} id="delegate" tabIndex={-1}><strong>Pool information preview</strong><p>{poolPreviewNotice} Wallet connection and in-site delegation are unavailable here. Pool figures show their observation time when available.</p></div><p className={styles.lead}>EASY1 began as a staking platform in 2020. The pool remains part of the same brand behind my Cardano software, smart contracts and developer tools.</p><div className={styles.role}>Built and operated by Giovanni.</div></div><div className={styles.facts}><PoolFacts {...pool} /></div></section>
    <section className={`wrap section ${styles.authored}`} aria-labelledby="pool-identity-title"><div className="eyebrow">The EASY1 pool</div><h2 id="pool-identity-title">One pool.<br /><em>Part of the story.</em></h2><div className={styles.poolIdentity}>EASY1 pool ID<code>{easy1PoolId}</code></div><p>This overview identifies the EASY1 pool. Pool figures are read-only observations, independent of wallet or delegation checks. There is no wallet connection or delegation flow on this page.</p><Link className="text-link" href="/about">The story behind EASY1 <span aria-hidden="true">↗</span></Link></section>
    <aside className={`wrap ${styles.quiet}`}><span>Explore the tools behind the EASY1 brand.</span><Link href="/#projects">See the projects <span aria-hidden="true">↗</span></Link></aside>
  </main>;
}
