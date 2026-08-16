import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";

// 反引号在 md 代码围栏中需要,这里用 fromCharCode 避免与围栏本义冲突。
const BT = String.fromCharCode(96);
function fence(code: string, lang = "") {
  return BT + BT + BT + lang + "\n" + code + "\n" + BT + BT + BT;
}

function renderMd(source: string) {
  return render(<MarkdownRenderer source={source} />);
}

describe("Markdown 渲染能力(接缝 1):源文 -> 渲染产物", () => {
  it("GFM 表格渲染为 <table> 结构(含表头/单元格)", () => {
    renderMd(
      ["| 名称 | 状态 |",
        "| ---- | ---- |",
        "| 管线 | 就绪 |",
        "| 高亮 | 完成 |"].join("\n"),
    );

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();

    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(["名称", "状态"]);

    const cells = within(table).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual(["管线", "就绪", "高亮", "完成"]);
  });

  it("GFM 任务列表渲染为可勾选的 checkbox", () => {
    renderMd("- [x] 已完成\n- [ ] 待办");

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("代码块带语法高亮的 hljs / language-* 类", () => {
    renderMd(fence("const a: number = 1;", "ts"));

    const code = document.querySelector("pre code.hljs") as HTMLElement | null;
    expect(code).not.toBeNull();
    expect(code!.className).toContain("hljs");
    expect(code!.className).toContain("language-ts");

    const keyword = code!.querySelector(".hljs-keyword");
    expect(keyword).not.toBeNull();
    expect(keyword!.textContent).toBe("const");
  });

  it("未标注语言的代码块仍渲染且不抛错", () => {
    renderMd(fence("plain text"));
    const pre = document.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain("plain text");
  });

  it("插件挂载点:remark/rehype 插件 props 可注入且与基底合成", () => {
    const noopPlugin = () => () => undefined as unknown as void;
    render(
      <MarkdownRenderer source={"## 标题\n正文"} remarkPlugins={[noopPlugin as never]} rehypePlugins={[]} />,
    );
    expect(screen.getByRole("heading", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByText("正文")).toBeInTheDocument();
  });
});
