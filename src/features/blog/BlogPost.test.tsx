import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BlogPost } from "./BlogPost";
import blogIndex from "../../../public/blog-index.json";

function renderDetail(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/blog/${slug}`]}>
      <Routes>
        <Route path="/blog/:slug" element={<BlogPost />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BlogPost 文章详情页", () => {
  it("按 URL slug 渲染对应文章的标题与正文", () => {
    expect(blogIndex.length).toBeGreaterThan(0);
    const target = blogIndex[0];

    renderDetail(target.slug);

    expect(screen.getByRole("heading", { name: target.title })).toBeInTheDocument();
    // 正文经 #8 前的朴素渲染,以原文档呈现(正文内容不应为空)
    const body = screen.getByText(new RegExp(`${target.date}`)).closest("article");
    expect(body).not.toBeNull();
    expect(body?.textContent).toContain(target.date);
  });

  it("未知 slug 给出「文章不存在」明确反馈", () => {
    renderDetail("does-not-exist");
    expect(screen.getByRole("heading", { name: "文章不存在" })).toBeInTheDocument();
    expect(screen.getByText(/没有找到 slug 为/)).toBeInTheDocument();
  });
});