import type { Metadata } from "next";
import Link from "next/link";
import { UnavailablePoolFacts } from "@/components/site/EditorialSections";
import { easy1PoolId, poolPreviewNotice } from "@/lib/site/editorial";
import styles from "@/components/site/EditorialPages.module.css";

const description = "Read-only EASY1 pool information preview. Live pool data and in-site delegation are unavailable in this preview.";
export const metadata: Metadata = {
  title: "EASY1 pool information preview", description, alternates: { canonical: "/pool" },
  openGraph: { title: "EASY1 pool information preview | EASY1", description, url: "/pool", type: "website", images: [{ url: "/brand/assets/easy1-share-card-dark.png", width: 1200, height: 630, alt: "easy1staking — Connected Soft identity" }] },
};

export default function PoolPage() {
  return <main id="main-content" className="editorial" tabIndex={-1}>
    <section className={`wrap ${styles.hero}`} aria-labelledby="pool-title"><div><div className="eyebrow">EASY1 / Cardano stake pool</div><h1 id="pool-title">Where it started.<br /><em>Still EASY1.</em></h1><div className={styles.notice}><strong>Pool information preview</strong><p>{poolPreviewNotice} Wallet connection and live pool data are unavailable here.</p></div><p className={styles.lead}>EASY1 began as a staking platform in 2020. The pool remains part of the same brand behind my Cardano software, smart contracts and developer tools.</p><div className={styles.role}>Built and operated by Giovanni.</div></div><div className={styles.facts}><UnavailablePoolFacts /></div></section>
    <section className={`wrap section ${styles.authored}`} aria-labelledby="pool-identity-title"><div className="eyebrow">The EASY1 pool</div><h2 id="pool-identity-title">One pool.<br /><em>Part of the story.</em></h2><div className={styles.poolIdentity}>EASY1 pool ID<code>{easy1PoolId}</code></div><p>This overview identifies the EASY1 pool. Current pool figures are unknown in this preview; there is no wallet connection or delegation flow on this page.</p><Link className="text-link" href="/about">The story behind EASY1 <span aria-hidden="true">↗</span></Link></section>
    <aside className={`wrap ${styles.quiet}`}><span>Explore the tools behind the EASY1 brand.</span><Link href="/#projects">See the projects <span aria-hidden="true">↗</span></Link></aside>
  </main>;
}
