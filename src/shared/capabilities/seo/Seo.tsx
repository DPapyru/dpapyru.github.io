import { useEffect } from "react";
import { absoluteUrl, SITE_NAME } from "./site";

/**
 * SEO 能力 —— 共享层(capabilities)。按页面数据设置 document.title 与
 * meta description / Open Graph / Twitter Card,使任意页面被分享或爬取时都有社交预览。
 *
 * 纯函数 buildSeoTags 负责把 props 映射为 head 条目(输入 -> 输出,便于单测);
 * <Seo/> 组件在挂载时把它们写进 document.head,并在路由切换/卸载时清理本组件
 * 之前写入的标签(靠 data-seo 标记),避免跨页残留。
 */

/** head 中某条 meta 的写入描述。 */
export interface SeoHeadEntry {
  attr: "name" | "property";
  key: string;
  content: string;
}

/** Open Graph / Twitter Card 的页面类型。 */
export type SeoType = "website" | "article";

export interface SeoProps {
  /** 完整页面标题(含站点名),写入 document.title / og:title / twitter:title。 */
  title: string;
  /** 站内路径,如 "/"、"/blog"、"/blog/content-pipeline"。
    用于把 og:url 拼成对该主题的绝对 URL。 */
  path: string;
  /** 页面描述;缺省则只写 <meta name="description"> 并按需省略 og/twitter description。 */
  description?: string;
  /** Open Graph 页面类型,默认 website。 */
  type?: SeoType;
  /** 社交预览图(站内路径或绝对 URL);缺省不写 og:image/twitter:image。 */
  image?: string;
}

/** Seo 动态写入 head 后给元素打的标记属性,便于卸载时精确清理。 */
export const SEO_DATA_ATTR = "data-seo";

/**
 * 纯函数:props -> 应写入 head 的标签描述(不含对 DOM 的副作用)。
 * 供 <Seo/> 与测试直接使用(输入 -> 输出)。
 */
export function buildSeoTags(props: SeoProps): {
  title: string;
  url: string;
  tags: SeoHeadEntry[];
} {
  const { title, path, description, type = "website", image } = props;
  const url = absoluteUrl(path);
  const tags: SeoHeadEntry[] = [];

  if (description != null) {
    tags.push({ attr: "name", key: "description", content: description });
  }

  // Open Graph
  tags.push({ attr: "property", key: "og:title", content: title });
  tags.push({ attr: "property", key: "og:type", content: type });
  tags.push({ attr: "property", key: "og:url", content: url });
  tags.push({ attr: "property", key: "og:site_name", content: SITE_NAME });
  if (description != null) {
    tags.push({ attr: "property", key: "og:description", content: description });
  }
  if (image != null) {
    tags.push({ attr: "property", key: "og:image", content: absoluteUrl(image) });
  }

  // Twitter Card
  tags.push({ attr: "name", key: "twitter:card", content: "summary_large_image" });
  tags.push({ attr: "name", key: "twitter:title", content: title });
  if (description != null) {
    tags.push({ attr: "name", key: "twitter:description", content: description });
  }
  if (image != null) {
    tags.push({ attr: "name", key: "twitter:image", content: absoluteUrl(image) });
  }

  return { title, url, tags };
}

/** 按 attr+key 定位 meta;存在则更新其上,否则新建并打 data-seo 标记。 */
function upsertMeta(entry: SeoHeadEntry): void {
  const selector = `meta[${entry.attr}="${entry.key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(entry.attr, entry.key);
    el.setAttribute(SEO_DATA_ATTR, "");
    document.head.appendChild(el);
  }
  el.setAttribute("content", entry.content);
}

/** 清理之前由 <Seo/> 写入 head 的 data-seo 标签,避免跨路由残留。 */
function clearSeoTags(): void {
  document.head.querySelectorAll(`[${SEO_DATA_ATTR}]`).forEach((el) => el.remove());
}

/**
 * 把 props 真正写入 document.head(标题 + 全部 meta)。
 * 返回清理函数,卸载时调用可移除本组件写入的标签。
 */
export function applyHead(props: SeoProps): () => void {
  clearSeoTags();
  const { title, tags } = buildSeoTags(props);
  document.title = title;
  for (const entry of tags) {
    upsertMeta(entry);
  }
  return () => {
    clearSeoTags();
  };
}

/**
 * 页面级 SEO 标签组件 —— 纯副作用(返回 null),不渲染任何可见节点。
 * 挂载/路由变化时把 props 写入文档标题与 meta;卸载时清理自己写入的标签。
 */
export function Seo(props: SeoProps) {
  useEffect(
    () => applyHead(props),
    [props.title, props.path, props.description, props.type, props.image],
  );
  return null;
}
