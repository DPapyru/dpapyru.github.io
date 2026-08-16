import { describe, expect, it } from "vitest";
import { buildBlogIndex, parseBlogPost, type BlogSourceFile } from "./blogIndex";

describe("内容管线(接缝 1):索引生成", () => {
  it("解析单篇 front matter 得到 slug 与元数据字段", () => {
    const post = parseBlogPost({
      slug: "content-pipeline",
      content: [
        "---",
        'title: "我的内容管线设计笔记"',
        'date: "2024-06-01"',
        "palette:",
        '  key: "#c0392b"',
        '  accent: "#2980b9"',
        "excerpt: 这是一段摘要。",
        "tags:",
        "  - pipeline",
        "  - markdown",
        "---",
        "",
        "正文内容……",
      ].join("\n"),
    });

    expect(post.slug).toBe("content-pipeline");
    expect(post.title).toBe("我的内容管线设计笔记");
    expect(post.date).toBe("2024-06-01");
    expect(post.excerpt).toBe("这是一段摘要。");
    expect(post.palette).toEqual({ key: "#c0392b", accent: "#2980b9" });
    expect(post.tags).toEqual(["pipeline", "markdown"]);
  });

  it("buildBlogIndex 按 date 倒序排列(新文章在前)", () => {
    const files: BlogSourceFile[] = [
      {
        slug: "old",
        content: ["---", 'title: "旧"', 'date: "2024-01-01"', "---", ""].join("\n"),
      },
      {
        slug: "new",
        content: ["---", 'title: "新"', 'date: "2024-06-01"', "---", ""].join("\n"),
      },
      {
        slug: "mid",
        content: ["---", 'title: "中"', 'date: "2024-03-01"', "---", ""].join("\n"),
      },
    ];

    const index = buildBlogIndex(files);
    expect(index.map((p) => p.slug)).toEqual(["new", "mid", "old"]);
  });

  it("忽略缺失的 excerpt/tags,返回空日期不抛错", () => {
    const post = parseBlogPost({
      slug: "minimal",
      content: ["---", 'title: "最小"', 'date: "2024-01-01"', "palette:", '  a: "#fff"', "---", ""].join("\n"),
    });

    expect(post.excerpt).toBeUndefined();
    expect(post.tags).toBeUndefined();
    expect(post.date).toBe("2024-01-01");
  });
});
