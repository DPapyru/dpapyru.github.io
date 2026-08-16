import { Seo } from "../../shared/capabilities/seo/Seo";
import { pageTitle } from "../../shared/capabilities/seo/site";
import styles from "./About.module.css";

/**
 * 关于我板块 — 最小占位页。
 * 本期(#3)仅提供站点骨架;板块内容与样式后续 ticket 完善。
 */
export function About() {
  return (
    <main className={styles.about}>
      <Seo title={pageTitle("关于我")} path="/" description="DPapyru 的个人主页 — 关于我。" />
      <h1 className={styles.title}>关于我</h1>
      <p className={styles.lead}>这里是 DPapyru 的个人主页。</p>
    </main>
  );
}
