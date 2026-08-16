/**
 * Canvas2D 上的 CanvasApi 实现:把运行时的绘制门面落到真实 2D 上下文。
 * 坐标以设备像素(与 canvas 的 width/height 一致)表达,便于脚本直接用注入的尺寸布局。
 */
import type { CanvasApi, ShapeStyle, StrokeStyle } from "./runtime";
import type { Vec2 } from "../../../shared/capabilities/geometry";

const DEFAULT_BG = "#10131a";

export function createCanvas2d(canvas: HTMLCanvasElement): CanvasApi {
  // jsdom 等无 Canvas2D 实现的宿主里 getContext 会抛错;捕获后降级为 no-op,
  // 使组件在测试环境也能安全挂载(真实绘制由浏览器注入的 canvasApiFactory/实现承担)。
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  return {
    get width() {
      return canvas.width;
    },
    get height() {
      return canvas.height;
    },
    clear(color: string = DEFAULT_BG): void {
      if (!ctx) return;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    },
    rect(cx: Vec2, w: number, h: number, style?: ShapeStyle): void {
      if (!ctx) return;
      ctx.save();
      if (style?.fill) {
        ctx.fillStyle = style.fill;
        ctx.fillRect(cx.x - w / 2, cx.y - h / 2, w, h);
      }
      if (style?.stroke) {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.lineWidth ?? 1;
        ctx.strokeRect(cx.x - w / 2, cx.y - h / 2, w, h);
      }
      ctx.restore();
    },
    line(from: Vec2, to: Vec2, style?: StrokeStyle): void {
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = style?.stroke ?? "#ffffff";
      ctx.lineWidth = style?.lineWidth ?? 1;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    },
    arrow(from: Vec2, to: Vec2, style?: StrokeStyle & { headLength?: number }): void {
      if (!ctx) return;
      const head = style?.headLength ?? 8;
      ctx.save();
      ctx.strokeStyle = style?.stroke ?? "#ffffff";
      ctx.lineWidth = style?.lineWidth ?? 1;
      ctx.fillStyle = style?.stroke ?? "#ffffff";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    circle(cx: Vec2, radius: number, style?: ShapeStyle): void {
      if (!ctx) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx.x, cx.y, Math.max(0, radius), 0, Math.PI * 2);
      if (style?.fill) {
        ctx.fillStyle = style.fill;
        ctx.fill();
      }
      if (style?.stroke) {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.lineWidth ?? 1;
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}