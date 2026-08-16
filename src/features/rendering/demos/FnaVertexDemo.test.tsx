import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FnaVertexDemo } from "./FnaVertexDemo";
import { FNA_FX_SOURCE } from "./fnaFixture";
import type { WebGLMeshContext } from "../useWebGLMesh";
import type { ShaderStageGL } from "../shaders/shaderStageRuntime";

/** 记录调用的顶点层 WebGL mock(结构上满足 WebGLMeshContext)。 */
function makeMeshGL() {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  let seq = 0;
  const gl = {
    createVertexArray: () => ({ h: ++seq }),
    bindVertexArray: () => {},
    createBuffer: () => ({ h: ++seq }),
    bindBuffer: () => {},
    bufferData: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    enable: () => {},
    blendFunc: () => {},
    drawElements: (...args: unknown[]) => {
      calls.push({ name: "drawElements", args });
    },
    deleteBuffer: () => {},
    deleteVertexArray: () => {},
  };  
  return {
    gl: gl as unknown as WebGLMeshContext,
    calls,
  };
}

/** ShaderStage 用的 WebGL2 mock(照 ShaderStage.test.tsx 的做法)。 */
function makeShaderGL(): ShaderStageGL {
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

/** 可手动推进的 RAF 驱动(供 FnaVertexDemo 的动画面板)。 */
function makeRaf() {
  let id = 0;
  const cbs = new Map<number, FrameRequestCallback>();
  return {
    requestFrame: (cb: FrameRequestCallback) => {
      const n = ++id;
      cbs.set(n, cb);
      return n;
    },
    cancelFrame: (n: number) => {
      cbs.delete(n);
    },
    tick(now: number) {
      const pending = Array.from(cbs.values());
      cbs.clear();
      for (const cb of pending) cb(now);
    },
    count: () => cbs.size,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("FnaVertexDemo — 顶点+FX 融合演示", () => {
  it("挂载后同时渲染 shader canvas 与顶点 canvas,且各出一次绘制,无错误提示", () => {
    // 避免 ShaderStage 内部 rAF 在 jsdom 空转。
    vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const mesh = makeMeshGL();

    render(
      <FnaVertexDemo
        createContext={() => mesh.gl}
        shaderCreateContext={() => makeShaderGL()}
        requestFrame={(_cb: FrameRequestCallback) => 0}
        cancelFrame={() => {}}
      />,
    );

    // 两个层都在。
    expect(screen.getByTestId("fna-mesh-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("shader-stage-canvas")).toBeInTheDocument();
    // 无错误。
    expect(screen.queryByTestId("fna-context-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shader-stage-error")).not.toBeInTheDocument();
    // 顶点层绘制过一次 drawElements(useWebGLMesh 已接线)。
    expect(mesh.calls.filter((c) => c.name === "drawElements").length).toBeGreaterThanOrEqual(1);
  });

  it("动画面板推进后再次 draw(顶点数据随时间波形位移重建)", () => {
    vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const mesh = makeMeshGL();
    const raf = makeRaf();

    render(
      <FnaVertexDemo
        createContext={() => mesh.gl}
        shaderCreateContext={() => makeShaderGL()}
        requestFrame={raf.requestFrame}
        cancelFrame={raf.cancelFrame}
      />,
    );

    const before = mesh.calls.filter((c) => c.name === "drawElements").length;
    // 推进若干帧(时间变化 → 新网格 + 重绘);需包在 act() 里让 setTime 状态刷新。
    act(() => {
      raf.tick(16);
      raf.tick(32);
    });
    const after = mesh.calls.filter((c) => c.name === "drawElements").length;
    expect(after).toBeGreaterThan(before);
  });

  it("顶点层上下文不可用时给出 context 错误提示", () => {
    vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const onError = vi.fn();
    render(
      <FnaVertexDemo
        createContext={() => null}
        shaderCreateContext={() => makeShaderGL()}
        requestFrame={(_cb: FrameRequestCallback) => 0}
        cancelFrame={() => {}}
        onContextError={onError}
      />,
    );
    expect(screen.getByTestId("fna-context-error").textContent).toContain("WebGL2");
    expect(onError).toHaveBeenCalled();
  });

  it("shader 源无效时,ShaderStage 错误在叠加层上浮出", () => {
    vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const mesh = makeMeshGL();
    render(
      <FnaVertexDemo
        createContext={() => mesh.gl}
        shaderCreateContext={() => makeShaderGL()}
        shaderSource="float notAShader(float x){ return x; }"
        requestFrame={(_cb: FrameRequestCallback) => 0}
        cancelFrame={() => {}}
      />,
    );
    // 顶点层仍渲染;shader 层给 translate 错误。
    expect(screen.getByTestId("fna-mesh-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("shader-stage-error").textContent).toContain("translate");
  });

  it("默认 shader 素材可转译(组件与静态素材同源一致性)", async () => {
    const { translateFragmentSource } = await import("../hlslToGLSL");
    const r = translateFragmentSource(FNA_FX_SOURCE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toContain("#version 300 es");
  });
});
