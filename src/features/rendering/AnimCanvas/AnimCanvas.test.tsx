/**
 * <AnimCanvas/> 挂载测试(RTL)—— 断言组件挂载后存在 canvas、props 生效:
 *   - 渲染出 <canvas> 元素;
 *   - 注入的解析器(resolver)被调用并完成脚本解析;
 *   - 注入的 canvasApiFactory 被调用(可测试 / 可替换);
 *   - 卸载时清理(dispose 被调用),不产生失控帧循环。
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AnimCanvas } from "./AnimCanvas";
import type { AnimScript, AnimScriptResolver, CanvasApi } from "./runtime";
import type { Vec2 } from "../../../shared/capabilities/geometry";

// jsdom 未实现 2D canvas:stub getContext 返回 null,避免构造默认 Canvas2D 时触发
// "Not implemented" 噪音,同时保持默认 wiring 路径可测。
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((type: string) => {
    if (type === "2d") return null;
    return null as never;
  });
});

describe("AnimCanvas 挂载", () => {
  it("渲染出 canvas 元素", () => {
    render(<AnimCanvas script={{} as AnimScript} />);
    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("空 script 也能挂载(可选钩子缺省为空),且应用注入的 width/height", () => {
    const { container } = render(<AnimCanvas script={{}} width={320} height={180} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas!.style.width).toBe("320px");
    expect(canvas!.style.height).toBe("180px");
  });

  it("注入的 resolver 被调用并解析脚本", () => {
    const spec = { type: "from-resolver" };
    const resolved: AnimScript = { render: () => {} };
    const resolver = vi.fn(() => resolved);
    render(<AnimCanvas script={spec} resolver={resolver as AnimScriptResolver} />);
    expect(resolver).toHaveBeenCalledWith(spec);
  });

  it("注入的 canvasApiFactory 被调用(可测试 / 可替换渲染后端)", () => {
    const fakeApi: CanvasApi = {
      width: 100,
      height: 80,
      clear: () => {},
      rect: (_cx: Vec2) => {},
      line: () => {},
      arrow: () => {},
      circle: () => {},
    };
    const factory = vi.fn(() => fakeApi);
    render(<AnimCanvas script={{ render: () => {} }} canvasApiFactory={factory} />);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("卸载时调用脚本 dispose 做清理", () => {
    const disposeSpy = vi.fn();
    const script: AnimScript = {
      setup: () => ({}),
      render: () => {},
      dispose: () => disposeSpy(),
    };
    const { unmount } = render(
      <AnimCanvas
        script={script}
        canvasApiFactory={() => ({
          width: 100,
          height: 80,
          clear: () => {},
          rect: () => {},
          line: () => {},
          arrow: () => {},
          circle: () => {},
        })}
      />,
    );
    expect(disposeSpy).not.toHaveBeenCalled();
    unmount();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });


});