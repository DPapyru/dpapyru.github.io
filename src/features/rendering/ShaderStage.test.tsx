import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShaderStage } from "./ShaderStage";
import { translateFragmentSource } from "./hlslToGLSL";
import type { ShaderStageGL } from "./shaders/shaderStageRuntime";

/**
 * WebGL2 mock 上下文(最小):真实渲染无关,重点断言转译+上下文+编译阶段的错误分支。
 */
function makeMockGL(): ShaderStageGL {
  return {
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
    getUniformLocation: () => ({}),
    uniform2f: () => {},
    uniform1f: () => {},
    uniform1i: () => {},
    uniform3f: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    viewport: () => {},
    drawingBufferWidth: 640,
    drawingBufferHeight: 360,
    drawElements: () => {},
  };
}

const VALID_FX = [
  "void mainImage(out float4 fragColor, float2 fragCoord) {",
  "    fragColor = float4(fragCoord / iResolution.xy, 0.0, 1.0);",
  "}",
].join("\n");

describe("ShaderStage — RTL 挂载(mock WebGL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("给合法 .fx 源码:渲染 canvas 且不显示错误提示", () => {
    // 避免 jsdom 下 rAF 循环造成无谓开销:stub。
    vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => {
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    render(<ShaderStage source={VALID_FX} createContext={() => makeMockGL()} />);
    const canvas = screen.getByTestId("shader-stage-canvas");
    expect(canvas).toBeInTheDocument();
    expect(screen.queryByTestId("shader-stage-error")).not.toBeInTheDocument();
  });

  it("转译失败(无入口)时给出明确 translate 错误提示", () => {
    render(<ShaderStage source="float notAShader(float x){ return x; }" createContext={() => makeMockGL()} />);
    const error = screen.getByTestId("shader-stage-error");
    expect(error).toBeInTheDocument();
    expect(error.textContent).toContain("translate");
    expect(error.textContent).toContain("未找到可用的像素入口");
  });

  it("WebGL2 上下文不可用时给出 context 错误提示", () => {
    render(<ShaderStage source={VALID_FX} createContext={() => null} />);
    const error = screen.getByTestId("shader-stage-error");
    expect(error).toBeInTheDocument();
    expect(error.textContent).toContain("context");
    expect(error.textContent).toContain("WebGL2");
  });

  it("编译/链接失败时给出 compile 错误提示", () => {
    const badGL = makeMockGL();
    // 让链接失败。
    const failing: ShaderStageGL = {
      ...badGL,
      getProgramParameter: () => false,
      getProgramInfoLog: () => "info log: link failed",
    };
    render(<ShaderStage source={VALID_FX} createContext={() => failing} />);
    const error = screen.getByTestId("shader-stage-error");
    expect(error).toBeInTheDocument();
    expect(error.textContent).toContain("compile");
    expect(error.textContent).toContain("着色器");
  });

  it("换源后重新转译:无效源触发错误,有效源清除错误", () => {
    const onError = vi.fn();
    const { rerender } = render(
      <ShaderStage source="bad code no entry" createContext={() => makeMockGL()} onError={onError} />,
    );
    expect(screen.getByTestId("shader-stage-error").textContent).toContain("translate");
    expect(onError).toHaveBeenCalled();

    rerender(
      <ShaderStage source={VALID_FX} createContext={() => makeMockGL()} onError={onError} />,
    );
    expect(screen.queryByTestId("shader-stage-error")).not.toBeInTheDocument();
  });

  it("转译核心与组件行为一致:合法 fx 能转译出 GLSL 300 es", () => {
    // 印证组件没有静默:组件用同一转译核心,成功路径即无错误提示。
    const result = translateFragmentSource(VALID_FX);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toContain("#version 300 es");
    }
  });
});
