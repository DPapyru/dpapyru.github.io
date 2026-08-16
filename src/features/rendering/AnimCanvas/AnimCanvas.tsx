/**
 * <AnimCanvas/> —— 渲染能力(动画运行时)的 React 容器。
 *
 * 开发者挂载一个 <AnimCanvas script={...}/> 即可运行动画:
 * - 内部创建一块 canvas,并把 Canvas2D 实现作为 CanvasApi 注入脚本的 render 钩子;
 * - canvas 与动画解析器经 props 注入(可测试 / 可替换):
 *   - `canvasApiFactory?` 覆盖 canvas → CanvasApi 的工厂(测试时可注入录制型 fake);
 *   - `resolver?` 覆盖 AnimScript 解析器(缺省恒等映射,脚本对象本身就是 AnimScript)。
 *
 * 生命周期:挂载时创建 player 并 start,卸载时 dispose 清理帧循环。
 */
import { useEffect, useRef, type CSSProperties, type ReactElement } from "react";
import type { AnimScriptResolver, CanvasApi } from "./runtime";
import { createPlayer, defaultResolver } from "./runtime";
import { createCanvas2d } from "./canvas2d";
import styles from "./AnimCanvas.module.css";

export interface AnimCanvasProps {
  /** 动画「规格」:由 resolver 解析成 AnimScript;缺省解析器直接视其为 AnimScript。 */
  script: unknown;
  /** 动画解析器注入点。缺省恒等映射。 */
  resolver?: AnimScriptResolver;
  /** canvas → CanvasApi 工厂注入点。缺省用 Canvas2D 实现。测试可注入 fake。 */
  canvasApiFactory?: (canvas: HTMLCanvasElement) => CanvasApi;
  /** 画布固定宽度(px)。缺省自适应容器宽度。 */
  width?: number;
  /** 画布固定高度(px)。缺省用 CSS 类内的默认高度。 */
  height?: number;
  className?: string;
}

export function AnimCanvas({
  script,
  resolver = defaultResolver,
  canvasApiFactory,
  width,
  height,
  className,
}: AnimCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 解析动画脚本:默认把传入对象直接当作 AnimScript,可被 resolver 覆盖。
    const resolved = resolver(script);

    // 创建 canvas 的渲染 API:默认 Canvas2D,可注入 fake 以做外部行为断言。
    const canvasApi = canvasApiFactory ? canvasApiFactory(canvas) : createCanvas2d(canvas);
    const context = {
      width: width ?? canvas.width,
      height: height ?? canvas.height,
    };

    const player = createPlayer({ canvasApi, context, script: resolved });
    player.start();

    return () => {
      player.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script, resolver, canvasApiFactory, width, height]);

  const style: CSSProperties = {
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
  };

  return (
    <div className={styles.stage}>
      <canvas
        ref={canvasRef}
        className={className ? `${styles.canvas} ${className}` : styles.canvas}
        style={style}
      />
    </div>
  );
}