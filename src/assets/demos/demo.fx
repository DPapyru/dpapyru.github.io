/* demo.fx — 从原站点(gh-tml/site/content/如何贡献/shaders/demo.fx)迁移的 fx: 协议示例 shader。
 * 原站点经 fx:./shaders/demo.fx 协议嵌入渲染(见旧站「站点Markdown扩展语法说明」)。
 * 片段入口为 mainImage(fragCoord) 返回 float4;运行时注入 iResolution/iTime 等 uniform。
 * 由 rendering feature 的 hlslToGLSL 转译为 GLSL 300 es,再由 ShaderStage 全屏渲染。
 */

float4 mainImage(float2 fragCoord)
{
    float2 uv = fragCoord / iResolution.xy;
    float pulse = 0.55 + 0.45 * sin(iTime * 1.2);
    return float4(uv.x, uv.y * pulse, 0.82, 1.0);
}
