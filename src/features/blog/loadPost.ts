import blogIndex from "../../generated/blog-index.json";
import { type BlogPost } from "./blogPost";
import { type Palette } from "./blogIndex";

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

/** 剥离 Markdown 文件的 front matter (ticket #7)。 */
export function stripFrontMatter(content: string): string {
  return content.replace(/^---[\s\S]*?---/, "").trim();
}

/**
 * 文章详情页数据加载器(seam #7):按 slug 定位文章。
 * 从预构建的 blog-index.json 获取已经解析好的 front matter 元数据,
 * 配合经由 import.meta.glob 导入 of 源文并剥离其 front matter 作为正文(body)。
 * 彻底消除运行时对 Node.js Buffer / gray-matter 的依赖,确保浏览器端完美兼容。
 * 纯函数式:入参只有 slug,不产生副作用。
 */
export function loadPost(slug: string): BlogPost | undefined {
  const meta = blogIndex.find((p) => p.slug === slug);
  if (!meta) return undefined;

  let rawContent: string | undefined;
  for (const [key, raw] of Object.entries(sources)) {
    if (keyToSlug(key) === slug) {
      rawContent = raw;
      break;
    }
  }

  if (rawContent === undefined) return undefined;

  const body = stripFrontMatter(rawContent);
  return {
    ...meta,
    palette: meta.palette as unknown as Palette,
    body,
  };
}
