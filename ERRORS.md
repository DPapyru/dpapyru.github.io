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
