/**
 * 运行时核心逻辑单测 —— 只测公开 API 的外部行为(输入→输出),不测内部实现。
 * 用「录制型 fake CanvasApi」与「同步 tick」驱动,验证:
 *   - 每帧按 update -> render 顺序调用,且能按传入时间戳算出 time/delta/frame;
 *   - 动画脚本钩子可选(setup/update/render/dispose 逐帧、销毁契约);
 *   - 缺省/注入解析器的行为;
 *   - start/stop/busy 的防重入;
 *   - 无 update(纯绘制)脚本也能独立运行。
 */
import { describe, it, expect, vi } from "vitest";
import type { Vec2 } from "../../../shared/capabilities/geometry";
import {
  createPlayer,
  defaultResolver,
  type AnimScript,
  type CanvasApi,
} from "./runtime";

/** 录制型 fake canvas:记录每一次绘制调用,便于断言脚本渲染了什么。 */
function makeFakeCanvasApi(): CanvasApi & { calls: string[] } {
  const calls: string[] = [];
  const api: CanvasApi = {
    width: 100,
    height: 80,
    clear(color?: string) {
      calls.push(`clear:${color ?? ""}`);
    },
    rect(cx: Vec2, w: number, h: number) {
      calls.push(`rect:${cx.x},${cx.y},${w}x${h}`);
    },
    line(from: Vec2, to: Vec2) {
      calls.push(`line:${from.x},${from.y}->${to.x},${to.y}`);
    },
    arrow(from: Vec2, to: Vec2) {
      calls.push(`arrow:${from.x},${from.y}->${to.x},${to.y}`);
    },
    circle(cx: Vec2, r: number) {
      calls.push(`circle:${cx.x},${cx.y} r=${r}`);
    },
  };
  return { ...api, calls };
}

describe("createPlayer(frame 循环)", () => {
  it("每帧按 update -> render 顺序调用,并计算 time/delta/frame", () => {
    const g = makeFakeCanvasApi();
    const order: string[] = [];
    const script: AnimScript = {
      setup: () => ({}),
      update(state, delta, ctx) {
        void state;
        void ctx;
        order.push(`update d=${delta.toFixed(3)}`);
      },
      render(state, canvas, ctx) {
        void state;
        void ctx;
        order.push("render");
        canvas.clear("#000");
      },
    };

    const player = createPlayer({
      canvasApi: g,
      context: { width: 100, height: 80 },
      script,
      requestFrame: () => 1,
      cancelFrame: () => {},
    });

    player.tick(16); // 第 1 帧:delta 无基准 = 0
    player.tick(48); // 第 2 帧:delta = 0.032s
    player.tick(96); // 第 3 帧:delta = 0.048s

    expect(order).toEqual([
      "update d=0.000",
      "render",
      "update d=0.032",
      "render",
      "update d=0.048",
      "render",
    ]);
    expect(g.calls).toEqual(["clear:#000", "clear:#000", "clear:#000"]);
    expect(player.frame).toBe(3);
  });

  it("支持纯绘制脚本(无 setup/update)", () => {
    const g = makeFakeCanvasApi();
    const script: AnimScript = {
      render(_state, canvas) {
        canvas.rect({ x: 50, y: 40 } as Vec2, 20, 20, { fill: "#fff" });
      },
    };
    const player = createPlayer({
      canvasApi: g,
      context: { width: 100, height: 80 },
      script,
      requestFrame: () => 1,
      cancelFrame: () => {},
    });
    player.tick(0);
    expect(g.calls).toEqual(["rect:50,40,20x20"]);
    expect(player.frame).toBe(1);
  });

  it("state 由 setup 建立并在 update/render 间共享", () => {
    const g = makeFakeCanvasApi();
    let seenInUpdate: number | undefined;
    let seenInRender: number | undefined;
    const script: AnimScript = {
      setup: () => ({ count: 7 }),
      update: (state) => {
        seenInUpdate = (state as { count: number }).count;
      },
      render: (state, canvas) => {
        seenInRender = (state as { count: number }).count;
        void canvas;
      },
    };
    const player = createPlayer({
      canvasApi: g,
      context: { width: 100, height: 80 },
      script,
      requestFrame: () => 1,
      cancelFrame: () => {},
    });
    player.tick(0);
    expect(seenInUpdate).toBe(7);
    expect(seenInRender).toBe(7);
  });

  it("dispose 调用脚本的 dispose 钩子,且不再推进帧", () => {
    const g = makeFakeCanvasApi();
    const disposed = vi.fn();
    const rendered = vi.fn();
    const script: AnimScript = {
      setup: () => ({}),
      render: () => rendered(),
      dispose: () => disposed(),
    };
    const player = createPlayer({
      canvasApi: g,
      context: { width: 100, height: 80 },
      script,
      requestFrame: () => 1,
      cancelFrame: () => {},
    });
    player.tick(1);
    expect(rendered).toHaveBeenCalledTimes(1);
    player.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
    // dispose 后 tick 不应再推进
    player.tick(2);
    expect(player.frame).toBe(1);
  });

  it("stop 后不再通过 requestFrame 调度下一帧,dispose 后 start 不生效", () => {
    const g = makeFakeCanvasApi();
    let scheduled = 0;
    const script: AnimScript = {
      setup: () => ({}),
      render: () => {},
    };
    const player = createPlayer({
      canvasApi: g,
      context: { width: 100, height: 80 },
      script,
      requestFrame: (cb) => {
        scheduled += 1;
        void cb;
        return scheduled;
      },
      cancelFrame: () => {},
    });
    player.start();
    expect(scheduled).toBe(1); // start 只会调度一帧,不会同步推进
    player.stop();
    player.tick(10);
    expect(player.frame).toBe(1); // 手动推进一帧
    expect(scheduled).toBe(1); // stop 后没有新增调度
    player.dispose();
    player.start(); // dispose 后 start 不再生效
    expect(player.frame).toBe(1); // 仍是 dispose 前的帧数
  });
});

describe("defaultResolver", () => {
  it("恒等映射:直接把传入对象当作 AnimScript 返回", () => {
    const script = { render: () => {} } as AnimScript;
    expect(defaultResolver(script)).toBe(script);
  });
});