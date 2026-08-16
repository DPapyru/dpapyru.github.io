import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { coloringMark } from "./coloring-marks";
import type { Palette } from "../../../features/blog/blogIndex";
/** jsdom 会把内联 color 的 hex 归一化为 rgb(如 #c0392b -> rgb(192, 57, 43))。 */
function rgb(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error("bad hex: " + hex);
  const n = parseInt(m[1], 16);
  return "rgb(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ")";
}

/**
 * 着色标记插件(接缝 2,ticket #10):公开外部行为 —— 给定 palette + md 源文,
 * 经 <MarkdownRenderer remarkPlugins={[coloringMark(palette)]}> 渲染,
 * 断言渲染产物里是否出现带色的 <span>,及降级时是否退化为普通文本。
 * 只测输入→输出,不测内部解析细节。
 */
function renderWith(palette: Palette, source: string) {
  return render(<MarkdownRenderer source={source} remarkPlugins={[coloringMark(palette)]} />);
}

/** 取所有带内联 color 样式的 span(即着色标记产出的 span)。 */
function coloredSpans() {
  return Array.from(document.querySelectorAll("span")).filter((el) => {
    const color = el.getAttribute("style") || "";
    return color.includes("color:");
  });
}

describe("着色标记(接缝 2):palette + md -> 渲染产物", () => {
  it("命中色板的 [[key]] 文字[[/key]] 渲染为带该颜色的 span", () => {
    renderWith({ key: "#c0392b" }, "正文开始，[[key]]关键术语[[/key]]继续。");

    const span = screen.getByText("关键术语").closest("span");
    expect(span).not.toBeNull();
    expect(span!.getAttribute("style")).toContain(rgb("#c0392b"));
    // 内容与其余正文完整保留。
    expect(screen.getByText(/正文开始/)).toBeInTheDocument();
    expect(screen.getByText(/继续/)).toBeInTheDocument();
  });

  it("不同 key 用色板里各自颜色(同一文中可共存多个着色标记)", () => {
    renderWith(
      { key: "#c0392b", accent: "#2980b9" },
      "[[key]]甲[[/key]]与[[accent]]乙[[/accent]]",
    );

    const colors = coloredSpans().map((el) => el.getAttribute("style")).join(" ");
    expect(colors).toContain(rgb("#c0392b"));
    expect(colors).toContain(rgb("#2980b9"));
  });

  it("未知 key 降级为普通文本:不产出 span、内容保留、不抛错", () => {
    renderWith({ key: "#c0392b" }, "这里 [[unknown]]看不到颜色[[/unknown]]。");

    // 无任何带色 span。
    expect(coloredSpans()).toHaveLength(0);
    // 原标记内文字仍以普通文本呈现。
    const text = document.body.textContent || "";
    expect(text).toContain("看不到颜色");
    // 降级后标记符被剥离(内容干净)。
    expect(text).not.toContain("[[unknown]]");
  });

  it("无色板(空 palette)时全部标记降级为普通文本,不抛错", () => {
    renderWith({}, "只有 [[key]]纯文本[[/key]]。");
    expect(coloredSpans()).toHaveLength(0);
    expect(document.body.textContent).toContain("纯文本");
  });

  it("含普通 Markdown 元素(粗体)的正文,着色标记不影响其渲染", () => {
    renderWith({ key: "#c0392b" }, "**加粗** 与 [[key]]着色[[/key]] 混合");

    expect(screen.getByRole("strong")).toBeInTheDocument();
    const span = screen.getByText("着色").closest("span");
    expect(span?.getAttribute("style")).toContain(rgb("#c0392b"));
  });

  it("未闭合/形如非法的行内标记原样呈现且不抛错", () => {
    // 缺少闭合标记:开标记按普通文本保留。
    renderWith({ key: "#c0392b" }, "残缺[[key]没闭合");
    expect(coloredSpans()).toHaveLength(0);
    expect(document.body.textContent).toContain("[[key]");
    expect(document.body.textContent).toContain("没闭合");

    // 非法 key(含空格,不匹配合法 key 字符)。
    renderWith({ key: "#c0392b" }, "[[a b]]非法[[/a b]]");
    expect(coloredSpans()).toHaveLength(0);
    expect(document.body.textContent).toContain("非法");
  });
});
