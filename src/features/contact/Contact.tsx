import { Seo } from "../../shared/capabilities/seo/Seo";
import { pageTitle } from "../../shared/capabilities/seo/site";
import styles from "./Contact.module.css";

/**
 * 联系方式板块 — 占位页。
 * 联系表单/链接由后续 ticket 提供。
 */
export function Contact() {
  return (
    <main className={styles.page}>
      <Seo title={pageTitle("联系方式")} path="/contact" description="联系 DPapyru。" />
      <h1 className={styles.title}>联系方式</h1>
      <div className={styles.lead}>
        <p>你可以通过以下方式联系我：</p>
        <ul style={{ marginTop: "1rem", listStyle: "none", padding: 0 }}>
          <li style={{ margin: "0.5rem 0" }}>
            <strong>GitHub:</strong>{" "}
            <a href="https://github.com/DPapyru" target="_blank" rel="noopener noreferrer">
              github.com/DPapyru
            </a>
          </li>
          <li style={{ margin: "0.5rem 0" }}>
            <strong>Email:</strong>{" "}
            <a href="mailto:dpapyru@gmail.com">dpapyru@gmail.com</a>
          </li>
        </ul>
      </div>
    </main>
  );
}
