/**
 * fna-vertex-demo.js —— 「顶点+FX」融合演示的顶点/几何数据静态素材。
 *
 * 遵循 <FnaVertexDemo/>(rendering 融合演示)的「MeshVertexArrays-like」数据格式:
 * 自包含 ES 模块(不 import src/,因其会作为静态资源被加载),default 导出
 * { format, label, columns, rows, positions, colors, uvs, indices }。
 *
 * 顶点结构(与 src/features/rendering/useWebGLMesh.ts 的 MeshVertexArrays 一致):
 *   positions: n*3 个 float(Float32Array)  —— x,y,z(±1, z=0)
 *   colors:    n*4 个 float(Float32Array)  —— r,g,b,a(渐变,alpha≈0.85)
 *   uvs:       n*2 个 float(Float32Array)  —— u,v(与位置同区间)
 *   indices:   Uint16Array                 —— 每四边形两个三角形(顺时针)
 * 使用方(协议嵌入顶点:或测试夹具)可直接把 positions/colors/uvs/indices
 * 交给 useWebGLMesh 的 createMesh / packVertices。
 */

/** 5×5 顶点平面四边形网格(与 fixture fnaFixture.ts 的 FNA_GRID 一致)。 */
const columns = 5;
const rows = 5;

const count = columns * rows;
const positions = new Float32Array(count * 3);
const colors = new Float32Array(count * 4);
const uvs = new Float32Array(count * 2);

for (let r = 0; r < rows; r += 1) {
  for (let c = 0; c < columns; c += 1) {
    const x = (c / (columns - 1)) * 2 - 1;
    const y = (r / (rows - 1)) * 2 - 1;
    const i = r * columns + c;
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = 0;
    colors[i * 4 + 0] = (x + 1) / 2;
    colors[i * 4 + 1] = (1 - Math.abs(x)) * 0.6;
    colors[i * 4 + 2] = (1 - Math.abs(y)) * 0.9;
    colors[i * 4 + 3] = 0.85;
    uvs[i * 2 + 0] = (x + 1) / 2;
    uvs[i * 2 + 1] = (y + 1) / 2;
  }
}

// 索引:逐网格四边形两个三角形(顺时针)。(rows-1)*(columns-1) 个四边形。
const idx = [];
for (let r = 0; r < rows - 1; r += 1) {
  for (let c = 0; c < columns - 1; c += 1) {
    const a = r * columns + c;
    const b = a + 1;
    const d = a + columns;
    const e = d + 1;
    idx.push(a, d, e, a, e, b);
  }
}

export default {
  format: "MeshVertexArrays-like",
  label: "fna-vertex-demo (5x5 平面网格,Vertex+FX 融合演示)",
  columns,
  rows,
  positions,
  colors,
  uvs,
  indices: new Uint16Array(idx),
};
