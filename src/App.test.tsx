import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("渲染「关于我」板块占位页", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "关于我" })).toBeInTheDocument();
  });
});
