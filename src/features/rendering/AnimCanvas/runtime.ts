/**
 * animts React 运行时 —— <AnimCanvas/> 的脚本执行环境。
 *
 * 机制借鉴自 gh-tml 参考源码(animts-runtime.js),但不复制其代码:
 * - 参考实现用「工厂模块(create(api) 返回 OnInit/OnUpdate/OnRender 实例)+ 帧循环」驱动绘图;
 * - 本实现采用更简洁的「函数式/声明式动画脚本」:脚本是一个纯数据对象,
 *   由 setup / update / render / dispose 四个可选钩子组成,由 player 在帧循环中驱动。
 *
 * 本模块只依赖共享层的 geometry 数学库(Vec2/Vec3/Mat4)与注入的 canvas API,
 * 不直接触碰 DOM/WebGL,便于单测用 canvas mock 同步驱动。
 */

import type { Vec2 } from "../../../shared/capabilities/geometry";

/**
 * 动画帧上下文:一场动画从建立到销毁共享的不可变环境信息。
 * width/height 由页面注入的容器尺寸决定,time 以秒为单位累积。
 */
export interface AnimContext {
  width: number;
  height: number;
}

/**
 * Canvas API —— 渲染能力在 Canvas2D 上的无损门面。
 * 注入到脚本的 render 钩子,所有坐标以 Vec2 表达,便于与 geometry 库协同。
 * 仅暴露最薄的一组原语(清屏 / 矩形 / 线段 + 箭头 / 圆),满足向量、矩阵主题 demo。
 */
export interface CanvasApi {
  clear(color?: string): void;
  /** 当前画布的像素宽高(脚本可据此自适应布局)。 */
  readonly width: number;
  readonly height: number;
  /** 以某点为中心画矩形;fill/stroke 其一或两者。 */
  rect(cx: Vec2, w: number, h: number, style?: ShapeStyle): void;
  /** 从 from 到 to 画线段。 */
  line(from: Vec2, to: Vec2, style?: StrokeStyle): void;
  /** 从 from 指向 to 的箭头(带箭头头线)。 */
  arrow(from: Vec2, to: Vec2, style?: StrokeStyle & { headLength?: number }): void;
  /** 以某点为中心画圆。 */
  circle(cx: Vec2, radius: number, style?: ShapeStyle): void;
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
}

export interface StrokeStyle {
  stroke?: string;
  lineWidth?: number;
}

/**
 * 动画脚本 —— 函数式/声明式动画定义。
 * 四个钩子均为可选,分别对应:初始化(构建可变状态)、每帧更新、每帧绘制、销毁清理。
 * script 应以纯数据对象形式书写,不持有 DOM/canvas 引用,从而可被测试、可被替换。
 */
export interface AnimScript {
  /** 初始化:返回该脚本的可变状态对象(state)。可选。 */
  setup?(ctx: AnimContext): unknown;
  /** 每帧更新:按 delta 时间(秒)推进 state。可选。 */
  update?(state: unknown, delta: number, ctx: AnimContext): void;
  /** 每帧绘制:把 state 经注入的 CanvasApi 画到画布。可选。 */
  render?(state: unknown, g: CanvasApi, ctx: AnimContext): void;
  /** 销毁:释放脚本自行持有的资源(事件监听、定时器等)。可选。 */
  dispose?(state: unknown): void;
}

/**
 * 动画模块解析器 —— 把传递给 <AnimCanvas/> 的动画「规格」解析成可执行的 AnimScript。
 * 通过 props 注入以支持测试(mock)与替换(如从协议嵌入加载远端脚本)。
 * 缺省解析器为恒等映射:传入的对象本身就是 AnimScript。
 */
export type AnimScriptResolver = (spec: unknown) => AnimScript;

/** 缺省解析器:直接把传入对象当作 AnimScript 返回。 */
export const defaultResolver: AnimScriptResolver = (spec) => spec as AnimScript;

/**
 * player —— 一场动画的执行器。持有画布、脚本与运行状态,对外暴露同步帧推进(tick)
 * 与 start/stop/dispose,便于测试在无 requestAnimationFrame 环境下按帧驱动。
 */
export interface AnimPlayer {
  /** 已执行的帧数(每次 tick +1)。 */
  readonly frame: number;
  /** 推进一帧;ts 为该帧的时间戳(毫秒),首个非零 ts 作为基准计算 time。 */
  readonly tick: (ts: number) => void;
  readonly start: () => void;
  readonly stop: () => void;
  readonly dispose: () => void;
}

export interface CreatePlayerOptions {
  canvasApi: CanvasApi;
  context: AnimContext;
  script: AnimScript;
  /** 注入可选的 requestAnimationFrame/cancelAnimationFrame;缺省用全局实现。jsdom 下应注入 fake。 */
  requestFrame?: (cb: (ts: number) => void) => number;
  cancelFrame?: (id: number) => void;
}

/**
 * 创建一场动画的 player。
 * 帧循环语义:update(state, delta, ctx) -> render(state, g, ctx),delta 为距上一帧的秒数。
 */
export function createPlayer(options: CreatePlayerOptions): AnimPlayer {
  const { canvasApi, context, script } = options;
  const requestFrame =
    options.requestFrame ?? (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (_cb: (ts: number) => void) => 0);
  const cancelFrame = options.cancelFrame ?? (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => {});

  const state = script.setup ? script.setup(context) : undefined;
  let running = false;
  let rafId: number | null = null;
  let frame = 0;
  let lastTime = 0;
  let disposed = false;

  function tick(ts: number): void {
    if (disposed) return;
    const time = ts * 0.001;
    const delta = lastTime ? time - lastTime : 0;
    lastTime = time;
    frame += 1;
    if (script.update) script.update(state, delta, context);
    if (script.render) script.render(state, canvasApi, context);
    if (running && !disposed) {
      rafId = requestFrame(tick);
    }
  }

  function stop(): void {
    if (!running) return;
    running = false;
    if (rafId !== null) cancelFrame(rafId);
    rafId = null;
  }

  function dispose(): void {
    stop();
    if (disposed) return;
    disposed = true;
    if (script.dispose) script.dispose(state);
  }

  return {
    get frame() {
      return frame;
    },
    tick,
    start() {
      if (running || disposed) return;
      running = true;
      rafId = requestFrame(tick);
    },
    stop,
    dispose,
  };
}

/** 一段「伪随机」相位:仅用于 demo 让无输入动画也有变化,非加密用途。 */
export function hashPhase(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** MathF 风格的最小助手:兼容参考代码语义(仅借用命名与思路)。 */
export const MathF = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
  },
};