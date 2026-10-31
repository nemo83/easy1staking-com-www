import { PoolFacts } from "@/components/site/PoolFacts";
import { getPoolSnapshot } from "@/lib/site/pool-snapshot";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GiovanniPortrait, ProjectCard, UpcomingArticleGrid } from "@/components/site/EditorialSections";
import { editorialProjects, poolPreviewNotice } from "@/lib/site/editorial";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export const dynamic = "force-dynamic";

export default async function Home() {
  const pool = await getPoolSnapshot();
  return <main id="main-content" className="editorial" tabIndex={-1}>
    <section className="hero wrap" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="eyebrow"><span className="small-dot" />Independently built. Rooted in Cardano.</div>
        <h1 id="hero-title">Built on Cardano.<br /><em>Made to be used.</em></h1>
        <p>I’m Giovanni. EASY1 brings together the tools I build, the smart contracts behind them, and the stake pool where it all started.</p>
        <a className="primary" href="#projects">Explore the projects <span aria-hidden="true">↓</span></a>
        <div className="hero-note">AdaWatch <span>·</span> AdaMatic <span>·</span> UPLC Link <span>·</span> Cardano Dev Skills</div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-cross cross-one">+</div><div className="art-cross cross-two">+</div>
        <div className="brand-core"><Image src="/brand/assets/easy1-symbol-colour-dark.svg" alt="" width={156} height={156} priority /></div>
        {editorialProjects.map((project, index) => <div key={project.slug} className={`orbit-label ${["watch", "matic", "uplc", "skills"][index]}`}><Image src={project.icon} alt="" width={25} height={25} />{project.shortName}</div>)}
        <div className="art-caption">Built here. Shared with Cardano.</div>
      </div>
    </section>
    <div className="practice-strip wrap"><span>Software</span><span>Smart contracts</span><span>Stake pool</span><span className="strip-note">From an idea to something you can use.</span></div>
    <section className="projects wrap section" id="projects" tabIndex={-1} aria-labelledby="projects-title">
      <div className="section-heading"><div><div className="eyebrow">01 / The projects</div><h2 id="projects-title">Different tools.<br /><em>The same curiosity.</em></h2></div><p>Products I build.<br />Open-source work I’ve shared.</p></div>
      <div className="project-grid">{editorialProjects.map((project, index) => <ProjectCard key={project.slug} project={project} index={index} />)}</div>
      <p className="project-credit">Projects and open-source work started by Giovanni <span>·</span> Connected by EASY1</p>
    </section>
    <section className="pool-section wrap section" id="pool" tabIndex={-1} aria-labelledby="pool-title">
      <div className="pool-panel"><div className="pool-copy"><div className="eyebrow">02 / Where it started</div><h2 id="pool-title">The pool behind<br /><em>the projects.</em></h2><p>EASY1 started with staking in 2020. Today, the pool sits alongside the Cardano software and smart contracts I build.</p><Link className="pool-action" href="/pool" aria-describedby="home-pool-notice">Stake with EASY1 <span aria-hidden="true">↗</span></Link><p className="pool-small" id="home-pool-notice">{poolPreviewNotice}</p></div><PoolFacts {...pool} /></div>
    </section>
    <section className="story wrap section" aria-labelledby="story-title">
      <GiovanniPortrait /><div className="story-copy"><div className="eyebrow">03 / The person behind EASY1</div><h2 id="story-title">It started with a pool.<br /><em>I kept building.</em></h2><p>I started EASY1 as a staking platform. Then came the bots, payment automation and smart contracts. I also started Cardano Dev Skills and handed it over to the Cardano Foundation. Some projects I run; others I share with the wider ecosystem.</p><Link className="text-link" href="/about">The story behind EASY1 <span aria-hidden="true">↗</span></Link><div className="signature">Giovanni <span>Cardano developer &amp; stake pool operator</span></div></div>
    </section>
    <section className="writing wrap section" aria-labelledby="writing-title"><div className="section-heading"><div><div className="eyebrow">04 / Notes from building</div><h2 id="writing-title">Things worth<br /><em>writing down.</em></h2></div><p>The story, the code,<br />and what I learned along the way.</p></div><UpcomingArticleGrid /></section>
  </main>;
}
