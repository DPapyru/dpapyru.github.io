import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Blog } from "./Blog";
import blogIndex from "../../../public/blog-index.json";

function renderBlog() {
  return render(
    <MemoryRouter>
      <Blog />
    </MemoryRouter>,
  );
}

describe("Blog 列表页", () => {
  it("由索引驱动渲染全部文章卡片", () => {
    renderBlog();
    expect(screen.getByRole("heading", { name: "博客" })).toBeInTheDocument();
    for (const post of blogIndex) {
      expect(screen.getByRole("link", { name: new RegExp(post.title) })).toBeInTheDocument();
    }
  });

  it("每张卡片链接到 /blog/:slug 详情路由", () => {
    renderBlog();
    // 索引应为非空,否则本测试无意义
    expect(blogIndex.length).toBeGreaterThan(0);
    for (const post of blogIndex) {
      const link = screen.getByRole("link", { name: new RegExp(post.title) });
      expect(link).toHaveAttribute("href", `/blog/${post.slug}`);
    }
  });
});
