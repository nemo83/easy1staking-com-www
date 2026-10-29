import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { type EditorialProject, upcomingArticles } from "@/lib/site/editorial";

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}<span aria-hidden="true"> ↗</span><span className="sr-only"> (opens in a new tab)</span></a>;
}

export function ProjectCard({ project, index }: { project: EditorialProject; index: number }) {
  return (
    <article className="project-card" style={{ "--product": project.accent } as CSSProperties}>
      <figure className="capture">
        <div className="capture-bar" aria-hidden="true"><span>● ● ●</span> {project.siteLabel}</div>
        <Image src={project.capture} alt={project.captureAlt} width={1200} height={800} sizes="(max-width: 760px) 90vw, 550px" />
        <figcaption>Actual website capture · {project.siteLabel}</figcaption>
      </figure>
      <div className="project-copy">
        <div className="project-meta"><Image src={project.icon} alt="" width={27} height={27} /><span>{project.category}</span><span className="number">{String(index + 1).padStart(2, "0")}</span></div>
        <h3>{project.name}</h3>
        {project.credit && <div className="origin-credit">{project.credit}</div>}
        <p>{project.summary}</p>
        <Link href={`/projects/${project.slug}`}>Explore {project.name}<span aria-hidden="true">↗</span></Link>
      </div>
    </article>
  );
}

export function UpcomingArticleGrid() {
  return <div className="article-grid">{upcomingArticles.map((article) => (
    <article key={article.art}>
      <div className={`article-art ${article.art}`} aria-hidden="true">
        <span>{article.art === "origins" ? "2020" : article.art === "debugging" ? "A closer look." : "Under the hood."}</span>
        <div>{article.art === "origins" ? <>₳ <i>→</i> &lt;/&gt;</> : article.art === "debugging" ? <>{"{"}<i>verify</i>{"}"}</> : "↻"}</div>
      </div>
      <div className="article-meta">{article.category}<span>Coming soon</span></div>
      <h3>{article.title}</h3>
    </article>
  ))}</div>;
}

export function UnavailablePoolFacts() {
  return <div className="pool-data">
    <div className="pool-id"><Image src="/brand/assets/easy1-symbol-colour-dark.svg" alt="" width={38} height={38} /><div><span>Stake pool</span><strong>EASY1</strong></div></div>
    <dl>{[{ label: "Active stake", unit: "ADA" }, { label: "Pool saturation", unit: "%" }, { label: "Lifetime blocks" }, { label: "Margin / fixed cost" }].map(({ label, unit }) => <div key={label}><dt>{label}</dt><dd><span aria-label="Unavailable">—</span>{unit && <small>{unit}</small>}</dd></div>)}</dl>
    <p className="data-note">Live pool data is unavailable in this preview. Figures are unknown.</p>
  </div>;
}

export function GiovanniPortrait({ priority = false }: { priority?: boolean }) {
  return <figure className="giovanni-portrait"><Image src="/images/giovanni-portrait.webp" alt="Giovanni in front of illuminated CARDANO lettering" width={1200} height={1200} sizes="(max-width: 760px) 90vw, 480px" priority={priority} /></figure>;
}
