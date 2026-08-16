import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { PluggableList } from "unified";
import styles from "./MarkdownRenderer.module.css";
// 代码块语法高亮主题:明色用 highlight.js 官方 github 主题;
// 暗色覆盖与代码块排版见 highlight-theme.css(全局类,不经 CSS Modules 哈希)。
import "highlight.js/styles/github.css";
import "../../../styles/highlight-theme.css";

/**
 * Markdown 渲染能力(共享层,接缝 1) —— 把原始 Markdown 渲染为 React 元素树。
 *
 * 管线基底:
 *   react-markdown(解析 md -> React 元素)+ remark-gfm(GFM 表格/任务列表)
 *   + rehype-highlight(基于 lowlight 的代码块语法高亮,产出 .hljs 与 language-* 类)
 *
 * 插件挂载点(#9 Callout / #10 着色标记 / #11 协议嵌入):
 *   内置 remarkPlugins / rehypePlugins 作为基底数组;后续 ticket 经同名可选 props
 *   注入各自的 remark/rehype 插件,与本组件内的基底合成最终数组,无需改动本组件。
 *   本期**不**实现这三个插件,仅把注入缝留好。
 *
 * 测试只断言公开 API 的外显行为(source -> 渲染产物),不测内部解析细节。
 */
export interface MarkdownRendererProps {
  /** 待渲染的原始 Markdown 源文。 */
  source: string;
  /** 追加的 remark 插件(合成到 GFM 之后),供 #9/#10/#11 等注入。 */
  remarkPlugins?: PluggableList;
  /** 追加的 rehype 插件(合成到 highlight 之后),供 #9/#10/#11 等注入。 */
  rehypePlugins?: PluggableList;
  /** 元素级渲染覆盖(透传给 react-markdown),供 #17 协议嵌入渲染接管等使用。 */
  components?: Components;
}

export function MarkdownRenderer({
  source,
  remarkPlugins = [],
  rehypePlugins = [],
  components,
}: MarkdownRendererProps) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, ...remarkPlugins]}
        rehypePlugins={[rehypeHighlight, ...rehypePlugins]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
