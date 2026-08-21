# 常见错误与解决方案

本文档记录项目开发中遇到的常见错误及其解决方案，供未来参考。

## 验证记录

### 验证记录 2026-08-21：修复 ShaderStage 全屏四边形渲染黑区/渐变撕裂 (FULLSCREEN 拓扑与 UV)

**级别**：L3 统一验收

**命令与结果**：
- `bun scripts/check-shaders.ts`：通过 (闸已升级:除编译/链接外,新增真实绘制 + readPixels 像素断言,5 个程序全部「编译+链接+渲染像素断言」通过)
- `npx vitest run`：通过 (139/139,含新增的「FULLSCREEN 四边形拓扑与 UV 布局」常量精确值测试 3 个)
- `npx tsc --noEmit`：通过 (无任何 TypeScript 编译错误)
- `bun scripts/build-content.ts`：通过 (成功输出 2 篇文章到 src/generated/blog-index.json)
- `npx vite build`：通过 (生产打包成功)
- 端到端:`npx vite preview --port 4173` + headless Chrome 加载 /blog/content-pipeline,截图分析 canvas 渲染出完整平滑渐变(左侧 x=320 蓝 (2,59,209) → 右侧 x=940 粉 (253,59,209)),无黑区、无对角线撕裂、无 shader-stage-error 横幅
- 反向验证:临时把 FULLSCREEN_INDICES 还原为 [0,1,2,0,2,3] 后闸立即 FAIL(报 demo.fx BR/TR=0,0,0、FALLBACK 右缘中点=黑),证明闸能抓住此 bug;还原修复值后 PASS

**备注**：
用户报告博客内容管线 HLSL 渲染画面异常:右半屏大面积纯黑、硬边对角线、渐变在三角形边界撕裂(紫/蓝、粉/蓝、洋红→青、青→粉 断裂)。用真实 WebGL2 + readPixels 反馈回路复现:现状四角采样 BL=青 BR=黑 TL=粉 TR=黑(右半屏未绘制),与用户描述一致。
根因:src/features/rendering/shaders/shaderStageRuntime.ts 的全屏四边形两个常量自最初提交(7167360)就错:
1) FULLSCREEN_INDICES=[0,1,2,0,2,3]:顶点序为 BL,BR,TL,TR,但三角形 (BL,BR,TL)+(BL,TL,TR) 的并集只覆盖左半屏(缺口为 {y<x}∩{y>-x} 的右缘楔形),BR/TR 及右缘永不绘制 → 纯黑 + 硬对角边;
2) FULLSCREEN_TEXCOORDS 有两处错:(a) 12 个 float = 6 对 UV 却只对应 4 顶点(潜伏长度错误);(b) 前 4 对 (0,0)(1,0)(1,1)(0,0) 与入口 main() 的 "vec2 uv = vec2(vUv.x, 1.0 - vUv.y)" 翻转不匹配(契约:底部顶点 v=1、顶部顶点 v=0),渐变错位/撕裂。
修复(最小 diff,仅本文件):FULLSCREEN_TEXCOORDS 改为 4 对 [0,1, 1,1, 0,0, 1,0](BL(0,1) BR(1,1) TL(0,0) TR(1,0));FULLSCREEN_INDICES 改为 [0,1,3, 0,3,2]((BL,BR,TR)+(BL,TR,TL),铺满 [-1,1]²)。
回归守卫:①单元测试断言三个常量的精确数组值(mock GL 的 bufferData 是空操作、drawElements 只计数,从不断言常量值,5 个测试全绿也拦不住);②check-shaders 闸新增真实绘制 + readPixels 采样 4 角+中心+右缘中点,对 demo.fx 断言四角色相、对 FALLBACK 断言中心与右缘中点非黑、对 fna 网格系断言中心非黑(其四角本身较暗,故只查中心),数据直接 import 运行时常量,保证测的是源码真实数据。
参考对照:原站点 gh-tml 用单个全屏大三角形(drawArrays,无索引)天然铺满,因此旧站没有此 bug;本项目改 4 顶点索引四边形时拓扑与 UV 两处都写错。useWebGLMesh/fnaFixture 的 5×5 网格索引 (a,d,e)(a,e,b) 完整铺满,无此问题。

### 验证记录 2026-08-21：修复 ShaderStage 着色器编译/链接失败 (HLSL 标量→向量广播)

**级别**：L3 统一验收

**命令与结果**：
- `bun scripts/check-shaders.ts`：通过 (新增的真实 WebGL2 编译冒烟闸,5 个程序全部「编译 OK + LINK OK」——demo.fx 转译片段(从原项目迁移)、fna-vertex-demo.fx 转译片段、fnaFixture.FNA_FX_SOURCE 转译片段、FALLBACK_FRAGMENT、FALLBACK_VERTEX;headless Chrome 真实 `canvas.getContext('webgl2')` 编译链接)
- `npx vitest run`：通过 (136/136 单元及集成测试套件全部 Green 通关,含新增的「FNA_FX_SOURCE 与静态素材 fna-vertex-demo.fx 正文一致」防双副本漂移测试)
- `npx tsc --noEmit`：通过 (无任何 TypeScript 编译错误)
- `bun scripts/build-content.ts`：通过 (成功输出 2 篇文章到 src/generated/blog-index.json)

**备注**：
博客文章 content/blog/content-pipeline.md 的 shader 渲染报错「着色器编译/链接失败: fragment 编译失败 | The program must contain objects to form both a vertex and fragment shader」,根因是 HLSL 源第 30 行 `float2 rnd = frac(sin(dot(...)) * 43758.5453);`:HLSL 的 `dot()` 返回标量并允许标量→向量广播,但 GLSL ES 3.00 的变量初始化禁止把标量赋给 `vec2`;词法级转译器 hlslToGLSL.ts 只做 `frac→fract`、`float2→vec2` 改名、不做类型推断,原样产出 `vec2 rnd = fract(标量);` 导致片段编译失败 → 链接失败。
修复为把 `frac(...)` 包进显式构造器 `float2(...)`(HLSL 合法,转译后为 `vec2(fract(...))`),两处同源副本(fna-vertex-demo.fx 与 fnaFixture.ts 的 FNA_FX_SOURCE)同步修改。
同时补上回归守卫 scripts/check-shaders.ts:单元测试里的 GL mock 从不真正编译 GLSL,135/135 全绿也可能带着该运行时 bug 上线;该闸用真实 WebGL2 编译链接全部 shader 素材,任一失败即 exit 1,并挂入 `npm run check:shaders`。
另外按需求把博客 fx: 嵌入的 shader 素材改为**从原项目迁移的真实 .fx 文件**:content/blog/content-pipeline.md 的 `fx:demos/fna-vertex-demo.fx`(新写素材)改为 `fx:demos/demo.fx`,后者逐字取自原站点 gh-tml/site/content/如何贡献/shaders/demo.fx(原站点 fx: 协议的标准示例,片段入口 `float4 mainImage(float2 fragCoord)`);已实测经 hlslToGLSL 转译后在真实 WebGL2 编译链接通过。fna-vertex-demo.fx 与 FNA_FX_SOURCE 保留,供 FnaVertexDemo 组件使用。

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