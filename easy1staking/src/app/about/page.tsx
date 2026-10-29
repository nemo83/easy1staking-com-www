import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, GiovanniPortrait } from "@/components/site/EditorialSections";
import { editorialSocials } from "@/lib/site/editorial";
import styles from "@/components/site/EditorialPages.module.css";

const description = "Giovanni’s journey from the EASY1 stake pool in 2020 to Cardano software, smart contracts and open-source developer tools.";
export const metadata: Metadata = {
  title: "About Giovanni", description, alternates: { canonical: "/about" },
  openGraph: { title: "About Giovanni | EASY1", description, url: "/about", type: "website", images: [{ url: "/images/giovanni-portrait.webp", width: 1200, height: 1200, alt: "Giovanni in front of illuminated CARDANO lettering" }] },
};

export default function AboutPage() {
  return <main id="main-content" className="editorial" tabIndex={-1}>
    <section className={`wrap ${styles.hero}`} aria-labelledby="about-title"><div><div className="eyebrow">Giovanni / The person behind EASY1</div><h1 id="about-title">It started with a pool.<br /><em>I kept building.</em></h1><p className={styles.lead}>I’m Giovanni, a Cardano developer and stake pool operator. EASY1 is the connection between the infrastructure I run, the tools I build and the work I share.</p><Link className="primary" href="/#projects">Explore my projects <span aria-hidden="true">↗</span></Link></div><GiovanniPortrait priority /></section>
    <section className={`wrap section ${styles.journey}`} aria-label="The journey"><div className="eyebrow">The journey</div>
      <div className={styles.journeyRow}><span>2020</span><div><h2>The staking beginning.</h2><p>I started easy1staking as a staking platform. Running the EASY1 pool became the starting point for a much wider interest in building on Cardano.</p></div></div>
      <div className={styles.journeyRow}><span>Building</span><div><h2>From infrastructure<br /><em>to software.</em></h2><p>I became a Cardano and smart contract developer. AdaWatch, AdaMatic and UPLC Link grew from that work: notifications, payment automation and contract verification, with their own identities and a shared connection to EASY1.</p></div></div>
      <div className={styles.journeyRow}><span>Sharing</span><div><h2>Some projects grow<br /><em>beyond their beginnings.</em></h2><p>I started Cardano Dev Skills and handed it over to the Cardano Foundation. It is still my baby. Its home has changed; its beginning remains part of this story.</p><Link className="text-link" href="/projects/cardano-dev-skills">Explore Cardano Dev Skills <span aria-hidden="true">↗</span></Link></div></div>
    </section>
    <aside className={`wrap ${styles.quiet}`}><span>Follow what I build and share.</span><div><ExternalLink href={editorialSocials.x}>X</ExternalLink><ExternalLink href={editorialSocials.github}>GitHub</ExternalLink></div></aside>
  </main>;
}
