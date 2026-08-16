import { describe, expect, test, vi } from "vitest";
import {
  packVertices,
  createMesh,
  VERTEX_FLOATS,
  VERTEX_STRIDE_BYTES,
  POSITION_OFFSET_BYTES,
  COLOR_OFFSET_BYTES,
  UV_OFFSET_BYTES,
  ATTR_POSITION,
  ATTR_COLOR,
  ATTR_UV,
  GL_ARRAY_BUFFER,
  GL_ELEMENT_ARRAY_BUFFER,
  GL_STATIC_DRAW,
  GL_FLOAT,
  GL_UNSIGNED_SHORT,
  GL_UNSIGNED_INT,
  GL_TRIANGLES,
  GL_BLEND,
  GL_SRC_ALPHA,
  GL_ONE_MINUS_SRC_ALPHA,
  type WebGLMeshContext,
} from "./useWebGLMesh";

/** 记录的 WebGL 调用:方法名 + 实参。 */
interface GLCall {
  name: string;
  args: unknown[];
}
/** 可记录调用的 mock 上下文。 */
interface MockGL extends WebGLMeshContext {
  __calls: GLCall[];
}

/**
 * 构造一个记录调用的 WebGL mock 上下文:每个方法都记录 (name, args),
 * buffer/vao 句柄用普通对象表示。返回类型带 __calls 便于断言。
 */
function createMockGL(): MockGL {
  const calls: GLCall[] = [];
  let handleSeq = 0;
  const call = (name: string, args: unknown[]): void => {
    calls.push({ name, args });
  };
  const record = (name: string) =>
    (...args: unknown[]): { __handle: number } => {
      call(name, args);
      return { __handle: ++handleSeq };
    };

  const gl = {
    createVertexArray: vi.fn(record("createVertexArray")),
    bindVertexArray: vi.fn((...args: unknown[]) => call("bindVertexArray", args)),
    createBuffer: vi.fn(record("createBuffer")),
    bindBuffer: vi.fn((...args: unknown[]) => call("bindBuffer", args)),
    bufferData: vi.fn((...args: unknown[]) => call("bufferData", args)),
    enableVertexAttribArray: vi.fn((...args: unknown[]) => call("enableVertexAttribArray", args)),
    vertexAttribPointer: vi.fn((...args: unknown[]) => call("vertexAttribPointer", args)),
    enable: vi.fn((...args: unknown[]) => call("enable", args)),
    blendFunc: vi.fn((...args: unknown[]) => call("blendFunc", args)),
    drawElements: vi.fn((...args: unknown[]) => call("drawElements", args)),
    deleteBuffer: vi.fn((...args: unknown[]) => call("deleteBuffer", args)),
    deleteVertexArray: vi.fn((...args: unknown[]) => call("deleteVertexArray", args)),
    __calls: calls,
  };
  return gl as unknown as MockGL;
}

// 顶点常量断言:打包布局。
describe("顶点布局常量", () => {
  test("顶点步长 = 9 float = 36 字节", () => {
    expect(VERTEX_FLOATS).toBe(9);
    expect(VERTEX_STRIDE_BYTES).toBe(36);
  });

  test("字段字节偏移:Position=0、Color=12、UV=28", () => {
    expect(POSITION_OFFSET_BYTES).toBe(0);
    expect(COLOR_OFFSET_BYTES).toBe(12);
    expect(UV_OFFSET_BYTES).toBe(28);
  });

  test("属性绑定位置:位置0/颜色1/UV2", () => {
    expect(ATTR_POSITION).toBe(0);
    expect(ATTR_COLOR).toBe(1);
    expect(ATTR_UV).toBe(2);
  });
});

describe("packVertices — 打包布局(输入→输出)", () => {
  const data = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0]),
    colors: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 1]),
    indices: new Uint16Array([0, 1, 2]),
  };

  test("两个顶点打包为 18 个 float 的交错缓冲", () => {
    const out = packVertices(data);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(2 * VERTEX_FLOATS); // 18
  });

  test("交错布局:顶点0 为 [pos,color,uv],顶点1 紧随其后", () => {
    const out = packVertices(data);
    expect(Array.from(out)).toEqual([
      0, 0, 0, // 顶点0 位置
      1, 0, 0, 1, // 顶点0 颜色
      0, 0, // 顶点0 UV
      1, 0, 0, // 顶点1 位置
      0, 1, 0, 1, // 顶点1 颜色
      1, 1, // 顶点1 UV
    ]);
  });

  test("字段在字节偏移上正确:color 从 12 字节、uv 从 28 字节", () => {
    const out = packVertices(data);
    expect(out[COLOR_OFFSET_BYTES / 4]).toBe(data.colors[0]);
    expect(out[UV_OFFSET_BYTES / 4]).toBe(data.uvs[0]);
  });

  test("入参长度不一致时抛错", () => {
    expect(() =>
      packVertices({
        positions: new Float32Array([0, 0, 0]),
        colors: new Float32Array([1, 0, 0]), // 应为 4,故意给 3
        uvs: new Float32Array([0, 0]),
        indices: new Uint16Array([0]),
      }),
    ).toThrow("colors");
  });
});

describe("createMesh — mock 上下文调用", () => {
  test("VAO/VBO/IBO 创建与绑定、属性指针、blend state、drawElements", () => {
    const gl = createMockGL();
    const data = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0]),
      colors: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 1]),
      indices: new Uint16Array([0, 1, 2]),
    };
    const mesh = createMesh(gl, data);
    mesh.draw();

    const c = gl.__calls;
    // VAO 创建并绑定
    expect(c.some((x) => x.name === "createVertexArray")).toBe(true);
    expect(c.some((x) => x.name === "createBuffer")).toBe(true);
    // 绑定顺序:先 VAO(第一绑定非空句柄),setup 末尾一次解除绑定
    const bindVao = c.filter((x) => x.name === "bindVertexArray");
    expect(bindVao[0].args[0]).toEqual(expect.anything());
    expect(c.some((x) => x.name === "bindVertexArray" && x.args[0] === null)).toBe(true);
    // 随后 draw() 重新绑定 VAO(位于 setup 之后)
    expect(bindVao.at(-1)!.args[0]).toEqual(expect.anything());
    // VBO / IBO 缓冲数据(交错 + 索引),usage STATIC_DRAW
    const bufferDataCalls = c.filter((x) => x.name === "bufferData");
    expect(bufferDataCalls).toHaveLength(2);
    expect(bufferDataCalls[0].args[0]).toBe(GL_ARRAY_BUFFER);
    expect((bufferDataCalls[0].args[1] as Float32Array).length).toBe(18);
    expect(bufferDataCalls[0].args[2]).toBe(GL_STATIC_DRAW);
    expect(bufferDataCalls[1].args[0]).toBe(GL_ELEMENT_ARRAY_BUFFER);
    expect(bufferDataCalls[1].args[1]).toBe(data.indices);
    expect(bufferDataCalls[1].args[2]).toBe(GL_STATIC_DRAW);
    // 属性指针:3 个属性按位置 0/1/2、size 3/4/2、给定 stride/offset
    const aps = c.filter((x) => x.name === "vertexAttribPointer");
    expect(aps).toHaveLength(3);
    expect(aps[0].args).toEqual([ATTR_POSITION, 3, GL_FLOAT, false, 36, 0]);
    expect(aps[1].args).toEqual([ATTR_COLOR, 4, GL_FLOAT, false, 36, 12]);
    expect(aps[2].args).toEqual([ATTR_UV, 2, GL_FLOAT, false, 36, 28]);
    for (const idx of [ATTR_POSITION, ATTR_COLOR, ATTR_UV]) {
      expect(
        c.some((x) => x.name === "enableVertexAttribArray" && x.args[0] === idx),
      ).toBe(true);
    }
    // blend state
    expect(c.some((x) => x.name === "enable" && x.args[0] === GL_BLEND)).toBe(true);
    const bf = c.find((x) => x.name === "blendFunc");
    expect(bf!.args).toEqual([GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA]);
    // drawElements:一次 triangle 绘制,count = 索引数,type = unsigned short
    const draws = c.filter((x) => x.name === "drawElements");
    expect(draws).toHaveLength(1);
    expect(draws[0].args).toEqual([GL_TRIANGLES, 3, GL_UNSIGNED_SHORT, 0]);
    // 自定义 mode 传递
    const mesh2 = createMesh(gl, data, 0x0005);
    mesh2.draw();
    expect(c.filter((x) => x.name === "drawElements").at(-1)!.args[0]).toBe(0x0005);
  });

  test("dispose 释放 VBO/IBO/VAO 并解除绑定", () => {
    const gl = createMockGL();
    const data = {
      positions: new Float32Array([0, 0, 0]),
      colors: new Float32Array([1, 1, 1, 1]),
      uvs: new Float32Array([0, 0]),
      indices: new Uint16Array([0]),
    };
    const mesh = createMesh(gl, data);
    mesh.dispose();
    const c = gl.__calls;
    expect(c.filter((x) => x.name === "deleteBuffer")).toHaveLength(2);
    expect(c.some((x) => x.name === "deleteVertexArray")).toBe(true);
    // 删除前解除绑定
    const bindVao = c.filter((x) => x.name === "bindVertexArray");
    expect(bindVao.at(-1)!.args[0]).toBeNull();
  });

  test("Uint32Array 索引使用无符号整型绘制", () => {
    const gl = createMockGL();
    const data = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0]),
      colors: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 1]),
      indices: new Uint32Array([0, 1, 2]),
    };
    const mesh = createMesh(gl, data);
    mesh.draw();
    const draws = gl.__calls.filter((x) => x.name === "drawElements");
    expect(draws[0].args[2]).toBe(GL_UNSIGNED_INT);
  });
});
