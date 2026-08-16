import { describe, expect, test } from "vitest";
import {
  buildProgram,
  renderFrame,
  compileShader,
  FULLSCREEN_VERTEX,
  GL_VERTEX_SHADER,
  GL_FRAGMENT_SHADER,
  type ShaderStageGL,
  type UniformSnapshot,
} from "../shaders/shaderStageRuntime";

/** 可脚本化的 mock GL:记录 uniform2f/uniform3f/uniform1f/uniform1i 上传。 */
function makeMockGL(overrides: Partial<ShaderStageGL> = {}) {
  const uploaded: UniformSnapshot[] = [];
  const mock: ShaderStageGL = {
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => null,
    deleteShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => null,
    deleteProgram: () => {},
    useProgram: () => {},
    getAttribLocation: () => 0,
    getUniformLocation: (_p, name: string) => {
      return { name };
    },
    uniform2f: (loc, x, y) => {
      uploaded.push({ name: (loc as { name: string }).name, kind: "2f", values: [x, y] });
    },
    uniform1f: (loc, x) => {
      uploaded.push({ name: (loc as { name: string }).name, kind: "1f", values: [x] });
    },
    uniform1i: (loc, x) => {
      uploaded.push({ name: (loc as { name: string }).name, kind: "1i", values: [x] });
    },
    uniform3f: (loc, x, y, z) => {
      uploaded.push({ name: (loc as { name: string }).name, kind: "3f", values: [x, y, z] });
    },
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    viewport: () => {},
    drawingBufferWidth: 640,
    drawingBufferHeight: 360,
    drawElements: () => {},
    ...overrides,
  };
  return { mock, uploaded };
}

const FIXTURE_FRAGMENT = [
  "#version 300 es",
  "precision highp float;",
  "in vec2 vUv;",
  "out vec4 fragColor;",
  "uniform float iTime;",
  "uniform vec2 uResolution;",
  "void main() { fragColor = vec4(vUv, iTime, 1.0); }",
].join("\n");

describe("buildProgram — 编译/链接全屏程序(接缝 2)", () => {
  test("成功时返回句柄并解析出运行时 uniform 位置", () => {
    const { mock } = makeMockGL();
    const result = buildProgram(mock, FULLSCREEN_VERTEX, FIXTURE_FRAGMENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.uniformLocations["iTime"]).toBeTruthy();
    expect(result.uniformLocations["uResolution"]).toBeTruthy();
    expect(result.uniformLocations["iFrame"]).toBeTruthy();
    // 缓冲区与程序句柄齐备。
    expect(result.handles.program).toBeTruthy();
    expect(result.handles.ibo).toBeTruthy();
  });

  test("链接失败时返回明确错误", () => {
    const { mock } = makeMockGL({ getProgramParameter: () => false, getProgramInfoLog: () => "bad link" });
    const result = buildProgram(mock, FULLSCREEN_VERTEX, FIXTURE_FRAGMENT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("着色器");
  });

  test("compileShader 对编译失败的 shader 返回 null", () => {
    const { mock } = makeMockGL({ getShaderParameter: () => false });
    expect(compileShader(mock, GL_FRAGMENT_SHADER, FIXTURE_FRAGMENT)).toBeNull();
    expect(compileShader(mock, GL_VERTEX_SHADER, FULLSCREEN_VERTEX)).toBeNull();
  });
});

describe("renderFrame — 每帧的运行时 uniform 更新与绘制(接缝 2)", () => {
  test("更新 iTime/uTime/iResolution/uResolution/iFrame 等 uniform 并触发一次 drawElements", () => {
    const { mock, uploaded } = makeMockGL();
    const built = buildProgram(mock, FULLSCREEN_VERTEX, FIXTURE_FRAGMENT);
    if (!built.ok) throw new Error("program 应构建成功");

    let draws = 0;
    const gl2: ShaderStageGL = {
      ...mock,
      drawElements: () => {
        draws += 1;
      },
    };

    const snapshots = renderFrame(gl2, built.handles, built.uniformLocations, {
      time: 1.5,
      delta: 0.016,
      frame: 7,
      width: 640,
      height: 360,
    });

    // iTime 与 uTime 都收到 1.5;uResolution 收到 (640,360);iFrame 收到 7。
    const iTime = snapshots.find((s) => s.name === "iTime");
    expect(iTime?.values).toEqual([1.5]);
    const iResolution = snapshots.find((s) => s.name === "iResolution");
    expect(iResolution?.kind).toBe("3f");
    expect(iResolution?.values).toEqual([640, 360, 1]);
    const iFrame = snapshots.find((s) => s.name === "iFrame");
    expect(iFrame?.values).toEqual([7]);
    expect(uploaded.some((u) => u.name === "uResolution" && u.kind === "2f")).toBe(true);
    expect(draws).toBe(1);
  });

  test("每帧时间推进时 uniform 值也随之更新(持续渲染的依据)", () => {
    const { mock } = makeMockGL();
    const built = buildProgram(mock, FULLSCREEN_VERTEX, FIXTURE_FRAGMENT);
    if (!built.ok) throw new Error("program 应构建成功");

    const f1 = renderFrame(mock, built.handles, built.uniformLocations, { time: 1, delta: 0.016, frame: 1, width: 640, height: 360 });
    const f2 = renderFrame(mock, built.handles, built.uniformLocations, { time: 2, delta: 0.016, frame: 2, width: 640, height: 360 });

    expect(f1.find((s) => s.name === "iTime")?.values).toEqual([1]);
    expect(f2.find((s) => s.name === "iTime")?.values).toEqual([2]);
    expect(f2.find((s) => s.name === "iFrame")?.values).toEqual([2]);
  });
});
