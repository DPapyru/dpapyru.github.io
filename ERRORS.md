# 常见错误与解决方案

本文档记录项目开发中遇到的常见错误及其解决方案，供未来参考。

## 验证记录

### 验证记录 2025-02-18：修复 Vite 静态资源导入与 Glob 匹配警告 (Issue #20 & #21)

**级别**：L3 统一验收

**命令与结果**：
- `npx vite-node scripts/build-content.ts`：通过 (成功输出到 src/generated/blog-index.json)
- `npx vite-node scripts/build-seo.ts`：通过 (成功在 public/ 生成 sitemap.xml 和 robots.txt)
- `npx tsc --noEmit`：通过 (无任何 TS 编译错误)
- `npx vite build`：通过 (完美打包生产环境，无任何关于导入 public 目录资源的警告或报错)
- `npx vitest run`：通过 (134/134 单元及集成测试套件全部 Green 通关)

**备注**：
成功将 `blog-index.json` 的生成与导入重构到 `src/generated/`。
同时将 `code/` 及 `demos/` 目录下的演示/嵌入素材迁移至 `src/assets/` 并精确收窄了 `import.meta.glob` 的加载匹配，完美解除了 Vite Dev Server 和 Build 打包时的静态资源路径不当引用警告。

### 验证记录 2026-08-20：修复 GitHub Pages 路由直接访问/刷新报 404 错误 (SPA 404 Fallback)

**级别**：L3 统一验收

**命令与结果**：
- `npx vite-node scripts/build-content.ts`：通过 (成功输出 2 篇文章到 src/generated/blog-index.json)
- `npx vite-node scripts/build-seo.ts`：通过 (成功输出 sitemap.xml 和 robots.txt)
- `npx tsc --noEmit`：通过 (无任何 TypeScript 编译错误)
- `npx vite build`：通过 (生产环境打包完美成功，自动运行 `spa-404-fallback` 插件。成功生成 `dist/404.html` 兜底页面，以及 `dist/blog`、`dist/contact` 和全部博客文章物理路由子目录的 `index.html`)
- `npx vitest run`：通过 (135/135 单元及集成测试套件 100% 完美通关)

**备注**：
在 `vite.config.ts` 中实现了完善的 `spa404Fallback` 构建时插件。该插件在打包完成后：
1. 复制 `index.html` 生成 `404.html` 作为 GitHub Pages 未匹配路径的兜底，保证 SPA 单页路由可以接管未知路由。
2. 自动读取并扫描所有已知静态路由（如 `/blog`、`/contact` 以及 `blog-index.json` 中的全部动态文章 slug），为每一个路由在 `dist/` 下生成物理文件夹并拷贝一份 `index.html`，使直接请求这些深层 URL 时能以 200 OK 状态直接返回页面，彻底避免浏览器控制台出现 404 报错，大幅提升 SEO 的友好度和首屏加载体验。

### 验证记录 2025-08-21：修复浏览器端运行博客详情页时的 Buffer is not defined 错误

**级别**：L3 统一验收

**命令与结果**：
- `npx vite-node scripts/build-content.ts`：通过 (成功输出 2 篇文章到 src/generated/blog-index.json)
- `npx vite-node scripts/build-seo.ts`：通过 (成功输出 sitemap.xml 和 robots.txt)
- `npx tsc --noEmit`：通过 (无任何 TypeScript 编译错误)
- `npx vite build`：通过 (完美打包生产环境，生成 dist/ 静态文件夹)
- `npx vitest run`：通过 (135/135 单元及集成测试套件全部 Green 通关，包含新增的浏览器兼容性测试 `src/features/blog/loadPost.test.ts`)

**备注**：
成功通过重构 `loadPost.ts` 的加载逻辑消除了运行时对 `gray-matter` 的依赖。现在运行时的数据加载通过查阅预构建的 `src/generated/blog-index.json` 并以高性能、浏览器安全的正则表达式剥离 Markdown front matter 获取 `body` 正文，彻底解决了在非 Node.js 环境下 `Buffer` 未定义导致的白屏 Bug，并添加了高还原度的隔离环境测试用例进行守护。