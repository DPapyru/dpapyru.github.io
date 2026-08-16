import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProtocolRender } from "./ProtocolRender";

/**
 * 协议嵌入渲染接管(ticket #17):公开外部行为 ——
 * - anims: 解析到 public/demos 素材 → <AnimCanvas/> 挂载(canvas 出现);
 * - fx:    解析到 .fx 素材 → <ShaderStage/> 挂载(canvas 出现;jsdom 无 WebGL2 时
 *          展示明确的上下文错误横幅,不静默、不崩溃);
 * - 素材缺失 → 明确错误提示(不破坏整篇)。
 */
describe("ProtocolRender 协议嵌入渲染接管", () => {
  it("anims: 解析素材并挂载 AnimCanvas(画布出现)", () => {
    render(<ProtocolRender protocol="anims" path="demos/demo-anim-rotating-square.js" />);

    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("fx: 解析素材并挂载 ShaderStage(画布出现;jsdom 无 WebGL2 给出明确错误横幅)", () => {
    render(<ProtocolRender protocol="fx" path="demos/fna-vertex-demo.fx" />);

    const canvas = screen.getByTestId("shader-stage-canvas");
    expect(canvas).toBeInTheDocument();
    // jsdom 无 WebGL2:应显示明确错误而非静默失败。
    expect(screen.getByTestId("shader-stage-error")).toBeInTheDocument();
  });

  it("anims: 素材缺失给出明确错误提示", () => {
    render(<ProtocolRender protocol="anims" path="demos/not-exist.js" />);
    expect(screen.getByTestId("protocol-missing")).toHaveTextContent("not-exist.js");
  });

  it("fx: 素材缺失给出明确错误提示", () => {
    render(<ProtocolRender protocol="fx" path="demos/not-exist.fx" />);
    expect(screen.getByTestId("protocol-missing")).toHaveTextContent("not-exist.fx");
  });
});
