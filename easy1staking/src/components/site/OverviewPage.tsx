import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "@/components/site/EditorialSections";
import { type EditorialProject, poolPreviewNotice, projectOverviews } from "@/lib/site/editorial";
import styles from "./EditorialPages.module.css";

export function OverviewPage({ project }: { project: EditorialProject }) {
  const overview = projectOverviews[project.slug];
  const shared = project.slug === "cardano-dev-skills";
  return <main id="main-content" className="editorial" tabIndex={-1}>
    <div className={`wrap ${styles.breadcrumb}`}><Link href="/#projects">← All projects</Link><span>{project.name}</span></div>
    <section className={`wrap ${styles.hero}`} aria-labelledby="project-title">
      <div><div className="eyebrow"><Image className={styles.icon} src={project.icon} alt="" width={28} height={28} />{project.category}</div>
        <h1 id="project-title">{overview.headline}<br /><em>{overview.emphasis}</em></h1>
        <p className={styles.lead}>{overview.lead}</p>
        <div className={styles.role}>{project.credit ?? project.role}</div>
        <ExternalLink href={project.url} className="primary">{shared ? "Explore" : "Visit"} {project.name}</ExternalLink>
        {project.sourceUrl && <ExternalLink href={project.sourceUrl} className={styles.source}>Official repository</ExternalLink>}
      </div>
      <figure className={styles.capture}><div className={styles.browser} aria-hidden="true"><i /><i /><i /><span>Actual product-site capture</span></div><Image src={project.capture} alt={project.captureAlt} width={1200} height={800} sizes="(max-width: 760px) 90vw, 550px" priority /><figcaption>Independent project identity, preserved.</figcaption></figure>
    </section>
    <section className="wrap section" aria-labelledby="features-title"><div className="eyebrow">What it does</div><h2 id="features-title">A closer look<br /><em>at {project.name}.</em></h2><div className={styles.features}>{overview.features.map((feature, index) => <article key={feature.title}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span><h3>{feature.title}</h3><p>{feature.body}</p></article>)}</div></section>
    <section className={`wrap section ${styles.authored}`} aria-labelledby="connection-title"><div className="eyebrow">The EASY1 connection</div><h2 id="connection-title">{shared ? "Started here." : "One of the things"}<br /><em>{shared ? "Shared with Cardano." : "I build."}</em></h2><p>{overview.connection}</p><Link className="text-link" href="/about">Meet Giovanni <span aria-hidden="true">↗</span></Link></section>
    <aside className={`wrap ${styles.quiet}`}><div><p>Where EASY1 started: the stake pool.<br />{poolPreviewNotice}</p></div><Link href="/pool">Explore the EASY1 pool <span aria-hidden="true">↗</span></Link></aside>
  </main>;
}
