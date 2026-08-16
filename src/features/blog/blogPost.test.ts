import { describe, expect, it } from "vitest";
import { parsePostFull } from "./blogPost";

describe("文章详情接缝:parsePostFull", () => {
  it("剥离 front matter,得到元数据与原始正文(body)", () => {
    const post = parsePostFull({
      slug: "hello",
      content: [
        "---",
        'title: "你好"',
        'date: "2024-06-01"',
        "palette:",
        '  key: "#c0392b"',
        "excerpt: 摘要",
        "---",
        "",
        "第一行正文。",
        "",
        "第二行正文。",
      ].join("\n"),
    });

    expect(post.slug).toBe("hello");
    expect(post.title).toBe("你好");
    expect(post.date).toBe("2024-06-01");
    expect(post.excerpt).toBe("摘要");
    expect(post.palette).toEqual({ key: "#c0392b" });
    expect(post.body).toBe(["", "第一行正文。", "", "第二行正文。"].join("\n"));
  });

  it("保留正文里的 Markdown 结构,供 #8 渲染层接缝下探", () => {
    const post = parsePostFull({
      slug: "md",
      content: ["---", 'title: "md"', 'date: "2024-01-01"', "palette:", '  a: "#fff"', "---", "", "## 标题"].join("\n"),
    });
    expect(post.body).toContain("## 标题");
  });
});
