/**
 * HLSL→GLSL 300es 转译核心(rendering feature,接缝 2)。
 *
 * 纯函数式:输入 .fx 源码字符串,输出 GLSL 300 es 顶点/片段源码字符串,
 * 零副作用、零第三方运行时依赖。转译思路(借鉴参考源码、重写实现):
 *   1. 剥离 technique/pass 段落与 register 绑定/语义冒号标注;
 *   2. 类型改写:float4→vec4、half/fixed→float、float4x4→mat4、sampler 映射等;
 *   3. 内置函数改写:lerp→mix、frac→fract、tex2D→texture、mul→乘法等;
 *   4. 运行 uniform 注入:iTime/iResolution/iChannel0-3 等,供渲染运行时持续更新;
 *   5. 顶/片段入口识别与包装:把 HLSL 像素入口转成 GLSL main(),并做像素→裁剪坐标换算。
 *
 * 公开 API(均返回 { ok, source?, vertexSource?, fragmentSource?, error? }):
 *   - translateFragmentSource(fxSource):仅片段
 *   - translateVertexSource(fxSource, { vertexEntry }):仅顶点
 *   - translateProgramSource(fxSource, { vertexEntry }):顶点 + 片段
 */

export interface TranslateError {
  ok: false;
  error: string;
}

export interface FragmentTranslateOk {
  ok: true;
  source: string;
}

export interface VertexTranslateOk {
  ok: true;
  source: string;
}

export interface ProgramTranslateOk {
  ok: true;
  vertexSource: string;
  fragmentSource: string;
}

export type FragmentResult = TranslateError | FragmentTranslateOk;
export type VertexResult = TranslateError | VertexTranslateOk;
export type ProgramResult = TranslateError | ProgramTranslateOk;

/** 运行时会持续更新的 uniform 声明(injected to both vertex & fragment)。 */
export const RUNTIME_UNIFORM_LINES = [
  "uniform vec2 uResolution;",
  "uniform float uTime;",
  "uniform vec3 iResolution;",
  "uniform float iTime;",
  "uniform float iTimeDelta;",
  "uniform int iFrame;",
  "uniform vec4 iMouse;",
  "uniform vec4 iDate;",
  "uniform float iChannelTime[4];",
  "uniform vec3 iChannelResolution[4];",
  "uniform sampler2D iChannel0;",
  "uniform sampler2D iChannel1;",
  "uniform sampler2D iChannel2;",
  "uniform sampler2D iChannel3;",
] as const;

/** 上述可注入 uniform 的名称集合,顶层同名自由变量不再被提升为 uniform。 */
export const RUNTIME_UNIFORM_NAMES = new Set<string>([
  "uResolution",
  "uTime",
  "iResolution",
  "iTime",
  "iTimeDelta",
  "iFrame",
  "iMouse",
  "iDate",
  "iChannelTime",
  "iChannelResolution",
  "iChannel0",
  "iChannel1",
  "iChannel2",
  "iChannel3",
]);

/** 兜底的可编译全屏片段(错误提示帧等场景)。 */
export const FALLBACK_FRAGMENT = [
  "#version 300 es",
  "precision highp float;",
  "out vec4 fragColor;",
  "void main() { fragColor = vec4(0.02, 0.02, 0.05, 1.0); }",
].join("\n");

/** 兜底的可编译顶点(全屏三角)。 */
export const FALLBACK_VERTEX = [
  "#version 300 es",
  "precision highp float;",
  "layout(location = 0) in vec3 aPosition;",
  "layout(location = 2) in vec2 aTexCoord;",
  "out vec2 vUv;",
  "void main() { gl_Position = vec4(aPosition, 1.0); vUv = aTexCoord; }",
].join("\n");

// ---------- 低层字符串工具 ----------

function normalizeLineEndings(text: string): string {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function escapeRegExp(text: string): string {
  return String(text ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 全词替换(避免误伤前缀匹配)。 */
function replaceWord(text: string, from: string, to: string): string {
  const pattern = new RegExp("\\b" + escapeRegExp(from) + "\\b", "g");
  return String(text ?? "").replace(pattern, to);
}

// ---------- 类型改写 ----------

const SCALAR_TYPE_MAP: Record<string, string> = {
  float: "float",
  half: "float",
  fixed: "float",
  min16float: "float",
  min10float: "float",
  int: "int",
  uint: "uint",
  min16int: "int",
  min16uint: "uint",
  bool: "bool",
};

const VECTOR_TYPE_MAP: Record<string, string> = {
  float2: "vec2",
  half2: "vec2",
  fixed2: "vec2",
  float3: "vec3",
  half3: "vec3",
  fixed3: "vec3",
  float4: "vec4",
  half4: "vec4",
  fixed4: "vec4",
  int2: "ivec2",
  int3: "ivec3",
  int4: "ivec4",
  uint2: "uvec2",
  uint3: "uvec3",
  uint4: "uvec4",
  bool2: "bvec2",
  bool3: "bvec3",
  bool4: "bvec4",
};

const MATRIX_TYPE_MAP: Record<string, string> = {
  float2x2: "mat2",
  half2x2: "mat2",
  fixed2x2: "mat2",
  float3x3: "mat3",
  half3x3: "mat3",
  fixed3x3: "mat3",
  float4x4: "mat4",
  half4x4: "mat4",
  fixed4x4: "mat4",
};

const SAMPLER_TYPE_MAP: Record<string, string> = {
  sampler2D: "sampler2D",
  Texture2D: "sampler2D",
};

/** 把所有 HLSL 类型关键词改写为 GLSL 300 es 类型。 */
function rewriteTypes(text: string): string {
  let out = text;
  for (const [from, to] of Object.entries(SCALAR_TYPE_MAP)) {
    if (from !== to) out = replaceWord(out, from, to);
  }
  for (const [from, to] of Object.entries(VECTOR_TYPE_MAP)) {
    out = replaceWord(out, from, to);
  }
  for (const [from, to] of Object.entries(MATRIX_TYPE_MAP)) {
    out = replaceWord(out, from, to);
  }
  for (const [from, to] of Object.entries(SAMPLER_TYPE_MAP)) {
    if (from !== to) out = replaceWord(out, from, to);
  }
  // sampler_state { ... } 采样器状态块整体剔除。
  out = out.replace(/\bsampler\s+[A-Za-z_]\w*\s*;\s*/g, "");
  return out;
}

// ---------- 内置函数/语法改写 ----------

/** HLSL 内置函数名映射到 GLSL 等价函数。 */
function rewriteBuiltinNames(text: string): string {
  let out = text;
  const simple: Record<string, string> = {
    lerp: "mix",
    frac: "fract",
    rsqrt: "inversesqrt",
    ddx: "dFdx",
    ddy: "dFdy",
    atan2: "atan",
    fmod: "mod",
  };
  for (const [from, to] of Object.entries(simple)) {
    out = replaceWord(out, from, to);
  }
  // mad(a,b,c) → (a*b + c);rcp(x) → (1.0/x);log10 → (log/log10);clip → discard。
  out = out.replace(/\bmad\s*\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g, "((\$1) * (\$2) + (\$3))");
  out = out.replace(/\brcp\s*\(\s*([^()]+?)\s*\)/g, "(1.0 / (\$1))");
  out = out.replace(/\blog10\s*\(\s*([^()]+?)\s*\)/g, "((log(\$1) / log(10.0)))");
  out = out.replace(/\bclip\s*\(\s*([^)]+?)\s*\)\s*;/g, "if ((\$1) < 0.0) discard;");
  // mul(a, b) → (a * b)。GLSL 矩阵乘方向与 HLSL 相反,这里做最常用的透传近似。
  out = out.replace(/\bmul\s*\(([^,]+?)\s*,\s*([^)]+?)\)/g, "((\$1) * (\$2))");
  return out;
}

/** tex2D 采样族改写为 texture/textureLod 等,并处理 UV 翻转(coordinate flip)。 */
function rewriteTextureCalls(text: string): string {
  let out = text;
  // tex2D(tex, uv)
  out = out.replace(
    /\btex2D\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g,
    "texture(\$1, _shaderFlipUv(\$2))",
  );
  // tex2Dproj(tex, pw) → textureProj
  out = out.replace(
    /\btex2Dproj\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g,
    "textureProj(\$1, _shaderFlipProj(\$2))",
  );
  // tex2Dlod(tex, float4(u,v,lod,lod2)) → textureLod(tex, uv, lod)
  out = out.replace(
    /\btex2Dlod\s*\(\s*([^,]+?)\s*,\s*Vector4\s*\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)\s*\)/g,
    "textureLod(\$1, _shaderFlipUv(vec2(\$2, \$3)), \$5)",
  );
  // tex2Dlod(tex, r) general → textureLod(tex, uv, r.w)
  out = out.replace(
    /\btex2Dlod\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g,
    "textureLod(\$1, _shaderFlipUv((\$2).xy), (\$2).w)",
  );
  // tex2Dbias(tex, r) → texture(tex, uv)
  out = out.replace(
    /\btex2Dbias\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g,
    "texture(\$1, _shaderFlipUv((\$2).xy))",
  );
  return out;
}

// ---------- 语法剥除 ----------

/** 剥除 technique/pass 段落:从首个 technique 关键字起截断。 */
function stripTechniqueSections(text: string): string {
  const lower = text.toLowerCase();
  const idx = lower.search(/\btechnique(?:10|11)?\b/);
  return idx >= 0 ? text.slice(0, idx) : text;
}

/** 剥除 HLSL 语义注解(: SV_POSITION / : COLOR0 等)与 register 绑定。 */
function stripSemanticAnnotations(text: string): string {
  let out = text;
  out = out.replace(/\s*:\s*(?:SV_[A-Za-z0-9_]+|[A-Z][A-Z0-9_]*)\b/g, "");
  out = out.replace(/\s*:\s*register\s*\(\s*[A-Za-z]\d+\s*\)\s*/g, " ");
  out = out.replace(/\bsampler_state\s*[A-Za-z_]*\s*\{[\s\S]*?\}\s*;/g, "");
  return out;
}

/** 把顶层无统一声明的自由变量提升为 uniform(供运行时以 uniform 写入)。 */
function promoteTopLevelUniforms(text: string): string {
  const lines = normalizeLineEndings(text).split("\n");
  const out: string[] = [];
  let scopeDepth = 0;
  const declRe =
    /^\s*(?:const\s+)?(float|int|uint|vec2|vec3|vec4|ivec2|ivec3|ivec4|uvec2|uvec3|uvec4|mat2|mat3|mat4|sampler2D)\s+([A-Za-z_]\w*)\s*;\s*$/;

  for (const line of lines) {
    if (scopeDepth === 0) {
      const decl = line.match(declRe);
      if (decl) {
        const typeName = decl[1];
        const varName = decl[2];
        if (!RUNTIME_UNIFORM_NAMES.has(varName)) {
          out.push(`uniform ${typeName} ${varName};`);
        }
        continue;
      }
    }
    out.push(line);
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    scopeDepth = Math.max(0, scopeDepth + opens - closes);
  }
  return out.join("\n");
}

// ---------- 入口识别 ----------

export interface FragmentEntry {
  kind: "out" | "return";
  name: string;
  callArgs: string[];
}

export interface VertexEntry {
  name: string;
  callArgs: string[];
}

interface ParamInfo {
  type: string;
  name: string;
  semantic: string;
}

const VEC2_TYPES = new Set(["vec2", "ivec2", "uvec2"]);
const VEC3_TYPES = new Set(["vec3", "ivec3", "uvec3"]);
const VEC4_TYPES = new Set(["vec4", "ivec4", "uvec4"]);

/** 解析参数列表文本,返回参数信息;无法解析返回 null。 */
function parseParams(paramListText: string | undefined): ParamInfo[] | null {
  const raw = String(paramListText ?? "").trim();
  if (!raw) return [];
  const chunks = raw.split(",");
  const params: ParamInfo[] = [];

  for (const chunk of chunks) {
    let text = chunk.trim();
    if (!text) continue;

    let semantic = "";
    const semMatch = text.match(/:\s*(SV_[A-Za-z0-9_]+|[A-Z][A-Z0-9_]*)\s*$/);
    if (semMatch) {
      semantic = semMatch[1];
      text = text.slice(0, semMatch.index).trim();
    }
    // 剥除 in/out/inout/const/uniform 限定符。
    text = text
      .replace(/\b(?:inout|in|out|const|uniform)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const m = text.match(/^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)$/);
    if (!m) return null;
    params.push({ type: normalizeTypeName(m[1]), name: m[2], semantic });
  }
  return params;
}

/** 由参数推断坐标参数:TexCoord→uv、含 fragcoord→fragCoord,否则 uv。 */
function inferCoordArg(name: string, semantic: string): string {
  const sem = String(semantic ?? "").toUpperCase();
  const lower = String(name ?? "").toLowerCase();
  if (/TEXCOORD/.test(sem)) return "uv";
  if (lower.includes("fragcoord")) return "fragCoord";
  if (lower === "uv" || lower.includes("tex") || lower.includes("coord")) return "uv";
  return "fragCoord";
}

/** 把单个 HLSL 类型名改写为 GLSL 类型名(供入口判型使用)。 */
function normalizeTypeName(typeName: string): string {
  const t = String(typeName ?? "").toLowerCase();
  if (SCALAR_TYPE_MAP[t]) return SCALAR_TYPE_MAP[t];
  if (VECTOR_TYPE_MAP[t]) return VECTOR_TYPE_MAP[t];
  if (MATRIX_TYPE_MAP[t]) return MATRIX_TYPE_MAP[t];
  if (SAMPLER_TYPE_MAP[t]) return SAMPLER_TYPE_MAP[t];
  return t;
}

/** 判定可用于像素入口的参数调用实参序列;无法支持返回 null。 */
function buildFragmentCallArgs(params: ParamInfo[]): string[] | null {
  const args: string[] = [];
  let vec2Count = 0;
  for (const p of params) {
    if (VEC2_TYPES.has(p.type)) {
      vec2Count += 1;
      args.push(inferCoordArg(p.name, p.semantic));
      continue;
    }
    if (VEC4_TYPES.has(p.type)) {
      if (/COLOR/i.test(p.semantic) || /color/i.test(p.name)) args.push("vertexColor");
      else args.push("vec4(1.0)");
      continue;
    }
    return null;
  }
  return vec2Count === 0 ? null : args;
}

/** 在给定源码中检测像素入口,返回入口信息;找不到返回 null。 */
export function detectFragmentEntry(source: string): FragmentEntry | null {
  const normalized = normalizeLineEndings(source);

  // 形式 1:void mainImage(out float4 fragColor, float2 fragCoord)
  const outMatch = normalized.match(
    /\bvoid\s+mainImage\s*\(\s*out\s+(?:float4|half4|fixed4)\s+([A-Za-z_]\w*)\s*,\s*(?:float2|half2|fixed2)\s+([A-Za-z_]\w*)\s*\)/,
  );
  if (outMatch) {
    return {
      kind: "out",
      name: "mainImage",
      callArgs: ["outColor", inferCoordArg(outMatch[2], "")],
    };
  }

  // 形式 2:float4 MainPS(float2 texCoord : TEXCOORD0) : COLOR0
  const fnRe =
    /\b(?:float4|half4|fixed4)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?::\s*(SV_[A-Za-z0-9_]+|COLOR0|COLOR))?/g;
  let match: RegExpExecArray | null;
  let best: FragmentEntry | null = null;
  let bestScore = -1;

  while ((match = fnRe.exec(normalized)) !== null) {
    const params = parseParams(match[2]);
    if (!params || params.length === 0) continue;
    const callArgs = buildFragmentCallArgs(params);
    if (!callArgs) continue;

    const name = match[1];
    const lower = name.toLowerCase();
    let score = 0;
    if (name === "mainImage") score += 100;
    if (/(?:mainps|pixel|ps|fragment|main)/.test(lower)) score += 40;
    if (match[3]) score += 20;
    if (params.some((p) => /TEXCOORD/i.test(p.semantic))) score += 15;
    if (params.filter((p) => VEC2_TYPES.has(p.type)).length === 1) score += 5;

    if (score > bestScore) {
      bestScore = score;
      best = { kind: "return", name, callArgs };
    }
  }
  return best;
}

/** 在给定源码中检测顶点入口 MainVS。 */
export function detectVertexEntry(source: string, entryName = "MainVS"): VertexEntry | null {
  const normalized = normalizeLineEndings(source);
  const fnRe = new RegExp(
    "\\b(?:float4|half4|fixed4|vec4)\\s+" + escapeRegExp(entryName) + "\\s*\\(([^)]*)\\)\\s*(?::\\s*(SV_[A-Za-z0-9_]+|POSITION0|POSITION))?",
    "i",
  );
  const match = normalized.match(fnRe);
  if (!match) return null;
  const params = parseParams(match[1]);
  if (!params || params.length === 0) return null;

  const callArgs: string[] = [];
  for (const p of params) {
    if (VEC3_TYPES.has(p.type)) callArgs.push("position");
    else if (VEC2_TYPES.has(p.type)) callArgs.push("texCoord");
    else if (VEC4_TYPES.has(p.type)) {
      if (/COLOR/i.test(p.semantic) || /color/i.test(p.name)) callArgs.push("vertexColor");
      else callArgs.push("vec4(1.0)");
    } else return null;
  }
  return { name: entryName, callArgs };
}

// ---------- 片段/顶点组装 ----------

function shaderPrelude(options: { vertexColorVarying: boolean }): string {
  return [
    "#version 300 es",
    "precision highp float;",
    "precision highp int;",
    "",
    "in vec2 vUv;",
    options.vertexColorVarying ? "in vec4 vColor;" : "",
    "out vec4 fragColor;",
    "",
    ...RUNTIME_UNIFORM_LINES,
    "",
    "float saturate(float x) { return clamp(x, 0.0, 1.0); }",
    "vec2 saturate(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }",
    "vec3 saturate(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }",
    "vec4 saturate(vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }",
    "vec2 _shaderFlipUv(vec2 uv) { return vec2(uv.x, 1.0 - uv.y); }",
    "vec4 _shaderFlipProj(vec4 uvzw) { return vec4(uvzw.x, uvzw.w - uvzw.y, uvzw.z, uvzw.w); }",
    "",
  ].join("\n");
}

const FRAGMENT_CONTEXT = {
  uvName: "uv",
  fragCoordName: "fragCoord",
  vertexColorName: "vertexColor",
  outColorName: "outColor",
};

function mapCallArg(arg: string, ctx: typeof FRAGMENT_CONTEXT): string | null {
  switch (arg) {
    case "uv":
      return ctx.uvName;
    case "fragCoord":
      return ctx.fragCoordName;
    case "vertexColor":
      return ctx.vertexColorName;
    case "outColor":
      return ctx.outColorName;
    default:
      return arg; // 字面量 vec4(1.0) 等直接透传。
  }
}

/** 把 HLSL 片段转译为 GLSL 300 es 片段源码。 */
export function translateFragmentSource(
  fxSource: string,
  options: { vertexColorVarying?: boolean } = {},
): FragmentResult {
  const opts = options ?? {};
  const raw = normalizeLineEndings(fxSource);
  const entry = detectFragmentEntry(raw);
  if (!entry) {
    return {
      ok: false,
      error:
        "未找到可用的像素入口。支持 void mainImage(out float4 fragColor, float2 fragCoord),或 float4 MainPS(float2 texCoord : TEXCOORD0) : COLOR0。",
    };
  }

  const transformed = transformSource(raw);

  const mappedArgs = entry.callArgs.map((arg) => mapCallArg(arg, FRAGMENT_CONTEXT));
  if (mappedArgs.some((a) => a === null)) {
    return { ok: false, error: "入口函数参数暂不支持。" };
  }

  const glue = [
    "void main() {",
    "    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);",
    "    vec2 fragCoord = uv * iResolution.xy;",
    opts.vertexColorVarying ? "    vec4 vertexColor = vColor;" : "    vec4 vertexColor = vec4(1.0);",
  ];

  if (entry.kind === "out") {
    glue.push("    vec4 outColor = vec4(0.0);");
    glue.push("    " + entry.name + "(" + mappedArgs.join(", ") + ");");
    glue.push("    fragColor = outColor;");
  } else {
    glue.push("    fragColor = " + entry.name + "(" + mappedArgs.join(", ") + ");");
  }
  glue.push("}");

  const prelude = shaderPrelude({ vertexColorVarying: opts.vertexColorVarying === true });
  return {
    ok: true,
    source: prelude + "\n#line 1\n" + transformed + "\n\n" + glue.join("\n") + "\n",
  };
}

/** 把 HLSL 顶点转译为 GLSL 300 es 顶点源码,并把像素位置换算为裁剪坐标。 */
export function translateVertexSource(
  fxSource: string,
  options: { vertexEntry?: string } = {},
): VertexResult {
  const opts = options ?? {};
  const entryName = String(opts.vertexEntry ?? "MainVS").trim() || "MainVS";
  const body = stripTechniqueSections(normalizeLineEndings(fxSource));
  const entry = detectVertexEntry(body, entryName);
  if (!entry) {
    return {
      ok: false,
      error: "未找到可用的顶点入口。需要 " + entryName + "(...) 且返回 float4。",
    };
  }

  const transformed = transformSource(body);

  const mappedArgs = entry.callArgs.map((arg) => {
    if (arg === "position") return "position";
    if (arg === "texCoord") return "texCoord";
    if (arg === "vertexColor") return "vertexColorIn";
    if (arg === "vec4(1.0)") return "vec4(1.0)";
    return null;
  });
  if (mappedArgs.some((a) => a === null)) {
    return { ok: false, error: "顶点入口参数暂不支持。" };
  }

  const header = [
    "#version 300 es",
    "precision highp float;",
    "precision highp int;",
    "",
    "layout(location = 0) in vec3 aPosition;",
    "layout(location = 1) in vec4 aColor;",
    "layout(location = 2) in vec2 aTexCoord;",
    "",
    "out vec4 vColor;",
    "out vec2 vUv;",
    "",
    ...RUNTIME_UNIFORM_LINES,
    "",
    "#line 1",
    transformed,
    "",
    "void main() {",
    "    vec3 position = aPosition;",
    "    vec4 vertexColorIn = aColor;",
    "    vec2 texCoord = aTexCoord;",
    "    vec4 vsOut = " + entry.name + "(" + mappedArgs.join(", ") + ");",
    "    vec2 pixelPos = vsOut.xy;",
    "    vec2 safe = max(uResolution.xy, vec2(1.0));",
    "    vec2 clip = vec2((pixelPos.x / safe.x) * 2.0 - 1.0, 1.0 - (pixelPos.y / safe.y) * 2.0);",
    "    gl_Position = vec4(clip, vsOut.z, 1.0);",
    "    vColor = vertexColorIn;",
    "    vUv = vec2(texCoord.x, 1.0 - texCoord.y);",
    "}",
    "",
  ].join("\n");

  return { ok: true, source: header };
}

/** 完整程序转译:顶点 + 片段。 */
export function translateProgramSource(
  fxSource: string,
  options: { vertexEntry?: string } = {},
): ProgramResult {
  const opts = options ?? {};
  const body = stripTechniqueSections(normalizeLineEndings(fxSource));

  const vertex = translateVertexSource(body, { vertexEntry: opts.vertexEntry });
  if (!vertex.ok) return vertex;

  const fragment = translateFragmentSource(body, { vertexColorVarying: true });
  if (!fragment.ok) return fragment;

  return { ok: true, vertexSource: vertex.source, fragmentSource: fragment.source };
}

/** 对源码实施全部改写步骤(顺序敏感)。 */
function transformSource(raw: string): string {
  let out = stripTechniqueSections(raw);
  out = stripSemanticAnnotations(out);
  out = rewriteTypes(out);
  out = rewriteBuiltinNames(out);
  out = rewriteTextureCalls(out);
  out = promoteTopLevelUniforms(out);
  return out;
}
