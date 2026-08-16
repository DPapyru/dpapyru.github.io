import styles from "./Contact.module.css";

/**
 * 联系方式板块 — 占位页。
 * 联系表单/链接由后续 ticket 提供。
 */
export function Contact() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>联系方式</h1>
      <p className={styles.lead}>联系方式内容将在后续 ticket 提供。</p>
    </main>
  );
}
