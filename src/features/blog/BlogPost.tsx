import { useParams } from "react-router-dom";
import { loadPost } from "./loadPost";
import styles from "./BlogPost.module.css";

/**
 * 博客文章详情页 —— 路由 /blog/:slug。
 * 经 loadPost 接缝从静态源文定位单篇;未知 slug(loadPost 返回 undefined)给出明确反馈。
 * 本期朴素渲染原文档(body 原样输出),真正的 Markdown 管线(着色标记/Callout/协议嵌入)由 #8 替换渲染层。
 */
export function BlogPost() {
  const { slug = "" } = useParams();

  if (slug === "") {
    return (
      <main className={styles.page}>
        <p className={styles.missing}>缺少文章标识,无法定位文章。</p>
      </main>
    );
  }

  const post = loadPost(slug);
  if (!post) {
    return (
      <main className={styles.page}>
        <h1 className={styles.missingTitle}>文章不存在</h1>
        <p className={styles.missing}>
          没有找到 slug 为「{slug}」的文章。它可能已被删除,或您分享的链接有误。请回到博客列表重试。
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <article className={styles.post}>
        <h1 className={styles.title}>{post.title}</h1>
        <time className={styles.date} dateTime={post.date}>
          {post.date}
        </time>
        {/* #8 接缝:此处换成真正 Markdown 渲染(着色标记/Callout/协议嵌入)。 */}
        <pre className={styles.body}>{post.body}</pre>
      </article>
    </main>
  );
}
