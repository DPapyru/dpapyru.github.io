import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BlogPost } from "./BlogPost";
import blogIndex from "../../generated/blog-index.json";

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

  it("协议嵌入(#17):anims:/fx: 指令被渲染接管为真实组件", () => {
    renderDetail("content-pipeline");

    // anims: 指令 → AnimCanvas 挂载(canvas 出现,类名经 props 透传)。
    const animCanvas = document.querySelector("canvas.protocol-embed-anims");
    expect(animCanvas).not.toBeNull();

    // fx: 指令 → ShaderStage 挂载(canvas 出现;jsdom 无 WebGL2 时展示明确错误横幅)。
    expect(screen.getByTestId("shader-stage-canvas")).toBeInTheDocument();
  });
});