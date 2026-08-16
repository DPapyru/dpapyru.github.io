import styles from "./NotFound.module.css";

/**
 * 未知路径的 404 占位页。#18 ticket 负责设计化 404。
 */
export function NotFound() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>404 — 页面未找到</h1>
      <p className={styles.lead}>您访问的路径不存在,请从顶部导航回到各板块。</p>
    </main>
  );
}
