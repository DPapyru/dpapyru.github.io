/**
 * Callout 渲染插件(ticket #9)—— 把 GFM 式的 5 级提示框语法渲染为带样式的提示框。
 *
 * 语法(blockquote 首行):> [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION]
 * 与普通 blockquote 视觉区分,各级样式不同;样式见 callout.module.css
 * (消费主题 CSS 变量,随明/暗主题切换)。
 *
 * rehype 插件(opaque 于 markdown 管线):运行期遍历 HAST 的 blockquote,识别首段
 * 文本开头的提示级别标记,若无则原样返回(视为普通引用);若有则:
 *   1. 在 blockquote 上加 callout 类(通用 + 级别类,如 callout-note)与 data-type 属性;
 *   2. 把标记行抽为标题元素 .callout-title(文本即级别关键词 NOTE 等);
 *   3. 经标记后的剩余正文放进 .callout-body。
 * 本插件只改 HAST 结构/类名,不改正文内容。
 */
import type { Plugin } from "unified";
import type { Element, ElementContent, Root, Text } from "hast";
import { visit } from "unist-util-visit";

/** 5 级 Callout 的级别标识(与语法魔表一致)。 */
export const CALLOUT_LEVELS = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
export type CalloutLevel = (typeof CALLOUT_LEVELS)[number];

/** 匹配 blockquote 首段文本开头的级别标记,忽略大小写。 */
const MARKER_RE = /^\[(!)(note|tip|important|warning|caution)\]/i;

/** 收集一段文本节点里完整的文本值。 */
function textValue(node: Element): string {
  return node.children
    .filter((c): c is Text => c.type === "text")
    .map((c) => c.value)
    .join("");
}

/** 在 blockquote 直接子级里找第一个段落元素。 */
function firstParagraph(node: Element): Element | undefined {
  return node.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "p",
  );
}

/** 提取 blockquote 首段的 Callout 级别;非 Callout 返回 null。 */
function calloutLevel(node: Element): CalloutLevel | null {
  const p = firstParagraph(node);
  if (!p) return null;
  const m = MARKER_RE.exec(textValue(p));
  if (!m) return null;
  return m[2].toUpperCase() as CalloutLevel;
}

/**
 * rehypeCallout 插件:批处理所有 blockquote,把带级别标记的转为 Callout 提示框。
 * 用法:<MarkdownRenderer rehypePlugins={[rehypeCallout]} />。
 */
export const rehypeCallout: Plugin<[], Root> = () => (tree) => {
  visit(tree, "element", (node) => {
    if (node.type !== "element" || node.tagName !== "blockquote") return;
    const kind = calloutLevel(node);
    if (!kind) return; // 普通 blockquote,原样保留
    toCallout(node, kind);
  });
};

/** 就地改写 blockquote 结构为 Callout(标题 + 正文容器)。 */
function toCallout(blockquote: Element, kind: CalloutLevel): void {
  const pIndex = blockquote.children.findIndex(
    (c): c is Element => c.type === "element" && c.tagName === "p",
  );
  const p = pIndex >= 0 ? (blockquote.children[pIndex] as Element) : undefined;
  if (!p) return;

  // 1) 打标:通用 callout 类 + 级别类(与普通 blockquote 区分的关键)。
  const existing = blockquote.properties.className;
  const base = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === "string"
      ? [existing]
      : [];
  const cls = [...base, "callout", `callout-${kind.toLowerCase()}`];
  blockquote.properties.className = cls;
  blockquote.properties.dataType = kind;

  // 2) 抽标题:级别关键词即标题文本。
  const title: Element = {
    type: "element",
    tagName: "div",
    properties: { className: ["callout-title"] },
    children: [{ type: "text", value: kind }],
  };

  // 3) 剥离标记后的剩余正文:标记后的换行/空白裁剪,余下进 .callout-body。
  const firstText = p.children.find((c): c is Text => c.type === "text");
  let bodyText = "";
  if (firstText) {
    bodyText = firstText.value.replace(MARKER_RE, "").replace(/^\s+/, "");
  }
  const bodyChildren: ElementContent[] = [...p.children];
  if (bodyChildren.length > 0 && bodyChildren[0].type === "text") {
    bodyChildren[0] = { type: "text", value: bodyText };
  }
  const nonEmpty = bodyChildren.filter(
    (c) => !(c.type === "text" && c.value === ""),
  );

  // 4) 重组 blockquote 子级:标题 + 正文容器(Markdown 层级里的 p 转成 div.container 子级)。
  const result: ElementContent[] = [title];
  if (nonEmpty.length > 0) {
    result.push({
      type: "element",
      tagName: "div",
      properties: { className: ["callout-body"] },
      children: nonEmpty,
    });
  }
  // 保留段落之后的其余 blockquote 直属子级(如尾部换行文本)。
  result.push(...blockquote.children.slice(pIndex + 1));
  blockquote.children = result;
}
