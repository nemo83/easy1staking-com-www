import type { ReactNode } from "react";
import styles from "./ArticleLayout.module.css";

type ArticleLayoutProps = {
  title: string;
  author: string;
  publishedAt: string;
  children: ReactNode;
};

/** Render approved React content; callers supply the real ISO calendar date. */
export function ArticleLayout({ title, author, publishedAt, children }: ArticleLayoutProps) {
  const date = new Date(`${publishedAt}T00:00:00Z`);
  if (!title.trim() || !author.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== publishedAt) {
    throw new Error("Article title, author and valid publication date are required");
  }
  return <article className={styles.article}>
    <header className={styles.header}>
      <h1>{title}</h1>
      <p className={styles.meta}><span>By {author}</span><time dateTime={publishedAt}>{new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)}</time></p>
    </header>
    <div className={styles.content}>{children}</div>
  </article>;
}
