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
│   ├── capabilities/    #   能力(渲染能力、着色标记、SEO 等运行时能力)
│   │   ├── geometry/      #   渲染数学库 Vec2/Vec3/Mat4(见下)
│   │   └── seo/           #   页面级 SEO 标签与 sitemap 生成(见下)
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

## Markdown 渲染管线(shared/capabilities/markdown)

- **归属**:置于共享层 `shared/capabilities/markdown`,是跨功能模块复用的渲染能力——文章详情页(`BlogPost`)正文以它渲染(#8)。
- **管线基底**:`react-markdown` + `remark-gfm`(GFM 表格/任务列表)+ `rehype-highlight`(基于 lowlight 的代码块语法高亮),为新增运行时依赖(见 package.json)。
- **公开 API**:`<MarkdownRenderer source={md} remarkPlugins? rehypePlugins? />`。入参 `source` 为原始 Markdown;可选 `remarkPlugins`/`rehypePlugins` 追加插件。
- **插件挂载点(#9 Callout / #10 着色标记 / #11 协议嵌入)**:基底数组(remarkGfm + rehypeHighlight)显式作为内部数组;后续 ticket 经同名可选 props 注入各自的 remark/rehype 插件与本组件内基底合成,无需改动组件。本期**不**实现这三个插件,仅留缝。
- **代码高亮样式**:`MarkdownRenderer` 内 import `highlight.js/styles/github.css`(明色基线);全局 `src/styles/highlight-theme.css` 提供 `[data-theme="dark"]` 下的 GitHub Dark 覆盖,使高亮随站点明/暗主题切换。正文排版作用于 `.markdown` 容器(CSS Modules)。
- **可测接缝(接缝 1)**:`MarkdownRenderer.test.tsx` 断言公开 API 外显行为(GFM 表格结构、任务列表 checkbox、代码块含 `hljs`/`language-*` 类与词法类、插件注入缝)。
- **接入**:`src/features/blog/BlogPost.tsx` 经 `loadPost/parsePostFull` 接缝(#7)取到 `{meta, body}`,把 `body` 传给 `MarkdownRenderer`;渲染层替换不改变加载器签名。

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

## HLSL→GLSL 转译与 ShaderStage(rendering)

- **归属**:置于 `src/features/rendering/`,是 ADR-0002 提取的 shader-hlsl-adapter 能力(#12)。转译思路借鉴参考源码(gh-tml shader-hlsl-adapter.js),但为 TS strict / 零第三方运行时依赖重写实现,不复制其代码。
- **转译核心**(`hlslToGLSL.ts`,纯函数、接缝 2):输入 `.fx` 源码字符串 → 输出 GLSL 300 es 顶点/片段源码。公开 API:
  - `translateFragmentSource(fx, { vertexColorVarying? })` — 片段;支持 `void mainImage(out float4 fragColor, float2 fragCoord)` 与 `float4 MainPS(float2 : TEXCOORD0) : COLOR0` 两种入口,包装进 `main()` 并注入运行时 uniform。
  - `translateVertexSource(fx, { vertexEntry? })` — 顶点(`MainVS(...)`,返回 float4),把像素出口坐标换算为裁剪坐标 `gl_Position`。
  - `translateProgramSource(fx, { vertexEntry? })` — 一次产出顶点 + 片段;均返回 `{ ok: true; source }` 或 `{ ok: false; error }`(错误携带明确中文信息)。
  - 导出 `RUNTIME_UNIFORM_LINES`(iTime/iResolution/iChannel0-3 等运行时 uniform)、`RUNTIME_UNIFORM_NAMES`、兜底 `FALLBACK_FRAGMENT`/`FALLBACK_VERTEX`。
- **转译规则**:①剥除 `technique`/`pass` 与 register/语义冒号标注;②类型改写 `float4→vec4`、`half/fixed/min16float→float`、`float4x4→mat4`、`int2/uint2/bool2→ivec2/uvec2/bvec2`、`Texture2D→sampler2D` 等;③内置函数改写 `lerp→mix`、`frac→fract`、`rsqrt→inversesqrt`、`ddx/ddy→dFdx/dFdy`、`fmod→mod`、`mad→(a*b+c)`、`rcp→1.0/x`、`clip→discard`、`mul→(a*b)`、`tex2D*→texture*`(含 UV 翻转);④顶层自由变量提升为 `uniform`(已注入的运行时名除外)。
- **ShaderStage 运行时**(`shaders/shaderStageRuntime.ts`):固定全屏过场顶点 + 转译片段,编译链接后每帧更新 uniform 并以索引绘制。公开:`buildProgram(gl, vs, fs)`(编译/链接,返回句柄与 uniform 位置或错误)、`renderFrame(gl, handles, uniformLocations, { time, delta, frame, width, height })`(一帧:viewport + 更新 uResolution/uTime/iResolution/iTime/iTimeDelta/iFrame + drawElements,返回 uniform 上传快照供测试观测)。依赖结构接口 `ShaderStageGL`(与 `useWebGLMesh` 的 `WebGLMeshContext` 同思路):生产传真实 `WebGL2RenderingContext`,测试传 mock。
- **组件**(`ShaderStage.tsx` + `ShaderStage.module.css`):`<ShaderStage source={fx} />` 挂载后自动转译→编译→实时渲染;`createContext?` 支持注入 WebGL 上下文(mock/未来后端);转译/编译/上下文任一失败均在 canvas 上叠加**明确错误提示**(不静默)。卸载或换源自动停止帧循环。
- **可测接缝(接缝 2)**:`hlslToGLSL.test.ts` 断言给定 `.fx` 的入口/类型改写/uniform 注入输出;`shaders/shaderStageRuntime.test.ts` 用录制型 mock GL 断言 uniform 更新与绘制;`ShaderStage.test.tsx` 用 RTL + mock WebGL 挂载断言成功渲染与三阶段错误分支。

## 「顶点+FX」融合演示与素材(rendering/demos, ticket #14)

- **归属**:置于 `src/features/rendering/demos/`,把 #13 的 useWebGLMesh(顶点管线)与 #12 的 ShaderStage(shader 叠加)组合成**单视口同时生效**的融合演示,作为博客文章可引用的内容素材与测试夹具。
- **组件**(`FnaVertexDemo.tsx` + `FnaVertexDemo.module.css`):`<FnaVertexDemo/>` 同时渲染两层——
  - **背景 FX 层**:复用 `<ShaderStage source={...}/>` 全屏渲染 HLSL shader;
  - **前景顶点层**:独立 canvas 用 `useWebGLMesh` 绘制一个随时间做正弦波位移的网格,叠在 FX 之上。
  - 可注入点(测试/后端):`createContext?`(顶点层 WebGL 上下文)、`shaderCreateContext?`(ShaderStage WebGL 上下文)、`data?`(顶点数据,缺省 `FNA_VERTEX_DATA`)、`shaderSource?`(缺省 `FNA_FX_SOURCE`)、`requestFrame?`/`cancelFrame?`(帧循环可注入,缺省全局 RAF)、`onContextError?`。顶点层上下文不可用或 shader 转译/编译失败均叠加**明确错误提示**。
- **测试夹具与数据源**(`fnaFixture.ts`,纯函数):导出 `FNA_GRID`、`buildFnaVertexData()`(5×5 平面网格的 `MeshVertexArrays`)、`FNA_VERTEX_DATA`(基线夹具)、`waveDisplace(base, t)`(Z 轴正弦波位移,演示顶点动态化)、`validateVertexData(data)`(结构校验)与 `FNA_FX_SOURCE`(融合 shader 源码)。
- **素材格式约定**(可被协议嵌入引用的静态内容,放 `public/demos/`,i.e. `fna:`/vertex/fx 素材,与 anims: 同类的自含素材):
  - `public/demos/fna-vertex-demo.fx` — HLSL(.fx)片段 shader,入口 `void mainImage(out float4 fragColor, float2 fragCoord)`;经 hlslToGLSL 转译后由 ShaderStage 渲染,运行时注入 iTime/iResolution 等 uniform。设计上呼应同名顶点网格(线框 + 顶点高亮光点)。
  - `public/demos/fna-vertex-demo.js` — 顶点/几何数据静态素材,自包含 ES 模块(不 import src/),default 导出 `{ format, label, columns, rows, positions, colors, uvs, indices }`。**数据格式**与 `useWebGLMesh` 的 `MeshVertexArrays` 一致:positions(n×3,±1,z=0)、colors(n×4,RGBA)、uvs(n×2)、indices(Uint16Array,每四边形两三角形顺时针)。使用方(协议嵌入或测试夹具)可直接把后四者交给 `createMesh`/`packVertices`。
  - 同源一致性:静态素材 `fna-vertex-demo.js`/它的 `.fx` 与测试夹具 `fnaFixture.ts` 数据同构,保证「组件用法」「内容素材」「测试夹具」三方一致。
- **可测接缝(接缝 2)**:`fnaFixture.test.ts` 断言网格构造/位移/校验/HLS 转译输入→输出;`FnaVertexDemo.test.tsx` 用 RTL + 双 mock WebGL 挂载断言两层同时渲染、各出一次/多帧绘制、顶点层上下文错误、shader 转译错误浮出。
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
  - **接缝 2 — 渲染运行时**(`shared/capabilities` + `features/rendering`):着色标记、Callout、协议嵌入的解析/渲染,geometry 数学库的输入→输出断言,以及 HLSL→GLSL 转译、ShaderStage 渲染循环的输入→输出断言。
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
  - `*` -> 404 页(`shared/compositions/NotFound`,设计化自 #18;消费主题 CSS 变量,提供回首页/博客出口)
- **顶部导航**:跨板块共享,置于 `shared/compositions/Header`,用 `NavLink` 呈现当前板块选中态(`aria-current="page"`);右侧挂载 `ThemeToggle`(theme feature 提供,即时切换明/暗 + accent,不持久化)。
- 测试:`AppRoutes` 导出以便用 `MemoryRouter` 包裹做路由渲染测试(点击切换、active 态、404、直达)。

## 静态生成与 SEO

页面级 SEO / Open Graph / Twitter Card + 构建期 sitemap/robots(ticket #18)。

- **归属**:SEO 能力置于共享层 `shared/capabilities/seo`,跨板块复用;sitemap/robots 的生成纯函数亦在此(供构建脚本与测试同源)。
- **站点元信息**(`site.ts`):`SITE_NAME`、`SITE_URL`(`https://dpapyru.github.io`)、`pageTitle(part)`(拼「标题 · 站点名」)、`absoluteUrl(path)`(站内路径 → 绝对 URL)。
- **`<Seo/>` 组件**(`Seo.tsx`):按页面数据(标题/路径/描述/og 类型/预览图)设置 `document.title` 与 meta description、Open Graph(`og:title/type/url/site_name/description/image`)、Twitter Card(`twitter:card/title/description/image`)。纯函数 `buildSeoTags` 负责 props→head 标签描述(输入→输出,可单测);组件挂载时经 `applyHead` 写入 head,并在切换/卸载时清理自己通过 `data-seo` 标记写入的标签,避免跨路由残留。
- **使用**:各板块页(`About`/`Blog`/`Contact`)与文章详情页(`BlogPost`,按文章标题/摘要,og type=article)及 404 页挂载 `<Seo/>`;首页 `/` 路径被规范为站点根 URL。
- **构建期 SEO 脚本**(`scripts/build-seo.ts`,`bun run build:seo`):读取 `public/blog-index.json` 的 slug,拼出已知 URL(`/`、`/blog`、每个 `/blog/:slug`),用 `buildSitemapXml`/`buildRobotsTxt` 生成 `public/sitemap.xml` 与 `public/robots.txt`。`bun run build` 在 vite build 前先跑 `build:content && build:seo`,保证每次部署带上最新站点地图。
- **测试**:`Seo.test.tsx` 断言 jsdom 下 `document.title` 与 meta(含卸载清理);`sitemap.test.ts` 断言 `buildSitemapXml`/`buildRobotsTxt`/`blogSlugPaths` 的输入→输出。

## 提交门槛

合入前必须通过:

1. `bun run typecheck`(tsc --noEmit,strict)
2. 相关测试 `bun run test`
3. 涉及构建的 ticket 另需 `bun run build` 通过
