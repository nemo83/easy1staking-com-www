import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/site/EditorialPages.module.css";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return <main id="main-content" className={`editorial wrap ${styles.notFound}`} tabIndex={-1}>
    <div className="eyebrow">404 / Page not found</div><h1>This page isn’t here.</h1><p>Return to EASY1 or explore Giovanni’s Cardano projects.</p><Link className="primary" href="/">Back to home <span aria-hidden="true">↗</span></Link><Link className="text-link" href="/#projects">Explore the projects <span aria-hidden="true">↗</span></Link>
  </main>;
}
