import { describe, expect, test } from "vitest";
import {
  translateFragmentSource,
  translateVertexSource,
  translateProgramSource,
  detectFragmentEntry,
  FALLBACK_FRAGMENT,
} from "./hlslToGLSL";

// 片段:mainImage(out float4, float2) 形式的典型着色器。
describe("translateFragmentSource — 输入 .fx 输出 GLSL 300 es 片段(接缝 2)", () => {
  test("mainImage 入口:注入 #version/precision/uniform,并把入口包装进 main()", () => {
    const fx = [
      "void mainImage(out float4 fragColor, float2 fragCoord) {",
      "    float2 uv = fragCoord / iResolution.xy;",
      "    fragColor = float4(uv, 0.5, 1.0);",
      "}",
    ].join("\n");

    const result = translateFragmentSource(fx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.source).toContain("#version 300 es");
    expect(result.source).toContain("precision highp float;");
    // 运行时 uniform 注入。
    expect(result.source).toContain("uniform vec3 iResolution;");
    expect(result.source).toContain("uniform float iTime;");
    expect(result.source).toContain("uniform sampler2D iChannel0;");
    // 类型改写 float4→vec4 / float2→vec2。
    expect(result.source).toContain("vec4(uv, 0.5, 1.0)");
    expect(result.source).toContain("vec2 uv = fragCoord / iResolution.xy;");
    // 入口被包装进 main(),把像素坐标换算为 fragCoord。
    expect(result.source).toContain("fragCoord = uv * iResolution.xy;");
    expect(result.source).toMatch(/mainImage\(/);
  });

  test("float4 MainPS(float2 texCoord : TEXCOORD0) : COLOR0 形式也能识别", () => {
    const fx = [
      "float4 MainPS(float2 texCoord : TEXCOORD0) : COLOR0 {",
      "    return float4(1.0, 0.0, 0.0, 1.0);",
      "}",
    ].join("\n");
    const result = translateFragmentSource(fx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 语义冒号标注被剥除,参数映射为 uv。
    expect(result.source).toContain("MainPS(");
    expect(result.source).toContain("fragColor = MainPS(uv);");
  });

  test("找不到像素入口时返回明确错误", () => {
    const notFragment = "float twice(float x) { return x * 2.0; }";
    const result = translateFragmentSource(notFragment);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("未找到可用的像素入口");
  });

  test("改用与预留:内置函数/采样与技术段落剥除", () => {
    const fx = [
      "texture RedSampler { Texture2D tex; float4 color; };",
      "",
      "void mainImage(out float4 fragColor, float2 fragCoord) {",
      "    float c = lerp(0.0, 1.0, 0.5);",
      "    float f = frac(c);",
      "    c = mad(c, 2.0, 1.0);",
      "    fragColor = float4(c, f, c, 1.0);",
      "}",
      "",
      "technique11 Tech { pass P0 { set vShader = compile vs_main(); } }",
    ].join("\n");
    const result = translateFragmentSource(fx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // technique/pass 段落被剥除。
    expect(result.source).not.toContain("technique11");
    expect(result.source).not.toContain("registers");
    // 内置函数改写。
    expect(result.source).toContain("mix(0.0, 1.0, 0.5)");
    expect(result.source).toContain("fract(");
    expect(result.source).toContain("((c) * (2.0) + (1.0))");
  });

  test("重复运行返回幂等的新字符串(纯函数,不改入参)", () => {
    const fx =
      "void mainImage(out float4 fragColor, float2 fragCoord) { fragColor = float4(0,0,0,1); }";
    const snapshot = fx;
    const first = translateFragmentSource(fx);
    const second = translateFragmentSource(fx);
    if (first.ok && second.ok) {
      expect(first.source).toBe(second.source);
    }
    // 入参不被改写。
    expect(fx).toBe(snapshot);
  });
});

describe("translateVertexSource — 输入 .fx 输出 GLSL 300 es 顶点(接缝 2)", () => {
  test("MainVS 入口:像素位置换算为裁剪坐标,注入 in/out 与 uniform", () => {
    const fx = [
      "float4 MainVS(float4 pos : POSITION) {",
      "    return pos;",
      "}",
    ].join("\n");
    const result = translateVertexSource(fx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.source).toContain("#version 300 es");
    expect(result.source).toContain("layout(location = 0) in vec3 aPosition;");
    expect(result.source).toContain("layout(location = 2) in vec2 aTexCoord;");
    expect(result.source).toContain("out vec2 vUv;");
    expect(result.source).toContain("uniform vec2 uResolution;");
    expect(result.source).toContain("uniform float uTime;");
    // 入口被调用并换算为裁剪坐标。
    expect(result.source).toContain("MainVS(");
    expect(result.source).toContain("gl_Position = vec4(clip, vsOut.z, 1.0);");
  });

  test("找不到顶点入口时返回明确错误", () => {
    const r = translateVertexSource("float notAVertex(float x){return x;}", { vertexEntry: "MainVS" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("未找到可用的顶点入口");
  });
});

describe("translateProgramSource — 顶点 + 片段同时产出", () => {
  test("一个 .fx 源码同时得到顶点与片段,二者都注入 runtime uniform", () => {
    const fx = [
      "float4 MainVS(float4 pos : POSITION) { return pos; }",
      "",
      "void mainImage(out float4 fragColor, float2 fragCoord) {",
      "    fragColor = float4(fragCoord / iResolution.xy, 0.0, 1.0);",
      "}",
    ].join("\n");
    const result = translateProgramSource(fx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vertexSource).toContain("#version 300 es");
    expect(result.vertexSource).toContain("uniform vec3 iResolution;");
    expect(result.fragmentSource).toContain("#version 300 es");
    expect(result.fragmentSource).toContain("uniform vec3 iResolution;");
    expect(result.fragmentSource).toContain("uniform float iTime;");
  });
});

describe("辅助导出", () => {
  test("detectFragmentEntry 识别 mainImage 入口", () => {
    const entry = detectFragmentEntry(
      "void mainImage(out float4 c, float2 f) { c = float4(0); }",
    );
    expect(entry?.name).toBe("mainImage");
    expect(entry?.kind).toBe("out");
  });

  test("FALLBACK_FRAGMENT 是合法可编译片段(兜底帧)", () => {
    expect(FALLBACK_FRAGMENT).toContain("#version 300 es");
  });
});
