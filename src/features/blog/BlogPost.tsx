import { useParams } from "react-router-dom";
import { loadPost } from "./loadPost";
import { MarkdownRenderer } from "../../shared/capabilities/markdown/MarkdownRenderer";
import { rehypeCallout } from "../../shared/capabilities/markdown/callout";
import { coloringMark } from "../../shared/capabilities/markdown/coloring-marks";
import { protocolEmbed } from "../../shared/capabilities/markdown/protocol-embed";
// Callout / 协议嵌入全局样式(rehype 插件产出的类名不经 CSS Modules 哈希,须全局加载)。
import "../../shared/capabilities/markdown/callout.module.css";
import "../../shared/capabilities/markdown/protocol-embed.module.css";
import { Seo } from "../../shared/capabilities/seo/Seo";
import { pageTitle } from "../../shared/capabilities/seo/site";
import styles from "./BlogPost.module.css";

/**
 * 博客文章详情页 —— 路由 /blog/:slug。
 * 经 loadPost 接缝从静态源文定位单篇;未知 slug(loadPost 返回 undefined)给出明确反馈。
 * 正文经 #8 Markdown 渲染管线(remark-gfm 表格/任务列表 + rehype-highlight 代码高亮)
 * 由 <MarkdownRenderer> 渲染;渲染层接缝仍在 loadPost/parsePostFull(#7,#8 仅替换正文渲染)。
 * Callout(#9)经 rehypePlugins 注入;着色标记(#10)与协议嵌入(#11)经 remarkPlugins 注入
 * (分别取 post.palette 与 protocolEmbed())。
 */
export function BlogPost() {
  const { slug = "" } = useParams();

  if (slug === "") {
    return (
      <main className={styles.page}>
        <Seo title={pageTitle("文章缺少标识")} path="/blog" description="文章缺少标识,无法定位。" />
        <p className={styles.missing}>缺少文章标识,无法定位文章。</p>
      </main>
    );
  }

  const post = loadPost(slug);
  if (!post) {
    return (
      <main className={styles.page}>
        <Seo title={pageTitle("文章不存在")} path="/blog" description="找不到对应文章,可能已被删除。" />
        <h1 className={styles.missingTitle}>文章不存在</h1>
        <p className={styles.missing}>
          没有找到 slug 为「{slug}」的文章。它可能已被删除,或您分享的链接有误。请回到博客列表重试。
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Seo
        title={pageTitle(post.title)}
        path={`/blog/${slug}`}
        description={post.excerpt}
        type="article"
      />
      <article className={styles.post}>
        <h1 className={styles.title}>{post.title}</h1>
        <time className={styles.date} dateTime={post.date}>
          {post.date}
        </time>
        {/* #8/#9/#10/#11 接缝:正文走 Markdown 管线;Callout 经 rehypePlugins 注入;着色标记与协议嵌入经 remarkPlugins 注入(取 post.palette 与 protocolEmbed())。 */}
        <MarkdownRenderer
          source={post.body}
          remarkPlugins={[coloringMark(post.palette), protocolEmbed()]}
          rehypePlugins={[rehypeCallout]}
        />
      </article>
    </main>
  );
}
