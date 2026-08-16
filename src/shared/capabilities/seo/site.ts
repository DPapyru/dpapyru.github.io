/**
 * 站点级元信息 —— SEO 能力的共享常量。
 *
 * SITE_URL 用于把站内路径拼成绝对 URL(sitemap、OG/Twitter 标签、robots.txt 的 Sitemap 指令)。
 * 供 Seo 组件与构建期 SEO 脚本(scripts/build-seo.ts)共用,保证两处基线一致。
 */

/** 站点名称(浏览器标题后缀与 og:site_name)。 */
export const SITE_NAME = "DPapyru 的个人主页";

/** 站点根 URL(部署在 GitHub Pages 的公开地址),不带结尾斜杠。 */
export const SITE_URL = "https://dpapyru.github.io";

/** 统一页面标题格式:板块/文章标题 + 站点名。 */
export function pageTitle(part: string): string {
  return part ? `${part} \u00b7 ${SITE_NAME}` : SITE_NAME;
}

/** 把站内路径(如 "/"、"/blog"、"/blog/:slug")拼成该主题的规范绝对 URL。 */
export function absoluteUrl(path: string): string {
  const base = SITE_URL.replace(/\/$/, "");
  return path === "/" ? base : base + path;
}
