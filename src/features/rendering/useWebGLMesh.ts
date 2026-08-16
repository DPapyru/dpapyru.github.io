/**
 * useWebGLMesh — 渲染能力(rendering feature)的 WebGL2 顶点绘制 hook。
 *
 * 开发者用 hook 声明顶点数据(位置 + 颜色 + UV)与索引,自动完成
 * Float32Array 顶点打包、VAO/VBO/IBO 设置、blend state 与绘制(drawElements);
 * 自定义顶点绘制可复用。基于共享层 geometry(#12)约定,零第三方运行时依赖。
 *
 * 顶点结构(交错打包,stride 36 字节):
 *   Position(3) + Color(4) + UV(2) = 9 个 float = 36 字节
 *
 * WebGL 上下文可注入(structural 接口 WebGLMeshContext):
 *   生产传真实 WebGL2RenderingContext(满足该结构类型),测试传 mock。
 */

import { useCallback, useLayoutEffect, useRef } from "react";

/** 单个顶点包含的 float 数量(位置3 + 颜色4 + UV2)。 */
export const VERTEX_FLOATS = 9;

/** 交错顶点缓冲的步长(字节)= VERTEX_FLOATS * 4。 */
export const VERTEX_STRIDE_BYTES = 36;

/** Position 字段在顶点中的字节偏移(第 0 个 float)。 */
export const POSITION_OFFSET_BYTES = 0;

/** Color 字段在顶点中的字节偏移(第 3 个 float → 12 字节)。 */
export const COLOR_OFFSET_BYTES = 3 * 4;

/** UV 字段在顶点中的字节偏移(第 7 个 float → 28 字节)。 */
export const UV_OFFSET_BYTES = 7 * 4;

/** 顶点属性绑定位置:位置。 */
export const ATTR_POSITION = 0;
/** 顶点属性绑定位置:颜色。 */
export const ATTR_COLOR = 1;
/** 顶点属性绑定位置:UV。 */
export const ATTR_UV = 2;

/** WebGL 常量(hook 用到的子集),便于 mock 断言与可读性。 */
export const GL_ARRAY_BUFFER = 0x8892;
export const GL_ELEMENT_ARRAY_BUFFER = 0x8893;
export const GL_STATIC_DRAW = 0x88e4;
export const GL_FLOAT = 0x1406;
export const GL_UNSIGNED_SHORT = 0x1403;
export const GL_UNSIGNED_INT = 0x1405;
export const GL_TRIANGLES = 0x0004;
export const GL_BLEND = 0x0be2;
export const GL_SRC_ALPHA = 0x0302;
export const GL_ONE_MINUS_SRC_ALPHA = 0x0303;

/** 顶点属性数组(长度按顶点数对齐:positions 长 n*3、colors 长 n*4、uvs 长 n*2)。 */
export interface MeshVertexArrays {
  /** 位置,长度 = 顶点数 * 3。 */
  positions: Float32Array;
  /** 颜色,长度 = 顶点数 * 4(RGBA)。 */
  colors: Float32Array;
  /** UV,长度 = 顶点数 * 2。 */
  uvs: Float32Array;
  /** 索引(16 或 32 位)。 */
  indices: Uint16Array | Uint32Array;
}

/**
 * useWebGLMesh 所需的 WebGL 上下文最小结构接口。生产传真实
 * WebGL2RenderingContext(其方法集结构上满足本接口);测试传 mock。
 * VAO/VBO/IBO 是不透明句柄,以 unknown 表示,便于注入 mock。
 */
export interface WebGLMeshContext {
  createVertexArray(): unknown;
  bindVertexArray(vao: unknown): void;
  createBuffer(): unknown;
  bindBuffer(target: number, buffer: unknown): void;
  bufferData(target: number, data: Float32Array | Uint16Array | Uint32Array, usage: number): void;
  enableVertexAttribArray(index: number): void;
  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
  ): void;
  enable(cap: number): void;
  blendFunc(sfactor: number, dfactor: number): void;
  drawElements(
    mode: number,
    count: number,
    type: number,
    offset: number,
  ): void;
  deleteBuffer(buffer: unknown): void;
  deleteVertexArray(vao: unknown): void;
}

/**
 * 把分离的位置/颜色/UV 数组打包为交错 Float32Array(Interleaved)。
 *
 * 布局(每顶点 9 个 float):[px,py,pz, r,g,b,a,  u,v]。
 * 各入参数组长度须一致(顶点数一致),否则抛错。
 */
export function packVertices(data: MeshVertexArrays): Float32Array {
  const { positions, colors, uvs } = data;
  const count = positions.length / 3;
  if (colors.length !== count * 4) {
    throw new Error(
      `packVertices: colors 长度 ${colors.length} 与顶点数 ${count} 不一致(应为 ${count * 4})`,
    );
  }
  if (uvs.length !== count * 2) {
    throw new Error(
      `packVertices: uvs 长度 ${uvs.length} 与顶点数 ${count} 不一致(应为 ${count * 2})`,
    );
  }

  const out = new Float32Array(count * VERTEX_FLOATS);
  for (let i = 0; i < count; i++) {
    const p = i * 3;
    const c = i * 4;
    const u = i * 2;
    const dst = i * VERTEX_FLOATS;
    out[dst] = positions[p];
    out[dst + 1] = positions[p + 1];
    out[dst + 2] = positions[p + 2];
    out[dst + 3] = colors[c];
    out[dst + 4] = colors[c + 1];
    out[dst + 5] = colors[c + 2];
    out[dst + 6] = colors[c + 3];
    out[dst + 7] = uvs[u];
    out[dst + 8] = uvs[u + 1];
  }
  return out;
}

/** 顶点绘制句柄:draw() 触发一次 drawElements;dispose() 释放 GPU 资源。 */
export interface RenderMeshHandle {
  draw(): void;
  dispose(): void;
}

/** 由索引数组推到 WebGL 索引类型常量(Uint32 → 无符号整型,其余 → 无符号短整型)。 */
function indexType(indices: Uint16Array | Uint32Array): number {
  return indices instanceof Uint32Array ? GL_UNSIGNED_INT : GL_UNSIGNED_SHORT;
}

/**
 * 创建一帧自含的顶点网格绘制句柄:设置 VAO/VBO/IBO、blend state,
 * 返回 draw()/dispose()。纯命令式核心,useWebGLMesh 只是其 React 包装。
 */
export function createMesh(
  gl: WebGLMeshContext,
  data: MeshVertexArrays,
  mode: number = GL_TRIANGLES,
): RenderMeshHandle {
  const packed = packVertices(data);
  const { indices } = data;

  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();

  gl.bindVertexArray(vao);
  gl.bindBuffer(GL_ARRAY_BUFFER, vbo);
  gl.bufferData(GL_ARRAY_BUFFER, packed, GL_STATIC_DRAW);

  // 位置(3 float)
  gl.vertexAttribPointer(
    ATTR_POSITION,
    3,
    GL_FLOAT,
    false,
    VERTEX_STRIDE_BYTES,
    POSITION_OFFSET_BYTES,
  );
  gl.enableVertexAttribArray(ATTR_POSITION);
  // 颜色(4 float)
  gl.vertexAttribPointer(
    ATTR_COLOR,
    4,
    GL_FLOAT,
    false,
    VERTEX_STRIDE_BYTES,
    COLOR_OFFSET_BYTES,
  );
  gl.enableVertexAttribArray(ATTR_COLOR);
  // UV(2 float)
  gl.vertexAttribPointer(
    ATTR_UV,
    2,
    GL_FLOAT,
    false,
    VERTEX_STRIDE_BYTES,
    UV_OFFSET_BYTES,
  );
  gl.enableVertexAttribArray(ATTR_UV);

  gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, indices, GL_STATIC_DRAW);

  // blend state:标准 alpha 混合。
  gl.enable(GL_BLEND);
  gl.blendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

  // 解除绑定,draw 时再绑定。
  gl.bindVertexArray(null);

  const indexCount = indices.length;
  const drawType = indexType(indices);

  return {
    draw() {
      gl.bindVertexArray(vao);
      gl.drawElements(mode, indexCount, drawType, 0);
    },
    dispose() {
      gl.bindVertexArray(null);
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ibo);
      gl.deleteVertexArray(vao);
    },
  };
}

/**
 * useWebGLMesh — React hook 包装 createMesh。
 *
 * 依赖 gl / data / mode 变化时重建网格;卸载或依赖变化时自动 dispose。
 * 返回 draw() 与 dispose()。依赖数组对 data 做对象相等比较(不变引用不重建)。
 */
export function useWebGLMesh({
  gl,
  data,
  mode = GL_TRIANGLES,
}: {
  gl: WebGLMeshContext;
  data: MeshVertexArrays;
  mode?: number;
}): RenderMeshHandle {
  const handleRef = useRef<RenderMeshHandle | null>(null);

  useLayoutEffect(() => {
    const handle = createMesh(gl, data, mode);
    handleRef.current = handle;
    return () => {
      handle.dispose();
      if (handleRef.current === handle) handleRef.current = null;
    };
  }, [gl, data, mode]);

  const draw = useCallback(() => {
    handleRef.current?.draw();
  }, [handleRef]);

  const dispose = useCallback(() => {
    handleRef.current?.dispose();
    handleRef.current = null;
  }, [handleRef]);

  return { draw, dispose };
}
