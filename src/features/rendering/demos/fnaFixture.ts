/**
 * fnaFixture —「顶点+FX」融合演示(fna-vertex-demo)的复用测试夹具与内容素材类型。
 *
 * 只放「数据」与「纯校验」:顶点/几何网格数组(与 public/demos/fna-vertex-demo.js
 * 静态素材同格式)与 HLSL shader 源码常量,以及导出可复用的校验/位移纯函数。
 * 组件 <FnaVertexDemo/>(见同目录 FnaVertexDemo.tsx)与测试都从这里取数据,
 * 保证「组件用法」「静态素材」「测试夹具」三者数据一致。
 */

import type { MeshVertexArrays } from "../useWebGLMesh";

/**
 * 网格几何规模:5×5 顶点构成的平面四边形网格。
 * 位置在 XY 平面(±1),Z=0;边索引为网格邻接四边形。
 */
export const FNA_GRID = { columns: 5, rows: 5 } as const;

/** 与静态素材 public/demos/fna-vertex-demo.js default 导出一致的形状标签。 */
export const FNA_VERTEX_DATA_FORMAT = "MeshVertexArrays-like" as const;

/** 是否校验通过的最小结构判定(供 fixture 与静态素材一致性校验)。 */
export interface VertexDataShape {
  positions: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array | Uint32Array;
}

/**
 * 构造 5×5 平面网格的顶点数组(positions/colors/uvs/indices)。
 * 纯函数、零副作用;每次调用返回新实例,便于调用方做位移等变换。
 */
export function buildFnaVertexData(): MeshVertexArrays {
  const { columns, rows } = FNA_GRID;
  const verts: Array<[number, number]> = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      // 位置映射到 [-1,1]×[-1,1](UV 同区间),Z=0。
      verts.push([(c / (columns - 1)) * 2 - 1, (r / (rows - 1)) * 2 - 1]);
    }
  }
  const count = verts.length;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const [x, y] = verts[i];
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = 0;
    // 颜色:按位置渐变(Cyan→Magenta),Alpha=0.85。
    colors[i * 4 + 0] = (x + 1) / 2;
    colors[i * 4 + 1] = (1 - Math.abs(x)) * 0.6;
    colors[i * 4 + 2] = (1 - Math.abs(y)) * 0.9;
    colors[i * 4 + 3] = 0.85;
    uvs[i * 2 + 0] = (x + 1) / 2;
    uvs[i * 2 + 1] = (y + 1) / 2;
  }

  // 索引:逐网格四边形两个三角形(顺时针)。columns*rows → (rows-1)*(columns-1) 个四边形。
  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < columns - 1; c += 1) {
      const a = r * columns + c;
      const b = a + 1;
      const d = a + columns;
      const e = d + 1;
      indices.push(a, d, e, a, e, b);
    }
  }
  return {
    positions,
    colors,
    uvs,
    indices: new Uint16Array(indices),
  };
}

/** 默认的基线顶点/几何数据(组件与测试共用;静态素材即由此导出)。 */
export const FNA_VERTEX_DATA: MeshVertexArrays = buildFnaVertexData();

/**
 * 对网格做时间驱动的「正弦波位移」(Z 轴):给定秒级时间 t 与波参,
 * 返回新顶点数组。供组件每帧重算,演示「顶点管线动态化」。
 */
export function waveDisplace(
  base: MeshVertexArrays,
  t: number,
  opts: { amplitude?: number; speed?: number } = {},
): MeshVertexArrays {
  const { amplitude = 0.25, speed = 2.0 } = opts;
  const positions = new Float32Array(base.positions);
  for (let i = 0; i < positions.length / 3; i += 1) {
    const x = positions[i * 3 + 0];
    const y = positions[i * 3 + 1];
    positions[i * 3 + 2] =
      amplitude * Math.sin(x * Math.PI + t * speed) * Math.cos(y * Math.PI + t * speed);
  }
  // colors/uvs/indices 复用基线的同一槽位。
  return { positions, colors: base.colors, uvs: base.uvs, indices: base.indices };
}

/** 校验顶点数据形状是否合法(长度按顶点数对齐、索引类型正确)。失败返回原因,成功返回 null。 */
export function validateVertexData(data: VertexDataShape): string | null {
  if (!data) return "顶点数据为空。";
  const count = data.positions.length / 3;
  if (!Number.isInteger(count) || count < 1) {
    return `positions 长度 ${data.positions.length} 不能构成顶点数。`;
  }
  if (data.colors.length !== count * 4) {
    return `colors 长度 ${data.colors.length} 与顶点数 ${count} 不一致(应为 ${count * 4})。`;
  }
  if (data.uvs.length !== count * 2) {
    return `uvs 长度 ${data.uvs.length} 与顶点数 ${count} 不一致(应为 ${count * 2})。`;
  }
  if (!(data.indices instanceof Uint16Array || data.indices instanceof Uint32Array)) {
    return "indices 必须是 Uint16Array 或 Uint32Array。";
  }
  if (data.indices.length === 0) {
    return "indices 不能为空。";
  }
  for (let i = 0; i < data.indices.length; i += 1) {
    if (data.indices[i] >= count) {
      return `indices[${i}] 越界(值 ${data.indices[i]} 超出顶点数 ${count})。`;
    }
  }
  return null;
}

/**
 * 「顶点+FX」融合演示所用的 HLSL(.fx)shader 源码。
 * 作为静态素材(fx:)嵌入引用,亦为测试夹具。节奏/网格与顶点网格呼应:
 * 一个随 iTime 脉动的线框网格 + 顶点位置高亮光点。
 */
export const FNA_FX_SOURCE = `
/* fna-vertex-demo.fx — 顶点+FX 融合演示的叠加 shader(协议嵌入 fx: 素材)。
   片段入口 mainImage;运行时注入 iTime/iResolution/iFrame 等 uniform。 */
void mainImage(out float4 fragColor, float2 fragCoord) {
    float2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    float2 p = uv * 2.0 - 1.0;
    p.x *= aspect;

    // 1) 线框网格:随 iTime 缓慢漂移的 UV 网格线。
    float grid = 8.0;
    float2 g = abs(fract(p * grid - iTime * 0.05) - 0.5);
    float line = smoothstep(0.48, 0.50, max(g.x, g.y));
    float3 gridCol = float3(0.10, 0.35, 0.45) * line;

    // 2) 边缘晕染(青色系)。
    float edge = smoothstep(0.9, 0.15, length(p));
    float3 glow = float3(0.05, 0.25, 0.35) * edge;

    // 3) 顶点高亮光点:在网格顶点处撒一圈随 iTime 明暗的光点。
    float2 pointId = floor(p * grid);
    float2 rnd = frac(sin(dot(pointId, float2(12.9898, 78.233))) * 43758.5453);
    float blink = 0.5 + 0.5 * sin(iTime * 2.0 + rnd.x * 6.28);
    float d = length(frac(p * grid) - 0.5);
    float spark = smoothstep(0.12, 0.0, d) * blink * 0.8;

    float3 col =
        gridCol
        + glow
        + float3(0.4, 0.9, 1.0) * spark;
    fragColor = float4(col, 1.0);
}
`;
