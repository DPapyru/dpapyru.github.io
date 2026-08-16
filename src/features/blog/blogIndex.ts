import matter from "gray-matter";

/**
 * 着色标记的色板 —— 形如 { key: color } 的映射。
 * 由文章 front matter 的 palette 字段提供,供后续渲染能力(着色标记)使用。
 */
export type Palette = Record<string, string>;

/** 文章 front matter 元数据字段。 */
export interface BlogPostMeta {
  title: string;
  date: string;
  excerpt?: string;
  palette: Palette;
  tags?: string[];
}

/** 索引条目 = slug + 元数据。列表页由该结构驱动。 */
export interface BlogIndexEntry extends BlogPostMeta {
  slug: string;
}

/** 内容管线的输入源文件。 */
export interface BlogSourceFile {
  slug: string;
  content: string;
}

function parseMeta(raw: unknown): BlogPostMeta {
  const data = (raw ?? {}) as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title : "";
  const date = typeof data.date === "string" ? data.date : "";
  const excerpt = typeof data.excerpt === "string" ? data.excerpt : undefined;

  let palette: Palette = {};
  if (data.palette && typeof data.palette === "object") {
    palette = data.palette as Palette;
  }

  let tags: string[] | undefined;
  if (Array.isArray(data.tags)) {
    tags = data.tags.filter((t): t is string => typeof t === "string");
  }

  return { title, date, excerpt, palette, tags };
}

/**
 * 解析单篇 Markdown 源文:用 gray-matter 抽取 front matter 得到元数据,slug 取自文件名。
 */
export function parseBlogPost(source: BlogSourceFile): BlogIndexEntry {
  const { data } = matter(source.content);
  return { slug: source.slug, ...parseMeta(data) };
}

/**
 * 内容管线接缝(seam 1):一组源文件 -> 按 date 倒序的文章索引。
 * 纯函数式 —— 不改入参,返回新数组。
 */
export function buildBlogIndex(files: BlogSourceFile[]): BlogIndexEntry[] {
  return files.map(parseBlogPost).sort((a, b) => b.date.localeCompare(a.date));
}
