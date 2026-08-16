/**
 * SEO 能力 —— 导出出口。
 * 供板块页统一从 capabilities/seo 引入 <Seo/>、站点元信息常量与 sitemap 生成纯函数。
 */
export { Seo, buildSeoTags, applyHead, SEO_DATA_ATTR } from "./Seo";
export type { SeoProps, SeoType, SeoHeadEntry } from "./Seo";
export { SITE_NAME, SITE_URL, pageTitle, absoluteUrl } from "./site";
export {
  buildSitemapXml,
  buildRobotsTxt,
  blogSlugPaths,
} from "./sitemap";
