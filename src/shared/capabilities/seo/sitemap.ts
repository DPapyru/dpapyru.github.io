import { absoluteUrl } from "./site";

/**
 * 构建期 SEO 产物生成 —— 纯函数(输入 -> 输出),无副作用。
 * 供 scripts/build-seo.ts 调用,扫描已知 URL 生成 sitemap.xml 与 robots.txt。
 * 独立于 React 组件,便于单测断言生成内容。
 */

/**
 * 由站内路径生成 sitemap.xml 文档。
 * @param staticPaths 固定板块路径("/"、"/blog")。
 * @param slugPaths 博客详情页路径("/blog/:slug")。
 * @returns sitemap.xml 完整字符串(含 XML 声明)。
 */
export function buildSitemapXml(
  staticPaths: readonly string[],
  slugPaths: readonly string[],
): string {
  const all = [...staticPaths, ...slugPaths];
  const urls = all.map((p) => `  <url><loc>${absoluteUrl(p)}</loc></url>`).join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`
  );
}

/**
 * 生成 robots.txt 内容:放行全部爬虫 + 指向 sitemap。
 * @param sitemapPath 站内 sitemap 路径(默认 "/sitemap.xml")。
 */
export function buildRobotsTxt(sitemapPath = "/sitemap.xml"): string {
  return (
    `User-agent: *\n` +
    `Allow: /\n` +
    `\n` +
    `Sitemap: ${absoluteUrl(sitemapPath)}\n`
  );
}

/**
 * 由博客索引 slug 列表拼出详情页路径(如 "/blog/content-pipeline")。
 * 供脚本/测试复用,保证构建期与测试同一来源。
 */
export function blogSlugPaths(slugs: readonly string[]): string[] {
  return slugs.map((slug) => `/blog/${slug}`);
}
