# 工程约定 (docs/architecture.md)

dpapyru.github.io 的工程架构与约定。随着后续 ticket 演进,**任何改动此工程结构的 ticket 都必须同步更新本文件**。

## 技术栈与形态

- **构建**:Vite + React 19 + TypeScript,单包仓库,包管理与脚本用 **Bun**(脚本用 `bun run <script>`)。
- **部署**:GitHub Pages,由 `.github/workflows/deploy.yml` 在 push 到 `main` 后自动构建并部署。
- **类型检查**:`bun run typecheck`(= `tsc --noEmit`,strict 模式)为提交门槛。
- **入口**:`index.html` → `src/main.tsx` → `src/App.tsx`。

> 技术栈选型的理由见 `docs/adr/0001-tech-stack.md`。

## 目录结构(单包 + feature-first + 共享层)

```text
src/
├── features/            # 功能模块(feature):一个板块/能力自含组件、服务与类型
│   ├── about/           #   关于我板块
│   ├── blog/            #   博客文章板块
│   ├── contact/         #   联系方式板块
│   ├── theme/           #   主题(明/暗 + accent 预设)
│   ├── search/          #   站内搜索
│   └── rendering/       #   渲染能力(动画/HLSL→GLSL/WebGL2 几何)
├── shared/              # 共享层:跨 feature 复用的能力
│   ├── capabilities/    #   能力(渲染能力、着色标记等运行时能力)
│   ├── services/        #   服务(内容管线、索引构建等)
│   ├── atoms/           #   原子组件
│   └── compositions/    #   组合组件
├── styles/              # 全局样式(global.css 主题变量)
└── test/                # 测试基建(setup)
```

规则:

- **功能模块 (feature)**、**共享层 (shared)** 的术语与边界定义见 `CONTEXT.md` 与 `docs/adr/0002-rendering-extraction.md`。
- 一个板块只在其 feature 目录内自含实现;跨 feature 复用一律下沉到 `shared/`。
- feature 目录内以 `<Name>.module.css` 承载该组件样式(CSS Modules)。

## 样式与主题约定

- 组件样式用 **CSS Modules**(`*.module.css`),通过 `import styles from "./X.module.css"` 使用。
- 全局主题用 **CSS 变量 + `data-theme`**(明/暗 + accent 预设)。
- 全局样式放 `src/styles/global.css`(含默认 CSS 变量与 `prefers-color-scheme` 兜底)。
- 主题模块(`src/features/theme/`)负责 `data-theme` 的切换与 persistence,后续 ticket。

## 测试约定

- 工具:**Vitest** + **React Testing Library** + **jsdom**;**@testing-library/jest-dom** 作为 setup 注入全局 matcher(`src/test/setup.ts`)。
- 运行:`bun run test`(= `vitest run`)。
- 测试策略:只测**模块公开 API 的外部行为**(输入→输出),不测内部实现细节。
- 可测的接缝:
  - **接缝 1 — 内容管线**(`shared/services`):markdown front matter 解析、博客索引构建。
  - **接缝 2 — 渲染运行时**(`shared/capabilities`):着色标记、Callout、协议嵌入的解析/渲染。
- 测试与实现**同批提交**。

## 构建产物约定

- 构建输出目录:`dist/`。
- **404.html SPA 回退**:构建收尾时(`vite.config.ts` 的 `spa404-fallback` 插件,`closeBundle` 钩子)把 `index.html` 复制为 `dist/404.html`,使 GitHub Pages 对任意深链 URL 返回应用入口。
- GitHub Pages 通过 `actions/upload-pages-artifact@v3` 上传 `dist/` 并 `actions/deploy-pages@v4` 部署。
- `dist/`、`node_modules/` 不纳入版本控制(见 `.gitignore`)。

## 提交门槛

合入前必须通过:

1. `bun run typecheck`(tsc --noEmit,strict)
2. 相关测试 `bun run test`
3. 涉及构建的 ticket 另需 `bun run build` 通过
