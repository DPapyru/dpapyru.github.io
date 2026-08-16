import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildBlogIndex, type BlogSourceFile } from "../src/features/blog/blogIndex";

/**
 * 构建期内容管线:扫描 content/blog 下的 Markdown,生成文章索引 JSON 到 public/blog-index.json。
 * 用 `bun run build:content` 执行(见 package.json)。列表页由该索引驱动。
 */

const contentDir = join(process.cwd(), "content/blog");
const outFile = join(process.cwd(), "public/blog-index.json");

const files: BlogSourceFile[] = readdirSync(contentDir)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => ({
    slug: f.replace(/\.md$/, ""),
    content: readFileSync(join(contentDir, f), "utf8"),
  }));

const index = buildBlogIndex(files);
mkdirSync(join(process.cwd(), "public"), { recursive: true });
writeFileSync(outFile, JSON.stringify(index, null, 2) + "\n", "utf8");

console.log(`build-content: ${index.length} 篇文章 -> ${outFile}`);
