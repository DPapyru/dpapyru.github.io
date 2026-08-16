import { Link } from "react-router-dom";
import { Seo } from "../../capabilities/seo/Seo";
import { pageTitle } from "../../capabilities/seo/site";
import styles from "./NotFound.module.css";

/**
 * 设计化 404 页 —— 未知路径时展示,样式与站点一致(消费主题 CSS 变量)。
 * 提供回到首页与博客列表的出口,并写合适的 SEO 标签。
 */
export function NotFound() {
  return (
    <main className={styles.page}>
      <Seo title={pageTitle("404 页面未找到")} path="/" description="您访问的页面不存在或已被移动。" />
      <h1 className={styles.title}>
        <span className={styles.code}>404</span>
        <span className={styles.titleText}>页面未找到</span>
      </h1>
      <p className={styles.lead}>您访问的路径不存在,或内容已被移动。请从下面回到站内。</p>
      <nav className={styles.actions} aria-label="404 页面导航">
        <Link to="/" className={styles.action}>
          回到首页
        </Link>
        <Link to="/blog" className={styles.actionSecondary}>
          浏览博客
        </Link>
      </nav>
    </main>
  );
}
