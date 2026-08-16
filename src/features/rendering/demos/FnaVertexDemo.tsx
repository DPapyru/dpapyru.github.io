/**
 * FnaVertexDemo — 「顶点+FX」融合演示组件(rendering feature,ticket #14)。
 *
 * 把 useWebGLMesh(顶点管线)与 ShaderStage(shader 叠加)同时落地到同一视口:
 *   - 背景 FX 层:由 <ShaderStage source={shaderSource}/> 全屏渲染 HLSL shader;
 *   - 前景顶点层:由 useWebGLMesh 绘制一个随时间做正弦波位移的网格,叠在 FX 之上。
 * 两路都可注入 WebGL 上下文(mock/后端),缺省经 canvas.getContext("webgl2")。
 *
 * 数据来源默认取 fnaFixture(FNA_VERTEX_DATA / FNA_FX_SOURCE),与 public/demos/
 * 静态素材同源,便于文章协议嵌入复用与测试夹具一致。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShaderStage } from "../ShaderStage";
import { useWebGLMesh, GL_TRIANGLES, type WebGLMeshContext } from "../useWebGLMesh";
import type { ShaderStageGL } from "../shaders/shaderStageRuntime";
import {
  FNA_VERTEX_DATA,
  FNA_FX_SOURCE,
  waveDisplace,
} from "./fnaFixture";
import type { MeshVertexArrays } from "../useWebGLMesh";
import styles from "./FnaVertexDemo.module.css";

/** 顶点层上下文尚未就绪时的不工作兜底(结构上满足 WebGLMeshContext,全部 no-op)。 */
const EMPTY_MESH_GL: WebGLMeshContext = {
  createVertexArray: () => ({}),
  bindVertexArray: () => {},
  createBuffer: () => ({}),
  bindBuffer: () => {},
  bufferData: () => {},
  enableVertexAttribArray: () => {},
  vertexAttribPointer: () => {},
  enable: () => {},
  blendFunc: () => {},
  drawElements: () => {},
  deleteBuffer: () => {},
  deleteVertexArray: () => {},
};

/** 顶点层上下文不可用时的错误形状(便于展示与单测)。 */
export interface FnaContextError {
  message: string;
}

interface FnaVertexDemoProps {
  /** 顶点网格 canvas 的 WebGL2 上下文创建方式(测试注入 mock);缺省 canvas.getContext("webgl2")。 */
  createContext?: (canvas: HTMLCanvasElement) => WebGLMeshContext | null;
  /** ShaderStage 的 WebGL2 上下文创建方式(测试注入 mock),透传给 ShaderStage。 */
  shaderCreateContext?: (canvas: HTMLCanvasElement) => ShaderStageGL | null;
  /** 顶点/几何数据(缺省 FNA_VERTEX_DATA,5×5 网格)。 */
  data?: MeshVertexArrays;
  /** 叠加 HLSL shader 源码(缺省 FNA_FX_SOURCE)。 */
  shaderSource?: string;
  /** 额外类名。 */
  className?: string;
  /** 供测试/后端注入的帧回调(缺省全局 requestAnimationFrame)。 */
  requestFrame?: (cb: FrameRequestCallback) => number;
  /** 供测试/后端注入的取消帧回调(缺省全局 cancelAnimationFrame)。 */
  cancelFrame?: (id: number) => void;
  /** 顶点层上下文失败回调(测试观测)。 */
  onContextError?: (error: FnaContextError) => void;
}

export function FnaVertexDemo({
  createContext,
  shaderCreateContext,
  data = FNA_VERTEX_DATA,
  shaderSource = FNA_FX_SOURCE,
  className,
  requestFrame,
  cancelFrame,
  onContextError,
}: FnaVertexDemoProps) {
  const raf = requestFrame ?? (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (_cb: FrameRequestCallback) => 0);
  const caf = cancelFrame ?? (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => {});

  // 顶点 canvas 上的 WebGL2 上下文(惰性创建一次)。
  const [meshGL, setMeshGL] = useState<WebGLMeshContext | null>(null);
  const [contextError, setContextError] = useState<FnaContextError | null>(null);
  const handleMeshCanvas = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!node || meshGL) return;
      const gl = createContext ? createContext(node) : (node.getContext("webgl2") as WebGLMeshContext | null);
      if (!gl) {
        const err: FnaContextError = { message: "当前环境不支持 WebGL2(canvas.getContext('webgl2') 返回空)。" };
        setContextError(err);
        onContextError?.(err);
        return;
      }
      setMeshGL(gl);
    },
    [createContext, meshGL, onContextError],
  );

  // 动画面板:RAF 推进秒级时间,供顶点层做波形位移。
  const [time, setTime] = useState(0);
  useEffect(() => {
    let rafId = 0;
    const loop = (now: number) => {
      setTime(now * 0.001);
      rafId = raf(loop);
    };
    rafId = raf(loop);
    return () => caf(rafId);
  }, [raf, caf]);

  // 每帧由时间派生的顶点数据(正弦波位移样例)。
  const animatedData = useMemo(() => waveDisplace(data, time), [data, time]);

  // 顶点层网格:上下文就绪后建立,并在每帧时间变化后重绘。
  const mesh = useWebGLMesh({ gl: meshGL ?? EMPTY_MESH_GL, data: animatedData, mode: GL_TRIANGLES });
  useEffect(() => {
    if (!meshGL) return;
    mesh.draw();
  }, [mesh, meshGL, time]);

  return (
    <div className={className}>
      <div className={styles.viewport}>
        <ShaderStage
          source={shaderSource}
          createContext={shaderCreateContext}
          className={styles.fxLayer}
        />
        <div className={styles.fxLayer}>
          <canvas
            ref={handleMeshCanvas}
            className={styles.meshCanvas}
            width={640}
            height={360}
            data-testid="fna-mesh-canvas"
          />
          {contextError && (
            <div className={styles.errorBanner} role="alert" data-testid="fna-context-error">
              <span className={styles.errorMessage}>{contextError.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
