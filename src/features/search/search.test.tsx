import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Search } from "./Search";
import type { SearchQuery, SearchResult } from "./search";

describe("搜索占位模块", () => {
  it("渲染搜索入口(输入框 + 按钮),且未搜索时不显示'开发中'提示", () => {
    render(<Search />);
    expect(screen.getByRole("heading", { name: "搜索" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "搜索关键词" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "搜索" })).toBeInTheDocument();
    expect(screen.queryByText(/搜索功能开发中/)).not.toBeInTheDocument();
  });

  it("提交表单后回显'开发中'占位提示(不执行真实检索)", () => {
    render(<Search />);
    const input = screen.getByRole("searchbox", { name: "搜索关键词" });
    fireEvent.change(input, { target: { value: "geometry" } });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    expect(screen.getByText(/搜索功能开发中/)).toBeInTheDocument();
    // 提示中回显了检索词
    expect(screen.getByText(/geometry/)).toBeInTheDocument();
  });

  it("空查询提交后不显示占位提示", () => {
    render(<Search />);
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索关键词" }), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    expect(screen.queryByText(/搜索功能开发中/)).not.toBeInTheDocument();
  });
});

describe("搜索类型契约", () => {
  it("SearchQuery/SearchResult 形状可被消费编译", () => {
    const query: SearchQuery = { term: "向量" };
    const results: SearchResult[] = [
      { title: "向量场", url: "/blog/vector-field" },
      { title: "矩阵变换", url: "/blog/matrix", snippet: "仿射变换" },
    ];
    expect(query.term).toBe("向量");
    expect(results).toHaveLength(2);
    expect(results[1].snippet).toBe("仿射变换");
  });
});
