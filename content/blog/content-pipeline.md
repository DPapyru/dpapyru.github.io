---
title: "我的内容管线设计笔记"
date: "2024-06-01"
palette:
  key: "#c0392b"
  accent: "#2980b9"
excerpt: 用 gray-matter 驱动的构建期内容管线,把 Markdown 元数据变成可维护的文章索引。
tags:
  - pipeline
  - markdown
---

> [!NOTE]
> 这是一条 Callout 提示。正文里可以用 [[key]]着色标记[[/key]] 标出关键术语。

## 构建期索引

站长以 Markdown 撰写,构建期自动扫描生成索引,列表页由索引驱动,无需手写维护。

### 代码示例

```ts
export function add(a: number, b: number): number {
  return a + b;
}
```

用 [[accent]]强调[[/accent]] 来让重点更醒目。

### 协议嵌入示例

下面这行指令会在渲染期把 code/demo.ts 拉取并以代码块展示:

cs:code/demo.ts

### 渲染能力示例

下面两行指令由 rendering 组件接管,渲染出真实的动画与 shader:

anims:demos/demo-anim-rotating-square.js

fx:demos/fna-vertex-demo.fx
