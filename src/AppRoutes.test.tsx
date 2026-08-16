import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { AppRoutes } from "./App";

function renderRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("板块路由", () => {
  it("默认落地「关于我」板块", () => {
    renderRoute("/");
    expect(screen.getByRole("heading", { name: "关于我" })).toBeInTheDocument();
  });

  it("URL 直达各板块", () => {
    renderRoute("/blog");
    expect(screen.getByRole("heading", { name: "博客" })).toBeInTheDocument();

    renderRoute("/contact");
    expect(screen.getByRole("heading", { name: "联系方式" })).toBeInTheDocument();
  });

  it("未知路径渲染 404 占位", () => {
    renderRoute("/no-such-page");
    expect(screen.getByRole("heading", { name: /404/ })).toBeInTheDocument();
  });
});
