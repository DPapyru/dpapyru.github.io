import { Link } from "react-router-dom";
import styles from "./Blog.module.css";
import blogIndex from "../../../public/blog-index.json";
import { Search } from "../search";
import { Seo } from "../../shared/capabilities/seo/Seo";
import { pageTitle } from "../../shared/capabilities/seo/site";

/**
 * 博客文章板块 —— 列表页。
 * 由构建期生成的索引(public/blog-index.json)驱动,展示全部文章的卡片。
 * 详情页(路由 /blog/:slug)由 ticket #7 提供;列表下方挂载站内搜索占位(#17)。
 */
export function Blog() {
  return (
    <main className={styles.page}>
      <Seo title={pageTitle("博客")} path="/blog" description="DPapyru 的博客文章。" />
      <h1 className={styles.title}>博客</h1>
      <p className={styles.lead}>共 {blogIndex.length} 篇文章,列表由构建期索引驱动。</p>
      <ul className={styles.list}>
        {blogIndex.map((post) => (
          <li key={post.slug} className={styles.item}>
            <Link to={`/blog/${post.slug}`} className={styles.card}>
              <h2 className={styles.cardTitle}>{post.title}</h2>
              <time className={styles.date} dateTime={post.date}>
                {post.date}
              </time>
              {post.excerpt ? <p className={styles.excerpt}>{post.excerpt}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
      {/* 站内搜索入口 + 占位 UI(ticket #17);真实 BM25 检索由后续 ticket 实现 */}
      <Search />
    </main>
  );
}
