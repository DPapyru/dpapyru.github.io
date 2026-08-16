import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BlogIndexEntry } from "../src/features/blog/blogIndex";
import {
  blogSlugPaths,
  buildRobotsTxt,
  buildSitemapXml,
} from "../src/shared/capabilities/seo/sitemap";

/**
 * 构建期 SEO 管线:扫描已知 URL(/、/blog、/blog/:slug,slug 列表来自
 * public/blog-index.json),生成 sitemap.xml 与 robots.txt 到 public/。
 * 用 `bun run build:seo` 执行(见 package.json);run build 在 vite build 前先跑它,
 * 保证每次部署都带上最新的站点地图。
 */

const indexPath = join(process.cwd(), "public/blog-index.json");
const outDir = join(process.cwd(), "public");

const index: BlogIndexEntry[] = JSON.parse(readFileSync(indexPath, "utf8"));

// 固定板块路径 + 博客详情页路径(/blog/:slug)。
const slugPaths = blogSlugPaths(index.map((p) => p.slug));

const sitemap = buildSitemapXml(["/", "/blog"], slugPaths);
writeFileSync(join(outDir, "sitemap.xml"), sitemap, "utf8");

const robots = buildRobotsTxt("/sitemap.xml");
writeFileSync(join(outDir, "robots.txt"), robots, "utf8");

console.log(
  `build-seo: ${index.length} 篇文章 -> sitemap.xml (${slugPaths.length + 2} 个 URL) + robots.txt`,
);
