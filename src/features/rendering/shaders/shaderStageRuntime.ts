/**
 * ShaderStage WebGL2 运行时 — 全屏片段着色器渲染循环(rendering feature)。
 *
 * 输入已转译好的 GLSL 300 es 片段源码,配合固定全屏过场顶点着色器,
 * 编译链接后每帧更新运行时 uniform(iTime/iResolution/iFrame 等)并以索引绘制。
 *
 * 可测性:所有 GL 调用经由结构接口 ShaderStageGL 以 unknown 句柄透传,
 * 测试注入 mock 即可断言外部行为;生产传真实 WebGL2RenderingContext。
 */

/** 全屏四边形顶点(两个三角形,裁剪空间)。 */
export const FULLSCREEN_POSITIONS = new Float32Array([
  -1.0, -1.0, 0.0, 1.0, -1.0, 0.0, -1.0, 1.0, 0.0, 1.0, 1.0, 0.0,
]);

/**
 * 全屏四边形 UV,顶点序与 FULLSCREEN_POSITIONS 一致:BL, BR, TL, TR。
 * 契约与入口 main() 的 "vec2 uv = vec2(vUv.x, 1.0 - vUv.y)" 翻转匹配:
 * 底部顶点 v=1、顶部顶点 v=0(BL(0,1) BR(1,1) TL(0,0) TR(1,0))。
 */
export const FULLSCREEN_TEXCOORDS = new Float32Array([
  0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0,
]);

/** 三角形化须铺满 [-1,1]² 全屏:(BL,BR,TR) + (BL,TR,TL)。 */
export const FULLSCREEN_INDICES = new Uint16Array([0, 1, 3, 0, 3, 2]);

/** 固定全屏过场顶点着色器(透传位置与 UV)。 */
export const FULLSCREEN_VERTEX = [
  "#version 300 es",
  "precision highp float;",
  "layout(location = 0) in vec3 aPosition;",
  "layout(location = 2) in vec2 aTexCoord;",
  "out vec2 vUv;",
  "void main() { gl_Position = vec4(aPosition, 1.0); vUv = aTexCoord; }",
].join("\n");

/** ShaderStage 渲染所需的最小 WebGL2 结构接口(mock 友好)。 */
export interface ShaderStageGL {
  createShader(type: number): unknown | null;
  shaderSource(shader: unknown, source: string): void;
  compileShader(shader: unknown): void;
  getShaderParameter(shader: unknown, pname: number): boolean;
  getShaderInfoLog(shader: unknown): string | null;
  deleteShader(shader: unknown): void;
  createProgram(): unknown | null;
  attachShader(program: unknown, shader: unknown): void;
  linkProgram(program: unknown): void;
  getProgramParameter(program: unknown, pname: number): boolean;
  getProgramInfoLog(program: unknown): string | null;
  deleteProgram(program: unknown): void;
  useProgram(program: unknown): void;
  getAttribLocation(program: unknown, name: string): number;
  getUniformLocation(program: unknown, name: string): unknown | null;
  uniform2f(loc: unknown, x: number, y: number): void;
  uniform1f(loc: unknown, x: number): void;
  uniform1i(loc: unknown, x: number): void;
  uniform3f(loc: unknown, x: number, y: number, z: number): void;
  createBuffer(): unknown;
  bindBuffer(target: number, buffer: unknown): void;
  bufferData(target: number, data: BufferSource, usage: number): void;
  enableVertexAttribArray(index: number): void;
  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
  ): void;
  viewport(x: number, y: number, w: number, h: number): void;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  drawElements(mode: number, count: number, type: number, offset: number): void;
}

// WebGL2 常用常量子集(便于 mock 断言与可读性)。
export const GL_VERTEX_SHADER = 0x8b31;
export const GL_FRAGMENT_SHADER = 0x8b30;
export const GL_COMPILE_STATUS = 0x8b81;
export const GL_LINK_STATUS = 0x8b82;
export const GL_ARRAY_BUFFER = 0x8892;
export const GL_ELEMENT_ARRAY_BUFFER = 0x8893;
export const GL_STATIC_DRAW = 0x88e4;
export const GL_FLOAT = 0x1406;
export const GL_UNSIGNED_SHORT = 0x1403;
export const GL_TRIANGLES = 0x0004;

/** 单帧渲染会使用并上报的运行时 uniform 值。 */
export interface ShaderStageFrameState {
  time: number;
  delta: number;
  frame: number;
  width: number;
  height: number;
}

/** 运行时会查询并更新的 uniform 名(须与转译注入的声明一致)。 */
const UNIFORMS = ["uResolution", "uTime", "iResolution", "iTime", "iTimeDelta", "iFrame"] as const;

export interface ShaderProgramHandles {
  program: unknown;
  posVbo: unknown;
  texVbo: unknown;
  ibo: unknown;
}

/** 供测试观测的已上传 uniform 快照。 */
export interface UniformSnapshot {
  name: string;
  kind: "2f" | "1f" | "1i" | "3f";
  values: number[];
}

/** 单次编译链接产物;失败返回错误信息。 */
export type ProgramBuild =
  | { ok: true; handles: ShaderProgramHandles; uniformLocations: Record<string, unknown> }
  | { ok: false; error: string };

/** 编译单个着色器,失败返回 null。 */
export function compileShader(gl: ShaderStageGL, type: number, source: string): unknown | null {
  try {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, GL_COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  } catch {
    return null;
  }
}

function shaderErr(gl: ShaderStageGL, shader: unknown, label: string): string {
  return shader ? (gl.getShaderInfoLog(shader) ?? "").trim() : label;
}

/** 编译并链接全屏片段程序;返回句柄与 uniform 位置。 */
export function buildProgram(
  gl: ShaderStageGL,
  vertexSource: string,
  fragmentSource: string,
): ProgramBuild {
  const vertex = compileShader(gl, GL_VERTEX_SHADER, vertexSource);
  const frag = compileShader(gl, GL_FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) {
    return { ok: false, error: "无法创建 GL 程序(createProgram 返回空)。" };
  }
  if (vertex) gl.attachShader(program, vertex);
  if (frag) gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, GL_LINK_STATUS)) {
    const details = [
      shaderErr(gl, vertex, "vertex 编译失败"),
      shaderErr(gl, frag, "fragment 编译失败"),
      gl.getProgramInfoLog(program) ?? "",
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" | ");
    gl.deleteProgram(program);
    if (vertex) gl.deleteShader(vertex);
    if (frag) gl.deleteShader(frag);
    return { ok: false, error: "着色器编译/链接失败: " + details };
  }

  // 布置全屏四边形的缓冲区(两个 VBO + 一个 IBO)。
  const posVbo = gl.createBuffer();
  const texVbo = gl.createBuffer();
  const ibo = gl.createBuffer();

  gl.bindBuffer(GL_ARRAY_BUFFER, posVbo);
  gl.bufferData(GL_ARRAY_BUFFER, FULLSCREEN_POSITIONS as unknown as BufferSource, GL_STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, "aPosition");
  if (posLoc >= 0) {
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, GL_FLOAT, false, 0, 0);
  }

  gl.bindBuffer(GL_ARRAY_BUFFER, texVbo);
  gl.bufferData(GL_ARRAY_BUFFER, FULLSCREEN_TEXCOORDS as unknown as BufferSource, GL_STATIC_DRAW);
  const texLoc = gl.getAttribLocation(program, "aTexCoord");
  if (texLoc >= 0) {
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, GL_FLOAT, false, 0, 0);
  }

  gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, FULLSCREEN_INDICES as unknown as BufferSource, GL_STATIC_DRAW);

  gl.useProgram(program);

  const uniformLocations: Record<string, unknown> = {};
  for (const name of UNIFORMS) {
    const loc = gl.getUniformLocation(program, name);
    if (loc) uniformLocations[name] = loc;
  }

  return { ok: true, handles: { program, posVbo, texVbo, ibo }, uniformLocations };
}

/** 单次完整渲染:更新视口与运行时 uniform 并绘制一帧。返回 uniform 上传快照(测试用)。 */
export function renderFrame(
  gl: ShaderStageGL,
  handles: ShaderProgramHandles,
  uniformLocations: Record<string, unknown>,
  frame: ShaderStageFrameState,
): UniformSnapshot[] {
  const width = Math.max(1, gl.drawingBufferWidth);
  const height = Math.max(1, gl.drawingBufferHeight);
  gl.viewport(0, 0, width, height);
  gl.useProgram(handles.program);
  gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, handles.ibo);

  const snapshots: UniformSnapshot[] = [];
  for (const name of UNIFORMS) {
    const loc = uniformLocations[name];
    if (!loc) continue;
    if (name === "uResolution") {
      gl.uniform2f(loc, frame.width, frame.height);
      snapshots.push({ name, kind: "2f", values: [frame.width, frame.height] });
    } else if (name === "uTime" || name === "iTime") {
      gl.uniform1f(loc, frame.time);
      snapshots.push({ name, kind: "1f", values: [frame.time] });
    } else if (name === "iTimeDelta") {
      gl.uniform1f(loc, frame.delta);
      snapshots.push({ name, kind: "1f", values: [frame.delta] });
    } else if (name === "iFrame") {
      gl.uniform1i(loc, frame.frame);
      snapshots.push({ name, kind: "1i", values: [frame.frame] });
    } else if (name === "iResolution") {
      gl.uniform3f(loc, frame.width, frame.height, 1);
      snapshots.push({ name, kind: "3f", values: [frame.width, frame.height, 1] });
    }
  }

  gl.drawElements(GL_TRIANGLES, FULLSCREEN_INDICES.length, GL_UNSIGNED_SHORT, 0);
  return snapshots;
}
