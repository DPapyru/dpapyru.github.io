/**
 * 协议嵌入渲染插件(ticket #11)——把 `cs:`/`anims:`/`fx:` 协议引用块渲染为嵌入展示。
 *
 * 语法(块级指令,独占一段,一行):
 *   cs:code/demo.ts                  —— 拉取外部代码文件并以代码块展示
 *   anims:demos/demo-anim-a.js       —— 动画嵌入(本期占位,真实渲染由 #17 接管)
 *   fx:demos/fna-vertex-demo.fx      —— shader 嵌入(本期占位,真实渲染由 #17 接管)
 * 其中 `<path>` 为站点内相对路径(站点根即 public/ 根,如 code/demo.ts)。
 *
 * remark 插件(工厂函数):运行时遍历 mdast 的 paragraph,凡整段文本恰好是上述一行指令的
 * 替换为自定义节点 protocolEmbed;后者经 data.hName/hProperties/hChildren 交给
 * remark-rehype 转成真实的 HAST 元素(div.protocol-embed),再由 react-markdown 原生渲染,
 * 无需 rehype-raw,也不改动 MarkdownRenderer。cs: 的代码文本在**构建期**用 import.meta.glob
 * (?raw)按需内联进 bundle(与 loadPost 同思路),运行时同步查表即可,无需网络请求——
 * 因此本插件是同步变换,兼容 react-markdown 默认的 runSync 管线。
 *
 * 降级(不抛错):cs: 查不到文件时渲染错误提示块;anims:/fx: 本期恒为占位节点,均不破坏整篇。
 * 所有嵌入节点都带 data-protocol 与 data-path 属性,供 #17 接管真实渲染时定位素材。
 */
import type { Plugin } from "unified";
import type { Parent, Root, RootContent } from "mdast";
import type { Element, ElementContent } from "hast";
import { visit } from "unist-util-visit";

/** 三种协议名。 */
export const PROTOCOLS = ["cs", "anims", "fx"] as const;
export type Protocol = (typeof PROTOCOLS)[number];

/** 匹配独占一段的协议指令:cs:path / anims:path / fx:path。 */
const DIRECTIVE_RE = /^\s*(cs|anims|fx)\s*:\s*(\S+)\s*$/;

/** 代码文件加载器:给定站点内相对路径,返回源码文本;查不到返回 undefined。 */
export type CodeLoader = (path: string) => string | undefined;

/**
 * 打开 {@link CodeLoader} 的注入点。生产默认用 import.meta.glob 在构建期内联 public/ 下的
 * 代码素材;测试可注入 mock 文件(接缝 1 的「拉取」)。默认加载器由模块惰性构建一次。
 */
export interface ProtocolEmbedOptions {
  loadCode?: CodeLoader;
}

/** 文件扩展名 -> rehype-highlight 语言别名(用于给 cs: 代码块标注 language-*)。 */
const LANG_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  css: "css",
  html: "html",
  json: "json",
  md: "markdown",
  sh: "bash",
  fx: "hlsl",
  hlsl: "hlsl",
  glsl: "glsl",
};

/** 由站点内相对路径取文件扩展名。 */
function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/**
 * 构建默认代码加载器:构建期内联 src/assets/ 下各文件为字符串(import.meta.glob ?raw,
 * eager 使运行时同步访问),键归一化为「src/assets/ 之下的相对路径」及 basename 双查找,
 * 以便指令里写 code/demo.ts 或 demo.ts 都能命中。
 */
function defaultCodeLoader(): CodeLoader {
  const entrypoints = import.meta.glob("../../../../src/assets/code/**/*.{ts,tsx,js,jsx,css,html,json}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const byPath = new Map<string, string>();
  const byBase = new Map<string, string>();

  for (const [key, raw] of Object.entries(entrypoints)) {
    if (typeof raw !== "string") continue; // 目录/二进制跳过
    const marker = "/src/assets/";
    const at = key.lastIndexOf(marker);
    const rel = at >= 0 ? key.slice(at + marker.length) : key;
    byPath.set(rel, raw);
    const base = rel.slice(rel.lastIndexOf("/") + 1);
    if (base) byBase.set(base, raw);
  }

  return (path: string): string | undefined => {
    const name = path;
    let rel = path;
    if (path.startsWith("public/")) {
      rel = path.slice("public/".length);
    } else if (path.startsWith("src/assets/")) {
      rel = path.slice("src/assets/".length);
    }
    const hit = byPath.get(rel) ?? byPath.get(name) ?? byBase.get(rel.slice(rel.lastIndexOf("/") + 1));
    return hit;
  };
}

/** 组装 protocolEmbed 节点需要的 HAST children。 */
function buildChildren(proto: Protocol, path: string, code: string | undefined): ElementContent[] {
  const head: Element = {
    type: "element",
    tagName: "div",
    properties: { className: ["protocol-head"] },
    children: [
      { type: "element", tagName: "span", properties: { className: ["protocol-kind"] }, children: [{ type: "text", value: proto + ":" }] },
      { type: "element", tagName: "span", properties: { className: ["protocol-path"] }, children: [{ type: "text", value: path }] },
    ],
  };

  if (proto === "cs") {
    if (code === undefined) {
      const missing: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["protocol-placeholder", "protocol-error-text"] },
        children: [{ type: "text", value: "未找到代码文件: " + path }],
      };
      return [head, missing];
    }
    const ext = extOf(path);
    const lang = LANG_BY_EXT[ext];
    const codeAttrs = lang ? { className: ["language-" + lang] } : {};
    const pre: Element = {
      type: "element",
      tagName: "pre",
      properties: { className: ["protocol-code"] },
      children: [
        {
          type: "element",
          tagName: "code",
          properties: codeAttrs,
          children: [{ type: "text", value: code }],
        },
      ],
    };
    return [head, pre];
  }

  // anims / fx:本期占位节点,数据交给 #17 真实渲染接管。
  const placeholder: Element = {
    type: "element",
    tagName: "div",
    properties: { className: ["protocol-placeholder"] },
    children: [
      {
        type: "text",
        value: proto === "anims" ? "动画嵌入(真实渲染由 #17 接管)" : "Shader 嵌入(真实渲染由 #17 接管)",
      },
    ],
  };
  return [head, placeholder];
}

/**
 * protocolEmbed 工厂:默认注入「构建期内联」代码加载器;返回注入 remarkPlugins 的 remark 插件。
 * 用法:<MarkdownRenderer source={body} remarkPlugins={[protocolEmbed()]} />。
 * 只改整段为一行的协议指令,其余段落原样保留;无命中时退化为普通段落。
 */
export function protocolEmbed(options: ProtocolEmbedOptions = {}): Plugin<[], Root> {
  const loadCode = options.loadCode ?? defaultCodeLoader();

  return () => (tree: Root): void => {
    visit(tree, "paragraph", (node, index, parent) => {
      // 仅当段落的直接子级全是 text 时才可能是指令整段(含行内标记则不是)。
      const texts = node.children.filter((c) => c.type === "text");
      if (texts.length !== node.children.length || texts.length === 0) return;

      const joined = texts.map((t) => t.value).join("");
      const m = DIRECTIVE_RE.exec(joined);
      if (!m || parent === undefined || index === undefined) return;

      const proto = m[1] as Protocol;
      const path = m[2];
      const code = proto === "cs" ? loadCode(path) : undefined;
      const embed: RootContent = {
        type: "protocolEmbed",
        data: {
          hName: "div",
          hProperties: {
            className: ["protocol-embed", "protocol-embed-" + proto],
            dataProtocol: proto,
            dataPath: path,
          },
          hChildren: buildChildren(proto, path, code),
        },
      } as unknown as RootContent;
      (parent as Parent).children[index] = embed;
    });
  };
}
