import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  FNA_GRID,
  FNA_VERTEX_DATA,
  FNA_FX_SOURCE,
  buildFnaVertexData,
  waveDisplace,
  validateVertexData,
} from "./fnaFixture";

describe("fnaFixture — 顶点/几何测试夹具", () => {
  test("buildFnaVertexData:5×5 网格,positions/colors/uvs/indices 长度对齐", () => {
    const { columns, rows } = FNA_GRID;
    const count = columns * rows;
    const data = buildFnaVertexData();
    expect(data.positions.length).toBe(count * 3);
    expect(data.colors.length).toBe(count * 4);
    expect(data.uvs.length).toBe(count * 2);
    // (rows-1)*(columns-1) 个四边形 × 6 索引。
    expect(data.indices.length).toBe((rows - 1) * (columns - 1) * 6);
    expect(data.indices).toBeInstanceOf(Uint16Array);
    // 默认夹具与构建结果一致。
    expect(FNA_VERTEX_DATA.positions).toEqual(data.positions);
  });

  test("validateVertexData:合法数据返回 null,非法返回原因", () => {
    expect(validateVertexData(FNA_VERTEX_DATA)).toBeNull();
    // colors 长度不对。
    const badColors = { ...FNA_VERTEX_DATA, colors: new Float32Array(3) };
    expect(validateVertexData(badColors)).toContain("colors");
    // 索引越界。
    const badIdx = { ...FNA_VERTEX_DATA, indices: new Uint16Array([0, 999]) };
    expect(validateVertexData(badIdx)).toContain("越界");
    // 空数据。
    expect(validateVertexData(null as never)).toContain("为空");
  });

  test("waveDisplace:仅改 Z 轴位移,长度/颜色/UV/索引不变", () => {
    const displaced = waveDisplace(FNA_VERTEX_DATA, 1.25, { amplitude: 0.5, speed: 2 });
    expect(displaced.positions.length).toBe(FNA_VERTEX_DATA.positions.length);
    // Z 轴至少有位移,XY 不变。
    let moved = false;
    for (let i = 0; i < displaced.positions.length / 3; i += 1) {
      expect(displaced.positions[i * 3 + 0]).toBe(FNA_VERTEX_DATA.positions[i * 3 + 0]);
      expect(displaced.positions[i * 3 + 1]).toBe(FNA_VERTEX_DATA.positions[i * 3 + 1]);
      if (displaced.positions[i * 3 + 2] !== 0) moved = true;
    }
    expect(moved).toBe(true);
    // 颜色/UV/索引槽位复用同一实例。
    expect(displaced.colors).toBe(FNA_VERTEX_DATA.colors);
    expect(displaced.uvs).toBe(FNA_VERTEX_DATA.uvs);
    expect(displaced.indices).toBe(FNA_VERTEX_DATA.indices);
    // t=0 且有振幅时位移为 0(正弦零点),但结构仍合法。
    expect(validateVertexData(displaced)).toBeNull();
  });

  test("FNA_FX_SOURCE:可被 hlslToGLSL 转译为合法 GLSL 300 es 片段", async () => {
    const { translateFragmentSource } = await import("../hlslToGLSL");
    const result = translateFragmentSource(FNA_FX_SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toContain("#version 300 es");
    expect(result.source).toContain("iTime");
    expect(result.source).not.toContain("float2 uv"); // 类型已改写
  });

  test("FNA_FX_SOURCE 与静态素材 fna-vertex-demo.fx 正文一致(防双副本漂移)", () => {
    // 两处同源副本:静态素材 .fx 文件与测试夹具常量。忽略各自不同的头部注释与
    // 首尾空白后,正文必须逐字符一致;若任一侧改了着色器逻辑这里就会失败。
    // 注意:vitest 转译后 import.meta.url 非 file: scheme,故用进程工作目录定位素材。
    const fxBody = readFileSync(
      join(process.cwd(), "src/assets/demos/fna-vertex-demo.fx"),
      "utf8",
    )
      .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "")
      .trim();
    expect(FNA_FX_SOURCE.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "").trim()).toBe(fxBody);
  });
});
