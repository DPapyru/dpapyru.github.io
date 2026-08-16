import { describe, expect, it } from "vitest";
import {
  buildSitemapXml,
  buildRobotsTxt,
  blogSlugPaths,
} from "./sitemap";
import { SITE_URL } from "./site";

function locs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1]);
}

describe("buildSitemapXml", () => {
  it("静态板块 + 博客详情页路径生成为规范绝对 URL", () => {
    const xml = buildSitemapXml(["/", "/blog"], blogSlugPaths(["first-post", "content-pipeline"]));

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');

    const urls = locs(xml);
    expect(urls).toEqual([
      SITE_URL,
      `${SITE_URL}/blog`,
      `${SITE_URL}/blog/first-post`,
      `${SITE_URL}/blog/content-pipeline`,
    ]);
  });

  it("空详情列表时仍输出静态板块", () => {
    const xml = buildSitemapXml(["/", "/blog"], []);
    expect(locs(xml)).toEqual([SITE_URL, `${SITE_URL}/blog`]);
  });
});

describe("buildRobotsTxt", () => {
  it("放行全部爬虫并指向 sitemap", () => {
    const txt = buildRobotsTxt("/sitemap.xml");
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /");
    expect(txt).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});

describe("blogSlugPaths", () => {
  it("把 slug 列表映射为详情页路径", () => {
    expect(blogSlugPaths(["a", "b-c"])).toEqual(["/blog/a", "/blog/b-c"]);
  });
});
