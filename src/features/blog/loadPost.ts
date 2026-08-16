import { parsePostFull, type BlogPost } from "./blogPost";

/**
 * 构建期静态收集 content/blog/*.md 的原始 Markdown 为字符串。
 * 用 Vite 的 import.meta.glob(带 ?raw 查询)在构建时把每篇源文内联进 bundle,
 * 使得深链/刷新/直接访问 /blog/:slug 时,详情页能在运行时即刻拿到源文,无需再发请求。
 * #8 真正的 Markdown 渲染段落到达后,本加载器形态保持不变。
 */
const sources: Record<string, string> = import.meta.glob(
  "../../../content/blog/*.md",
  { query: "?raw", import: "default", eager: true },
);

/** 从 glob 键(形如 "../../../content/blog/first-post.md")提取 slug。 */
function keyToSlug(key: string): string {
  const base = key.slice(key.lastIndexOf("/") + 1);
  return base.replace(/\.md$/, "");
}

/**
 * 文章详情接缝(seam #7):按 slug 从静态源文中定位文章。
 * 返回该篇全文;slug 不存在时返回 undefined —— 由调用方渲染「文章不存在」反馈。
 * 纯函数式:入参只有 slug,不产生副作用。
 */
export function loadPost(slug: string): BlogPost | undefined {
  for (const [key, raw] of Object.entries(sources)) {
    if (keyToSlug(key) === slug) {
      return parsePostFull({ slug, content: raw });
    }
  }
  return undefined;
}
