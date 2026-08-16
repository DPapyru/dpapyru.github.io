import styles from "./About.module.css";

/**
 * 关于我板块 — 最小占位页。
 * 本期(#3)仅提供站点骨架;板块内容与样式后续 ticket 完善。
 */
export function About() {
  return (
    <main className={styles.about}>
      <h1 className={styles.title}>关于我</h1>
      <p className={styles.lead}>这里是 DPapyru 的个人主页。</p>
    </main>
  );
}
