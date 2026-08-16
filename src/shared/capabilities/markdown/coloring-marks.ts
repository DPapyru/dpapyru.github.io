/**
 * 着色标记渲染插件(ticket #10)—— 把行内 [[key]]文字[[/key]] 语法渲染为带色 span。
 *
 * 语法:行内 [[key]]文字[[/key]],key 对应文章 front matter 色板 palette(形如 { key: color })
 * 里的键,文字即着色内容;颜色直接取 palette[key]。
 *
 * remark 插件(工厂函数):运行时遍历 mdast 的 text 节点,把含着色标记的文本拆分重组成
 * 普通文本与自定义节点 coloringMark;后者通过 data.hName/hProperties/hChildren 交给
 * remark-rehype(applyData + defaultUnknownHandler)转成真实的 <span> 元素,由
 * react-markdown 原生渲染(无需 rehype-raw,也不改动 MarkdownRenderer)。
 * 颜色用内联 style 注入,基底类见 coloring-marks.module.css。
 *
 * 降级(不抛错):key 不在 palette 中、或 palette 为空时,不产出 span,只把标记内的文字
 * 作为普通文本保留 —— 内容不丢,只是不着色。非法的未闭合标记同样原样保留为文本。
 */
import type { Plugin } from "unified";
import type { Parent, Root, RootContent } from "mdast";
import type { Palette } from "../../../features/blog/blogIndex";
import styles from "./coloring-marks.module.css";

/** 着色标记的起始标记符。 */
const OPEN = "[[";
/** 着色标记的结束标记符。 */
const CLOSE = "]]";
/** key 的合法字符:字母、数字、下划线、连字符。 */
const KEY_RE = /^([A-Za-z0-9_-]+)]]/;

/** 一段已解析的片段:普通文本,或命中 key 的着色片段。 */
type Segment =
  | { kind: "text"; value: string }
  | { kind: "coloring"; key: string; content: string };

/**
 * 扫描一段字符串,拆出着色标记片段。
 * 找不到匹配闭合标记的 [[key]] 会按普通文本原样保留(不抛错)。
 */
function parseSegments(value: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let buffer = "";
  const n = value.length;

  while (i < n) {
    const openAt = value.indexOf(OPEN, i);
    if (openAt === -1) {
      buffer += value.slice(i);
      break;
    }
    // 补充上一个标记到当前开标记之间的文本。
    buffer += value.slice(i, openAt);

    const m = KEY_RE.exec(value.slice(openAt + OPEN.length));
    if (!m) {
      // 不是合法 key(如 "[[?")——把 "[" 当普通文本,继续向后扫描。
      buffer += "[";
      i = openAt + 1;
      continue;
    }

    const key = m[1];
    // 开标记整体 [[key]] 的结束位置
    const contentStart = openAt + OPEN.length + m[0].length;
    const closeTag = OPEN + "/" + key + CLOSE;
    const closeAt = value.indexOf(closeTag, contentStart);

    if (closeAt === -1) {
      // 没有匹配的闭合标记:把开标记按普通文本保留,继续向后扫描。
      buffer += value.slice(openAt, contentStart);
      i = contentStart;
      continue;
    }

    const content = value.slice(contentStart, closeAt);

    if (buffer !== "") {
      segments.push({ kind: "text", value: buffer });
      buffer = "";
    }
    segments.push({ kind: "coloring", key, content });

    i = closeAt + closeTag.length;
  }

  if (buffer !== "") segments.push({ kind: "text", value: buffer });
  return segments;
}

/** 由着色片段造出 mdast 节点:未知 key 退化为普通文本,命中则产出 span 节点。 */
function segmentToNode(seg: Segment, palette: Palette): RootContent {
  if (seg.kind === "text") return { type: "text", value: seg.value };
  const color = palette[seg.key];
  if (color === undefined) {
    // 降级:key 不在色板(或无 palette)时不着色,内容作为普通文本保留。
    return { type: "text", value: seg.content };
  }
  return {
    type: "coloringMark",
    data: {
      hName: "span",
      hProperties: { className: styles.colored, style: "color:" + color },
      hChildren: [{ type: "text", value: seg.content }],
    },
  } as unknown as RootContent;
}

/**
 * 就地改写一棵 mdast 树里的 text 节点:含着色标记的拆分重排,无标记的保留。
 *
 * 用自有的前序遍历(而非 unist-util-visit)遍历父节点 children:
 * 当命中 text 且含着色标记时,splice 成「普通文本 + coloringMark + 普通文本」,
 * 并把游标推进到插入的末尾,避免重新处理刚插入的节点或踩到兄弟游标错位。
 */
function walk(node: Parent, palette: Palette): void {
  const children = node.children;
  let i = 0;
  while (i < children.length) {
    const child = children[i] as RootContent;
    if (child.type === "text") {
      const segments = parseSegments(child.value);
      // 仅无着色片段时不改写,直接前进。
      if (segments.length === 1 && segments[0].kind === "text") {
        i += 1;
        continue;
      }
      const nodes = segments.map((s) => segmentToNode(s, palette));
      children.splice(i, 1, ...nodes);
      i += nodes.length;
    } else if (Array.isArray((child as Parent).children)) {
      walk(child as Parent, palette);
      i += 1;
    } else {
      i += 1;
    }
  }
}

function transform(tree: Root, palette: Palette): void {
  walk(tree, palette);
}

/**
 * coloringMark 工厂:给定文章色板 palette,返回注入 remarkPlugins 的 remark 插件。
 * 用法:<MarkdownRenderer source={body} remarkPlugins={[coloringMark(post.palette)]} />。
 * palette 为空对象或 key 缺失时,着色片段降级为普通文本(不抛错)。
 */
export function coloringMark(palette: Palette): Plugin<[], Root> {
  // remark 插件形态:构造器() 返回变换器(tree);变换器就地改写 mdast 的 text 节点。
  return () => (tree: Root): void => {
    transform(tree, palette);
  };
}
