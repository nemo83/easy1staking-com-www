import type { Metadata } from "next";
import Link from "next/link";
import { UpcomingArticleGrid } from "@/components/site/EditorialSections";
import styles from "@/components/site/EditorialPages.module.css";

const description = "Notes from building EASY1: the story, practical walkthroughs and a closer look inside the projects. Three articles coming soon.";
export const metadata: Metadata = {
  title: "Notes from building", description, alternates: { canonical: "/blog" },
  openGraph: { title: "Notes from building | EASY1", description, url: "/blog", type: "website", images: [{ url: "/brand/assets/easy1-share-card-dark.png", width: 1200, height: 630, alt: "easy1staking — Connected Soft identity" }] },
};

export default function BlogPage() {
  return <main id="main-content" className="editorial" tabIndex={-1}>
    <section className={`wrap ${styles.blogHero}`} aria-labelledby="blog-title"><div className="eyebrow">Notes from building</div><h1 id="blog-title">The story. The code.<br /><em>The things I learned.</em></h1><p className={styles.lead}>A place for the EASY1 story, practical walkthroughs and a closer look inside the projects. These first three pieces are coming soon.</p></section>
    <section className={`wrap ${styles.articleIndex}`} aria-label="Upcoming articles"><UpcomingArticleGrid /></section>
    <aside className={`wrap ${styles.quiet}`}><span>While the articles are taking shape, explore the projects.</span><Link href="/#projects">See the projects <span aria-hidden="true">↗</span></Link></aside>
  </main>;
}
