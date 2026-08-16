import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { protocolEmbed, type CodeLoader } from "./protocol-embed";

/**
 * 协议嵌入插件(接缝 2,ticket #11):公开外部行为 —— 给定注入的代码加载器 + md 源文,
 * 经 <MarkdownRenderer remarkPlugins={[protocolEmbed({ loadCode })]}> 渲染,
 * 断言 cs: 拉取并展示代码块、anims:/fx: 产出带 data 属性的占位节点,以及各降级不抛错。
 * 只测输入->输出,不测内部解析细节。
 */
function renderWith(loadCode: CodeLoader | undefined, source: string) {
  return render(
    <MarkdownRenderer
      source={source}
      remarkPlugins={[protocolEmbed(loadCode ? { loadCode } : {})]}
    />,
  );
}

const MOCK_FILES: Record<string, string> = {
  "code/demo.ts": "export const x: number = 1;\n",
};

const mockLoader: CodeLoader = (path) => MOCK_FILES[path];

describe("协议嵌入(接缝 2):cs:/anims:/fx: 指令 -> 渲染产物", () => {
  it("cs: 拉取外部代码文件并以代码块展示(含协议/路径属性)", () => {
    renderWith(mockLoader, "\ncs:code/demo.ts\n\n");

    const embed = document.querySelector("div.protocol-embed.protocol-embed-cs") as HTMLElement | null;
    expect(embed).not.toBeNull();
    expect(embed!.getAttribute("data-protocol")).toBe("cs");
    expect(embed!.getAttribute("data-path")).toBe("code/demo.ts");

    // 头栏展示协议与路径。
    expect(embed!.querySelector(".protocol-kind")!.textContent).toBe("cs:");
    expect(embed!.querySelector(".protocol-path")!.textContent).toBe("code/demo.ts");

    // 代码内容以 pre>code 展示。
    const code = embed!.querySelector("pre.protocol-code code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toContain("export const x: number = 1;");
  });

  it("cs: 代码块带 rehype-highlight 的 hljs / language-* 类(经渲染管线合成)", () => {
    renderWith(mockLoader, "\ncs:code/demo.ts\n\n");

    const code = document.querySelector("pre.protocol-code code.hljs") as HTMLElement | null;
    expect(code).not.toBeNull();
    // .ts 映射为 typescript 语言。
    expect(code!.className).toContain("language-typescript");
    expect(code!.querySelector(".hljs-keyword")).not.toBeNull();
  });

  it("cs: 查不到文件时渲染错误提示块,不抛错、不破坏整篇", () => {
    renderWith(mockLoader, "\ncs:missing/file.ts\n\n正文仍渲染");

    const embed = document.querySelector("div.protocol-embed.protocol-embed-cs") as HTMLElement | null;
    expect(embed).not.toBeNull();
    const err = embed!.querySelector(".protocol-error-text");
    expect(err).not.toBeNull();
    expect(err!.textContent).toContain("missing/file.ts");
    expect(screen.getByText(/正文仍渲染/)).toBeInTheDocument();
  });

  it.each(["anims" as const, "fx" as const])(
    "%s: 产出带 data-protocol 与 data-path 的占位节点,不拉取文件",
    (proto) => {
      renderWith(mockLoader, "\n" + proto + ":path/to/asset" + (proto === "fx" ? ".fx" : ".js") + "\n\n");

      const embed = document.querySelector(
        "div.protocol-embed.protocol-embed-" + proto,
      ) as HTMLElement | null;
      expect(embed).not.toBeNull();
      expect(embed!.getAttribute("data-protocol")).toBe(proto);
      expect(embed!.getAttribute("data-path")).toContain("path/to/asset");

      // 占位文本存在(#17 接管真实渲染前不影响整篇)。
      const placeholder = embed!.querySelector(".protocol-placeholder");
      expect(placeholder).not.toBeNull();
      expect(placeholder!.textContent).toContain("#17");
    },
  );

  it("非指令段落(普通文字/含行内标记)不受影响", () => {
    renderWith(mockLoader, "cs:code/demo.ts 不是独占整段\n\n**cs:xxx**\n\n普通段落");

    // 不含任何 .protocol-embed;这些行按普通段落/行内内容渲染。
    expect(document.querySelector(".protocol-embed")).toBeNull();
    expect(screen.getByText("cs:code/demo.ts 不是独占整段")).toBeInTheDocument();
    expect(screen.getByText("cs:xxx")).toBeInTheDocument();
  });

  it("缺省加载器(不注入)不抛错,未知 cs 走错误占位", () => {
    renderWith(undefined, "\ncs:nope.txt\n\n正文");
    const embed = document.querySelector("div.protocol-embed.protocol-embed-cs") as HTMLElement | null;
    expect(embed).not.toBeNull();
    expect(embed!.querySelector(".protocol-error-text")).not.toBeNull();
    expect(screen.getByText(/正文/)).toBeInTheDocument();
  });
});
