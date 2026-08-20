/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * SPA 回退与静态路由生成:
 * 1. 把 index.html 复制为 dist/404.html,让 GitHub Pages 对未知路径返回 404.html 兜底。
 * 2. 扫描已知静态路由(如 /blog、/contact、及 blog-index.json 中的文章 slugs),
 *    为它们创建对应的物理目录并将 index.html 复制进去。
 *    这样直接访问这些深链路径时,GitHub Pages 能以 200 OK 状态直接返回 index.html,
 *    彻底避免浏览器控制台出现 404 错误,且更有利于 SEO。
 */
function spa404Fallback(outDir: string): Plugin {
  return {
    name: "spa-404-fallback",
    apply: "build",
    closeBundle() {
      const out = resolve(process.cwd(), outDir);
      
      // 1. 兜底 404.html
      copyFileSync(resolve(out, "index.html"), resolve(out, "404.html"));

      // 2. 静态路由目录生成
      const routes = ["blog", "contact"];

      try {
        const blogIndexPath = resolve(process.cwd(), "src/generated/blog-index.json");
        if (existsSync(blogIndexPath)) {
          const blogIndex = JSON.parse(readFileSync(blogIndexPath, "utf8"));
          for (const post of blogIndex) {
            if (post.slug) {
              routes.push(`blog/${post.slug}`);
            }
          }
        }
      } catch (err) {
        console.error("读取博客索引生成静态路由失败:", err);
      }

      for (const route of routes) {
        const routeDir = resolve(out, route);
        mkdirSync(routeDir, { recursive: true });
        copyFileSync(resolve(out, "index.html"), resolve(routeDir, "index.html"));
      }
    },
  };
}

// Vite + Vitest 共用配置。test 块由 vitest 使用,build/dev 由 vite 使用。
const outDir = "dist";

export default defineConfig({
  plugins: [react(), spa404Fallback(outDir)],
  build: { outDir },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    // 只跑本工程 src 下的测试;排除 gh-tml 参考仓库与构建缓存
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/gh-tml/**", "**/.bun-cache/**", "**/.tmp/**"],
  },
});
