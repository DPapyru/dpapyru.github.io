import { render } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { Seo, buildSeoTags, SEO_DATA_ATTR } from "./Seo";
import { SITE_URL, SITE_NAME, pageTitle, absoluteUrl } from "./site";

function readMeta(attr: "name" | "property", key: string): string | null {
  return document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content") ?? null;
}

describe("buildSeoTags 纯函数(输入 -> 输出)", () => {
  it("website 页面产出 title/url 与 description + OG + Twitter 标签", () => {
    const out = buildSeoTags({
      title: pageTitle("博客"),
      path: "/blog",
      description: "DPapyru 的博客文章。",
    });

    expect(out.title).toBe(pageTitle("博客"));
    expect(out.url).toBe(`${SITE_URL}/blog`);

    const og = Object.fromEntries(out.tags.map((t) => [t.key, t.content]));
    expect(og["description"]).toBe("DPapyru 的博客文章。");
    expect(og["og:title"]).toBe(pageTitle("博客"));
    expect(og["og:type"]).toBe("website");
    expect(og["og:url"]).toBe(`${SITE_URL}/blog`);
    expect(og["og:site_name"]).toBe(SITE_NAME);
    expect(og["og:description"]).toBe("DPapyru 的博客文章。");
    expect(og["twitter:card"]).toBe("summary_large_image");
    expect(og["twitter:title"]).toBe(pageTitle("博客"));
    expect(og["twitter:description"]).toBe("DPapyru 的博客文章。");
  });

  it("根路径被规范成站点根 URL", () => {
    const out = buildSeoTags({ title: pageTitle("关于我"), path: "/" });
    expect(out.url).toBe(SITE_URL);
  });

  it("文章页(article)使用绝对图片 URL 作为 og:image", () => {
    const out = buildSeoTags({
      title: "文章标题",
      path: "/blog/slug",
      type: "article",
      image: "/og/cover.png",
    });
    const og = Object.fromEntries(out.tags.map((t) => [t.key, t.content]));
    expect(og["og:type"]).toBe("article");
    expect(og["og:image"]).toBe(absoluteUrl("/og/cover.png"));
    expect(absoluteUrl("/og/cover.png")).toBe(`${SITE_URL}/og/cover.png`);
  });
});

describe("Seo 组件(jsdom 下 document.title 与 meta)", () => {
  beforeEach(() => {
    // 清掉上一用例遗留的 head 标签,保证断言相互独立。
    document.head.querySelectorAll(`[${SEO_DATA_ATTR}]`).forEach((el) => el.remove());
    document.title = "";
  });

  it("挂载后写入 document.title 与 description/meta", () => {
    render(
      <Seo
        title={pageTitle("关于我")}
        path="/"
        description="DPapyru 的个人主页 — 关于我。"
      />,
    );

    expect(document.title).toBe(pageTitle("关于我"));
    expect(readMeta("name", "description")).toBe("DPapyru 的个人主页 — 关于我。");
    expect(readMeta("property", "og:title")).toBe(pageTitle("关于我"));
    expect(readMeta("property", "og:url")).toBe(SITE_URL);
    expect(readMeta("property", "og:site_name")).toBe(SITE_NAME);
    expect(readMeta("name", "twitter:card")).toBe("summary_large_image");
  });

  it("卸载后清理自己写入的 meta 标签(避免跨路由残留)", () => {
    const { unmount } = render(<Seo title="A" path="/blog" />);
    expect(document.head.querySelectorAll(`[${SEO_DATA_ATTR}]`).length).toBeGreaterThan(0);

    unmount();
    expect(document.head.querySelectorAll(`[${SEO_DATA_ATTR}]`).length).toBe(0);
  });
});
