/* fna-vertex-demo.fx — 「顶点+FX」融合演示的叠加 shader(协议嵌入 fx: 静态素材)。
 *
 * 作为可被协议嵌入引用的内容素材:输入为本工程的 HLSL(.fx)片段,由
 * rending feature 的 hlslToGLSL 转译为 GLSL 300 es,再由 ShaderStage 全屏渲染。
 * 片段入口为 mainImage(out fragColor, fragCoord);运行时向 iTime/iResolution/iFrame
 * 等 uniform 注入每帧值。
 *
 * 设计上呼应同名的顶点网格素材(fna-vertex-demo.js):叠加一层随 iTime 脉动的
 * 线框网格 + 顶点位置高亮光点,与 useWebGLMesh 绘制的前景网格构成「顶点+FX」。
 */

void mainImage(out float4 fragColor, float2 fragCoord) {
    float2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    float2 p = uv * 2.0 - 1.0;
    p.x *= aspect;

    // 1) 线框网格:随 iTime 缓慢漂移的 UV 网格线。
    float grid = 8.0;
    float2 g = abs(fract(p * grid - iTime * 0.05) - 0.5);
    float line = smoothstep(0.48, 0.50, max(g.x, g.y));
    float3 gridCol = float3(0.10, 0.35, 0.45) * line;

    // 2) 边缘晕染(青色系)。
    float edge = smoothstep(0.9, 0.15, length(p));
    float3 glow = float3(0.05, 0.25, 0.35) * edge;

    // 3) 顶点高亮光点:在网格顶点处撒一圈随 iTime 明暗的光点。
    float2 pointId = floor(p * grid);
    float2 rnd = float2(frac(sin(dot(pointId, float2(12.9898, 78.233))) * 43758.5453));
    float blink = 0.5 + 0.5 * sin(iTime * 2.0 + rnd.x * 6.28);
    float d = length(frac(p * grid) - 0.5);
    float spark = smoothstep(0.12, 0.0, d) * blink * 0.8;

    float3 col =
        gridCol
        + glow
        + float3(0.4, 0.9, 1.0) * spark;
    fragColor = float4(col, 1.0);
}
