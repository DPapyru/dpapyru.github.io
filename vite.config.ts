/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * SPA 回退:构建收尾时把 index.html 复制为 dist/404.html,
 * 让 GitHub Pages 对任意深链 URL 也能返回应用入口。
 */
function spa404Fallback(outDir: string): Plugin {
  return {
    name: "spa-404-fallback",
    apply: "build",
    closeBundle() {
      const out = resolve(process.cwd(), outDir);
      copyFileSync(resolve(out, "index.html"), resolve(out, "404.html"));
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
