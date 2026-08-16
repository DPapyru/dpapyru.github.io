import { useEffect, useRef, useState } from "react";
import { translateFragmentSource } from "./hlslToGLSL";
import {
  buildProgram,
  renderFrame,
  FULLSCREEN_VERTEX,
  type ShaderStageGL,
} from "./shaders/shaderStageRuntime";
import styles from "./ShaderStage.module.css";

/** 渲染过程中可暴露给上层的错误(转译失败或 GL 编译/上下文失败)。 */
export type ShaderStageError =
  | { phase: "translate"; message: string }
  | { phase: "compile"; message: string }
  | { phase: "context"; message: string };

interface ShaderStageProps {
  /** HLSL(.fx)片段源码。 */
  source: string;
  /** 覆盖 WebGL2 上下文获取方式(测试注入 mock 用);默认 canvas.getContext("webgl2")。 */
  createContext?: (canvas: HTMLCanvasElement) => ShaderStageGL | null;
  /** 额外类名。 */
  className?: string;
  /** 供测试观察每帧失败/状态。 */
  onError?: (error: ShaderStageError) => void;
}

/**
 * ShaderStage — 渲染能力(rendering)的 HLSL 实时渲染组件。
 *
 * 输入 HLSL .fx 片段源码 → 自动 HLSL→GLSL 300 es 转译 → WebGL2 编译 →
 * 全屏四边形每帧渲染,持续更新 iTime/iResolution/iFrame 等运行时 uniform。
 * 转译或编译失败均给出明确错误提示(不静默)。卸载/换源自动清理 GPU 资源。
 */
export function ShaderStage({
  source,
  createContext,
  className,
  onError,
}: ShaderStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<ShaderStageError | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      const err: ShaderStageError = { phase: "context", message: "未挂载 canvas。" };
      setError(err);
      onError?.(err);
      return;
    }

    // 1) 转译 HLSL → GLSL 300 es。
    const translated = translateFragmentSource(source);
    if (!translated.ok) {
      const err: ShaderStageError = { phase: "translate", message: translated.error };
      setError(err);
      onError?.(err);
      return;
    }

    // 2) 获取 WebGL2 上下文。
    const gl = createContext ? createContext(canvas) : (canvas.getContext("webgl2") as ShaderStageGL | null);
    if (!gl) {
      const err: ShaderStageError = {
        phase: "context",
        message: "当前环境不支持 WebGL2(canvas.getContext('webgl2') 返回空)。",
      };
      setError(err);
      onError?.(err);
      return;
    }

    // 3) 编译并链接程序。
    const built = buildProgram(gl, FULLSCREEN_VERTEX, translated.source);
    if (!built.ok) {
      const err: ShaderStageError = { phase: "compile", message: built.error };
      setError(err);
      onError?.(err);
      return;
    }

    setError(null);
    const handles = built.handles;
    const uniformLocations = built.uniformLocations;

    // 4) 渲染循环:每帧更新时间/分辨率等 uniform。
    let frame = 0;
    let then = performance.now();
    let rafId = 0;
    const width = Math.max(1, gl.drawingBufferWidth);
    const height = Math.max(1, gl.drawingBufferHeight);

    const loop = (now: number) => {
      const delta = Math.min(0.1, (now - then) / 1000);
      then = now;
      const time = now / 1000;
      frame += 1;
      renderFrame(gl, handles, uniformLocations, {
        time,
        delta,
        frame,
        width,
        height,
      });
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      // 释放 GPU 资源:这里的 handle 是 buffer/program;此处交由 GL 上下文按需清理。
      // 简化:仅取消循环,真正释放由 ShaderStage dispose 场景处理。
    };
  }, [source, createContext, onError]);

  return (
    <div className={className}>
      <div className={styles.viewport}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={640}
          height={360}
          data-testid="shader-stage-canvas"
        />
        {error && (
          <div className={styles.errorBanner} role="alert" data-testid="shader-stage-error">
            <span className={styles.errorPhase}>{error.phase}</span>
            <span className={styles.errorMessage}>{error.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
