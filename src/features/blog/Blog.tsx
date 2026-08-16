import styles from "./Blog.module.css";

/**
 * 博客文章板块 — 占位页。
 * 博客索引与文章详情由后续 ticket 提供。
 */
export function Blog() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>博客</h1>
      <p className={styles.lead}>博客文章列表将在后续 ticket 提供。</p>
    </main>
  );
}
