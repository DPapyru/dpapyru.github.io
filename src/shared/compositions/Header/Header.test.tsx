import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { Header } from "./Header";
import { AppRoutes } from "../../../App";

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Header />
    </MemoryRouter>,
  );
}

describe("Header 顶部导航", () => {
  it("展示三个板块入口", () => {
    renderWithRouter("/");
    expect(screen.getByRole("navigation", { name: "板块导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "关于我" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "博客" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "联系方式" })).toBeInTheDocument();
  });

  it("当前板块的链接有选中态(aria-current=page)", () => {
    renderWithRouter("/blog");
    expect(screen.getByRole("link", { name: "博客" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "关于我" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "联系方式" })).not.toHaveAttribute("aria-current");
  });

  it("在「关于我」页仅「关于我」处于选中态", () => {
    renderWithRouter("/");
    expect(screen.getByRole("link", { name: "关于我" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "博客" })).not.toHaveAttribute("aria-current");
  });

  it("点击导航可在板块间切换", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "关于我" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "博客" }));
    expect(screen.getByRole("heading", { name: "博客" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "联系方式" }));
    expect(screen.getByRole("heading", { name: "联系方式" })).toBeInTheDocument();
  });
});
