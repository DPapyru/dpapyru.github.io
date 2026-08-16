# ADR-0001: 技术栈选型(Vite + React 19 + TypeScript + Bun,单包 feature-first)

旧站 gh-tml 为纯静态 JS + 混合 React/Vite;新项目定位为纯个人主页(迁移旧站站点能力)。确定采用 Vite + React 19 + TypeScript,Bun 作包管理/脚本运行,仓库形态为单包 + 严格模块边界、feature-first + 共享层组织。备选与放弃理由:Next.js 静态导出偏重、Astro 非 React 主场;React 18 已进入维护期;pnpm workspace monorepo 初期配置成本高,单包形态契合当前"迁移优先、不过度开发"阶段,模块边界靠目录约定 + 接口约束,后续需要时再拆 workspace。
