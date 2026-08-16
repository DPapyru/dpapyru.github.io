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
│   ├── blog/            #   博客文章板块(列表页;内容管线见下)
│   ├── contact/         #   联系方式板块
│   ├── theme/           #   主题(明/暗 + accent 预设;ThemeProvider/useTheme/ThemeToggle)
│   ├── search/          #   站内搜索
│   └── rendering/       #   渲染能力(动画/HLSL→GLSL/WebGL2 几何)
├── shared/              # 共享层:跨 feature 复用的能力
│   ├── capabilities/    #   能力(渲染能力、着色标记等运行时能力)
│   │   └── geometry/      #   渲染数学库 Vec2/Vec3/Mat4(见下)
│   ├── services/        #   服务(跨 feature 的服务能力)
│   ├── atoms/           #   原子组件
│   └── compositions/    #   组合组件
├── styles/              # 全局样式(global.css 主题变量)
└── test/                # 测试基建(setup)
```

规则:

- **功能模块 (feature)**、**共享层 (shared)** 的术语与边界定义见 `CONTEXT.md` 与 `docs/adr/0002-rendering-extraction.md`。
- 一个板块只在其 feature 目录内自含实现;跨 feature 复用一律下沉到 `shared/`。
- feature 目录内以 `<Name>.module.css` 承载该组件样式(CSS Modules)。


## 内容管线(content/blog -> 索引)

- **内容源**:文章写在 `content/blog/**/*.md`,用 gray-matter front matter 声明 `title`、`date`(字符串,推荐带引号)、`palette`(着色标记色板,形如 `{key: color}`),可选 `excerpt`、`tags`。内容内可含代码块、`> [!NOTE]` 等 Callout、`[[key]]文字[[/key]]` 着色标记语法(渲染由渲染能力接缝 #2 提供)。
- **构建**:`scripts/build-content.ts`(`bun run build:content`)扫描 `content/blog` → 按 `date` 倒序生成 `public/blog-index.json`。`bun run build` 在 `tsc && vite build` 之前先跑 `build:content`,保证列表页引用的索引最新。
- **解析/构建纯函数**:`src/features/blog/blogIndex.ts` 导出 `BlogPostMeta`、`BlogIndexEntry`、`BlogSourceFile` 类型与 `parseBlogPost`、`buildBlogIndex`(内容管线接缝 #1,纯函数式、可单测)。
- **列表页**:`src/features/blog/Blog.tsx` 直接 `import` `public/blog-index.json`,由索引驱动渲染每篇文章的卡片(标题/日期/摘要),链接到 `/blog/:slug`(详情页由 #7 提供)。

## 站内搜索(services/search)

> 命名沿目录树中的 `features/search/`;此处“services/”仅表意“站内检索能力”,实际目录为 `src/features/search/`。

- **归属**:置于 `src/features/search/`,站内搜索入口 + 类型契约(ticket #17)。本期**只实现入口与占位 UI,不实现真实检索**;BM25 全文搜索由后续 ticket 按同一契约实现。
- **类型契约**(`search.ts`):
  - `SearchQuery { term: string }` — 查询入参;入口先 trim 并忽略空串,保证后续实现拿到干净查询。
  - `SearchResult { title: string; url: string; snippet?: string }` — 一条结果;`url` 为站内路由路径(如 `/blog/:slug`),`snippet` 为可选命中摘要。
  - `SearchFn = (query: SearchQuery) => SearchResult[]` — 真实检索实现的接缝签名,占位阶段不实现,仅锁定形状。
- **占位 UI**(`<Search />`):输入框 + 搜索按钮,提交后回显「搜索功能开发中,后续将实现 BM25 全文搜索」提示;不执行真实检索。
- **挂载入口**:博客列表页 `Blog.tsx` 在文章列表下方挂载 `<Search />`(ticket #17)。
- **测试**:占位 UI 渲染(输入框/按钮/提示回显/空查询不提示)与契约类型可编译(`search.test.tsx`)。

## 渲染数学库(shared/capabilities/geometry)

- **归属**:置于共享层 `shared/capabilities/geometry`,作为渲染运行时能力(接缝 2)——ADR-0002 把几何数学(Vec/Mat)归入渲染能力;rendering feature 的 WebGL 顶点绘制与动画运行时均需复用,故下沉到共享层。
- **公开 API**:`geometry/index.ts` 导出 `Vec2`、`Vec3`、`Mat4`。
  - **Vec2/Vec3**:加减(`add`/`sub`)、标量缩放(`scale`)、点积(`dot`)、叉积(`cross`,仅 Vec3)、长度(`length`)、归一化(`normalized`,零向量返回零向量不产生 NaN)、`equals(epsilon)`、`toArray()`。
  - **Mat4**:列主序(column-major,与 WebGL uniform 上传约定一致,经 `toArray()` 直接上传);单位矩阵 `identity()`、平移 `translation`、绕轴旋转 `rotationX/Y/Z`(弧度)、缩放 `scaling`、透视投影 `perspective(fovY, aspect, near, far)`、正交投影 `orthographic`、矩阵乘法 `multiply`、点/向量变换 `transformPoint`、`transpose`、`equals(epsilon)`。
  - **约定**:纯函数式——所有运算返回新实例、不改入参;零第三方运行时依赖;strict 类型。

## WebGL2 顶点绘制(rendering/useWebGLMesh)

- **归属**:置于 `src/features/rendering/useWebGLMesh.ts`,是 rendering feature 的 WebGL2 顶点绘制 hook(#13);复用共享层 `geometry`(数学库)的约定,零第三方运行时依赖。
- **顶点结构**:交错打包 `Position(3) + Color(4) + UV(2) = 9 float = 36 字节 stride`;字段字节偏移常量 `POSITION_OFFSET_BYTES=0`、`COLOR_OFFSET_BYTES=12`、`UV_OFFSET_BYTES=28`,步长 `VERTEX_STRIDE_BYTES=36`。
- **公开 API**(`useWebGLMesh.ts` 单文件导出):
  - `packVertices(MeshVertexArrays): Float32Array` — 把位置/颜色/UV 数组打包为交错 Float32Array;入参长度按顶点数不一致时抛错。
  - `createMesh(gl, data, mode?): RenderMeshHandle` — 纯命令式核心:创建并绑定 VAO/VBO/IBO、设置三个顶点属性指针与 blend state(SRC_ALPHA / ONE_MINUS_SRC_ALPHA),返回 `draw()`(触发 `drawElements`)与 `dispose()`(释放资源)。
  - `useWebGLMesh({ gl, data, mode? }): RenderMeshHandle` — React hook 包装 `createMesh`;`gl`/`data`/`mode` 变化时重建,卸载时自动 `dispose`。
  - 类型:`MeshVertexArrays`(positions n*3 / colors n*4 / uvs n*2 / indices Uint16|Uint32)、`WebGLMeshContext`(可注入的最小 WebGL 上下文结构接口,生产传真实 `WebGL2RenderingContext`,测试传 mock)、`RenderMeshHandle`。
  - WebGL 常量(`GL_ARRAY_BUFFER` 等)亦以此为导出,便于 mock 断言。
- **可测接缝**:WebGL 上下文以 `WebGLMeshContext` 结构接口注入,测试用记录调用的 mock 断言 VAO/VBO/IBO、blend state、`drawElements` 与打包布局输入→输出(`useWebGLMesh.test.ts`)。

## AnimCanvas 动画运行时(rendering/AnimCanvas)

- **归属**:置于 `src/features/rendering/AnimCanvas/`,把 ADR-0002 提取的 animts 动画运行时 React 化(#13)。机制借鉴自参考源码(gh-tml animts-runtime.js),但为其设计独立、更简洁的**函数式/声明式脚本格式**,不复制其代码。
- **组件**:`<AnimCanvas script={...} />` 挂载后即可运行动画。关键点:
  - **canvas 与解析器可注入(props)**:
    - `resolver?`(AnimScriptResolver)— 动画解析器,把传入的 `script`(一个"规格")解析成 AnimScript。缺省恒等映射(传入对象本身就是 AnimScript);测试可注入 mock,后续协议嵌入可注入"按 URL 拉取并 import"的解析器。
    - `canvasApiFactory?` — `(canvas) => CanvasApi` 的工厂,缺省用 Canvas2D 实现(`createCanvas2d`);测试或后端替换可注入 fake。canvas 本身由组件在挂载时创建,插入容器。
    - `width`/`height` — 可选固定画布尺寸(px),缺省自适应容器。
  - **生命周期**:挂载创建 player 并 `start()`,卸载 `dispose()`(停止帧循环并调用脚本 dispose)。
- **动画脚本格式(AnimScript)** — 函数式/声明式,四个可选钩子组成的纯数据对象,由 player 在帧循环中驱动:
  - `setup(ctx) → state` — 初始化,返回可变的脚本状态。
  - `update(state, delta, ctx)` — 每帧更新,`delta` 为距上一帧的秒数。
  - `render(state, g, ctx)` — 每帧绘制,`g` 为注入的 CanvasApi。
  - `dispose(state)` — 销毁清理(释放监听器/定时器)。
- **CanvasApi(渲染门面)**:向下层渲染后端(如 Canvas2D)的无损门面,坐标用 Vec2 表达,便于与共享层 geometry 协同。原语:`clear(color)`、`rect(cx,w,h,style)`、`line(from,to,style)`、`arrow(from,to,style)`、`circle(cx,r,style)`;暴露 `width`/`height` 供脚本自适应布局。
- **player(runtime.ts)**:createPlayer({ canvasApi, context, script, requestFrame?, cancelFrame? }) 创建一场动画的执行器,暴露 start/stop/dispose/frame 与可同步驱动的 tick(tsMs)(便于测试注入 fake 的 RAF、按帧驱动)。时间语义:tick 输入时间戳(ms)换算为 time(s)与 delta(s)。
- **可测接缝(接缝 2)**:runtime.test.ts 用"录制型 fake CanvasApi"+ 同步 tick 断言帧循环外部行为(update→render 顺序、time/delta/frame、state 共享、dispose 清理、start/stop/dispose 防重入);AnimCanvas.test.tsx 用 RTL 断言组件挂载后有 canvas、resolver/canvasApiFactory 注入生效、卸载调用 dispose。
- **演示动画(demo 素材)**:放 public/demos/,为独立的自包含 ES 模块(不 import src/,因其会被作为静态资源加载),esm default 导出同 AnimScript 格式。作为内容素材与测试夹具,后续协议嵌入(anims:)ticket 可通过 resolver 拉取并 import()。当前提供 2 支:
  - public/demos/demo-anim-rotating-square.js — 旋转方块(矩阵主题:2D 旋转×缩放仿射变换)。
  - public/demos/demo-anim-vector-field.js — 向量场(向量主题:网格采样点画箭头,场随时间摆动)。

## 样式与主题约定

- 组件样式用 **CSS Modules**(`*.module.css`),通过 `import styles from "./X.module.css"` 使用。
- 全局主题用 **CSS 变量 + `data-theme`**(明/暗 + accent 预设)。
- 全局样式放 `src/styles/global.css`(含默认 CSS 变量与 `prefers-color-scheme` 兜底)。
- 主题模块(`src/features/theme/`):
  - `theme.ts` 提供类型与常量(`ThemeMode`/`AccentPreset`/`DEFAULT_*`/`ACCENT_PRESETS`/`THEME_ATTR`/`ACCENT_ATTR`)。
  - `ThemeProvider`(React context)持有模式与 accent 状态,经 effect 把 `data-theme`/`data-accent` 写到文档根元素,即时生效;`useTheme` hook 供组件读取状态与切换函数。
  - `ThemeToggle` 组件(明/暗 + accent 预设色选择),挂载于顶部导航 `Header` 的预留位并以 CSS Modules 写样式。
  - 本期(#03)不做持久化。
- **Provider 位置**:`AppRoutes`(src/App.tsx)以 `ThemeProvider` 包裹,使顶部导航与各板块均可用 `useTheme`。

## 测试约定

- 工具:**Vitest** + **React Testing Library** + **jsdom**;**@testing-library/jest-dom** 作为 setup 注入全局 matcher(`src/test/setup.ts`)。
- 运行:`bun run test`(= `vitest run`)。
- 测试策略:只测**模块公开 API 的外部行为**(输入→输出),不测内部实现细节。
- 可测的接缝:
  - **接缝 1 — 内容管线**(`src/features/blog/blogIndex.ts`):markdown front matter 解析、博客索引构建。
  - **接缝 2 — 渲染运行时**(`shared/capabilities`):着色标记、Callout、协议嵌入的解析/渲染,以及 geometry 数学库的输入→输出断言。
- 测试与实现**同批提交**。

## 构建产物约定

- 构建输出目录:`dist/`。
- **404.html SPA 回退**:构建收尾时(`vite.config.ts` 的 `spa404-fallback` 插件,`closeBundle` 钩子)把 `index.html` 复制为 `dist/404.html`,使 GitHub Pages 对任意深链 URL 返回应用入口。
- GitHub Pages 通过 `actions/upload-pages-artifact@v3` 上传 `dist/` 并 `actions/deploy-pages@v4` 部署。
- `dist/`、`node_modules/` 不纳入版本控制(见 `.gitignore`)。

## 路由约定

- 依赖:**react-router-dom**(v7,`<BrowserRouter>` + `<Routes>`),路由由 #4 ticket 引入。
- 入口:`src/main.tsx` -> `src/App.tsx`。`App` 内挂 `BrowserRouter` 并渲染 `<AppRoutes/>`;路由表集中在 `AppRoutes`,板块与 URL 一一对应:
  - `/`(默认)->「关于我」
  - `/blog` -> 博客列表页(由构建期索引驱动);`/blog/:slug` 详情页由 #7 提供
  - `/contact` -> 联系方式占位页
  - `*` -> 404 占位(`shared/compositions/NotFound`;设计化 404 由 #18 负责)
- **顶部导航**:跨板块共享,置于 `shared/compositions/Header`,用 `NavLink` 呈现当前板块选中态(`aria-current="page"`);右侧挂载 `ThemeToggle`(theme feature 提供,即时切换明/暗 + accent,不持久化)。
- 测试:`AppRoutes` 导出以便用 `MemoryRouter` 包裹做路由渲染测试(点击切换、active 态、404、直达)。

## 提交门槛

合入前必须通过:

1. `bun run typecheck`(tsc --noEmit,strict)
2. 相关测试 `bun run test`
3. 涉及构建的 ticket 另需 `bun run build` 通过