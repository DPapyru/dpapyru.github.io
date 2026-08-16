# ADR-0002: 渲染能力提取策略(纯前端 WebGL2,舍弃 .NET WASM)

从参考源码 gh-tml 提取三类渲染能力到新主页:animts 动画运行时、shader-hlsl-adapter(HLSL→GLSL 300es 转译)、WebGL2 顶点绘制与几何数学(Vec/Mat) — 全部纯前端、零第三方运行时依赖,包成 React 组件(如 <AnimCanvas/>、<ShaderStage/>、useWebGLMesh)。明确舍弃:.NET WASM 的 animcs C# 动画链(约 5MB 下载,不值得)、DPapyru-- 拖尾 DSL(140K 解释器需改造)、shader-playground(耦合 IDE,仅保留预览核心思路)。理由:主页展示动画/HLSL/顶点能力应零重依赖;WASM 链服务的是"C# 动画网页运行"这一旧站卖点,个人主页不值得背整个 .NET 运行时。
