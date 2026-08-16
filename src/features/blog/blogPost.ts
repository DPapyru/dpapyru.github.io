import matter from "gray-matter";
import { parseBlogPost, type BlogIndexEntry } from "./blogIndex";
import type { BlogSourceFile } from "./blogIndex";

/**
 * 文章全文 = 索引元数据 + 原始 Markdown 正文(去掉 front matter 之后的部分)。
 * 详情页(路由 /blog/:slug)依赖此结构渲染单篇文章。
 */
export interface BlogPost extends BlogIndexEntry {
  /** 原始 Markdown 正文(不含 front matter)。本期朴素渲染,真正 Markdown 渲染由 #8 接缝替换。 */
  body: string;
}

/**
 * 文章渲染接缝(seam #7):单篇原始源文件 -> 全文。
 * 纯函数式 —— 复用 blogIndex.parseBlogPost 得的元数据,并剥离 front matter 得到 body。
 * #8 到来时,渲染层(把 body 变为 HTML)由此接缝下探,LoadPost 的签名保持不变。
 */
export function parsePostFull(source: BlogSourceFile): BlogPost {
  const { content } = matter(source.content);
  const meta = parseBlogPost(source);
  return { ...meta, body: content };
}
