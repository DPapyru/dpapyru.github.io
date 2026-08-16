/**
 * HLSL→GLSL 300 es 转译核心(rendering feature,接缝 2)。
 *
 * 纯函数式:输入 .fx 源码字符串,输出 GLSL 300 es 顶点/片段源码字符串,
 * 零副作用、零第三方运行时依赖。
 *
 * 实现方式为**词法级改写**(独立实现,仅借鉴参考源码 gh-tml 的转译思路,未复制其代码):
 *   - 词法器(lexSource)把源码切成标识符/数字/字符串/注释/标点/空白词元,
 *     字符串与注释永不参与改写(比整串正则替换更安全);
 *   - 标识符级映射表做类型与内置函数名改写(float4→vec4、lerp→mix 等);
 *   - 手工平衡括号扫描改写函数调用(mad/rcp/log10/clip/mul/tex2D 族);
 *   - 词法级剥除语义注解/register 绑定、剔除 sampler_state 块、提升顶层自由变量为 uniform;
 *   - 顶/片段入口识别与包装:把 HLSL 像素入口转成 GLSL main(),并做像素→裁剪坐标换算。
 *
 * 公开 API(均返回 { ok, source?, vertexSource?, fragmentSource?, error? }):
 *   - translateFragmentSource(fxSource):仅片段
 *   - translateVertexSource(fxSource, { vertexEntry }):仅顶点
 *   - translateProgramSource(fxSource, { vertexEntry }):顶点 + 片段
 *   - detectFragmentEntry / detectVertexEntry:入口识别
 *   - RUNTIME_UNIFORM_LINES / RUNTIME_UNIFORM_NAMES / FALLBACK_FRAGMENT / FALLBACK_VERTEX
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

// ---------- 运行时 uniform(数据表驱动) ----------

/** 运行时会持续更新的 uniform 声明表:类型 + 名(顶点与片段都注入)。 */
const RUNTIME_UNIFORM_TABLE: ReadonlyArray<readonly [type: string, name: string]> = [
  ["vec2", "uResolution"],
  ["float", "uTime"],
  ["vec3", "iResolution"],
  ["float", "iTime"],
  ["float", "iTimeDelta"],
  ["int", "iFrame"],
  ["vec4", "iMouse"],
  ["vec4", "iDate"],
  ["float", "iChannelTime[4]"],
  ["vec3", "iChannelResolution[4]"],
  ["sampler2D", "iChannel0"],
  ["sampler2D", "iChannel1"],
  ["sampler2D", "iChannel2"],
  ["sampler2D", "iChannel3"],
];

/** 注入到转译产物的 uniform 声明行。 */
export const RUNTIME_UNIFORM_LINES: readonly string[] = RUNTIME_UNIFORM_TABLE.map(
  ([type, name]) => "uniform " + type + " " + name + ";",
);

/** 上述可注入 uniform 的名称集合:顶层同名自由变量不再被提升为 uniform。 */
export const RUNTIME_UNIFORM_NAMES: ReadonlySet<string> = new Set(
  RUNTIME_UNIFORM_TABLE.map(([, name]) => name),
);

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

// ---------- 词法层 ----------

type LexKind = "ident" | "number" | "string" | "comment" | "punct" | "space";

interface Lexeme {
  kind: LexKind;
  value: string;
}

/** 统一换行:CRLF 与 CR 都归一为 LF。 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** 把源码切成词元;字符串/注释整体为一个词元,内部永不被改写。 */
function lexSource(text: string): Lexeme[] {
  const out: Lexeme[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(text[j])) j += 1;
      out.push({ kind: "ident", value: text.slice(i, j) });
      i = j;
    } else if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(text[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z_.]/.test(text[j])) j += 1;
      out.push({ kind: "number", value: text.slice(i, j) });
      i = j;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && text[j] !== ch) {
        if (text[j] === "\\") j += 1;
        j += 1;
      }
      j = Math.min(n, j + 1);
      out.push({ kind: "string", value: text.slice(i, j) });
      i = j;
    } else if (ch === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i);
      const j = nl === -1 ? n : nl;
      out.push({ kind: "comment", value: text.slice(i, j) });
      i = j;
    } else if (ch === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      const j = close === -1 ? n : close + 2;
      out.push({ kind: "comment", value: text.slice(i, j) });
      i = j;
    } else if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j += 1;
      out.push({ kind: "space", value: text.slice(i, j) });
      i = j;
    } else {
      out.push({ kind: "punct", value: ch });
      i += 1;
    }
  }
  return out;
}

/** 词元序列拼回字符串。 */
function render(lexemes: Lexeme[]): string {
  let out = "";
  for (const l of lexemes) out += l.value;
  return out;
}

/** 只对代码段(非字符串/注释)应用改写函数,字符串与注释原样保留。 */
function rewriteCodeSegments(text: string, fn: (code: string) => string): string {
  const lexemes = lexSource(text);
  let out = "";
  let code = "";
  const flush = () => {
    if (code !== "") {
      out += fn(code);
      code = "";
    }
  };
  for (const l of lexemes) {
    if (l.kind === "string" || l.kind === "comment") {
      flush();
      out += l.value;
    } else {
      code += l.value;
    }
  }
  flush();
  return out;
}

// ---------- 标识符级改写 ----------

/** HLSL 类型 → GLSL 300 es 类型。 */
const TYPE_REWRITES: Record<string, string> = {
  // 标量
  half: "float",
  fixed: "float",
  min16float: "float",
  min10float: "float",
  min16int: "int",
  min16uint: "uint",
  // 向量
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
  // 矩阵
  float2x2: "mat2",
  half2x2: "mat2",
  fixed2x2: "mat2",
  float3x3: "mat3",
  half3x3: "mat3",
  fixed3x3: "mat3",
  float4x4: "mat4",
  half4x4: "mat4",
  fixed4x4: "mat4",
  // 采样器
  Texture2D: "sampler2D",
  sampler2D: "sampler2D",
};

/** HLSL 内置函数名 → GLSL 等价名。 */
const FN_REWRITES: Record<string, string> = {
  lerp: "mix",
  frac: "fract",
  rsqrt: "inversesqrt",
  ddx: "dFdx",
  ddy: "dFdy",
  atan2: "atan",
  fmod: "mod",
};

/** 标识符改写总表(类型 + 内置函数名)。 */
const IDENT_REWRITES: Record<string, string> = { ...TYPE_REWRITES, ...FN_REWRITES };

/** 词法级标识符改写:只在代码段内、只改整词(字符串/注释不参与)。 */
function rewriteIdentifiers(text: string): string {
  return rewriteCodeSegments(text, (code) =>
    render(
      lexSource(code).map((l) =>
        l.kind === "ident" && IDENT_REWRITES[l.value] !== undefined
          ? { ...l, value: IDENT_REWRITES[l.value] }
          : l,
      ),
    ),
  );
}

/** 由 HLSL 类型名得 GLSL 类型名(入口判型用;未知原样返回)。 */
function normalizeTypeName(typeName: string): string {
  const t = typeName.toLowerCase();
  return TYPE_REWRITES[t] ?? t;
}

// ---------- 语义注解 / 采样器声明剥除 ----------

/** HLSL 语义名:SV_* 或以大写字母开头的全大写标识符。 */
const SEMANTIC_PATTERN = /^(?:SV_[A-Za-z0-9_]+|[A-Z][A-Z0-9_]*)$/;

/** 剥除 : SV_POSITION / : COLOR0 等语义注解与 : register(..) 绑定(词法级)。 */
function stripSemanticAnnotations(text: string): string {
  return rewriteCodeSegments(text, (code) => {
    const lexemes = lexSource(code);
    const out: Lexeme[] = [];
    let i = 0;
    while (i < lexemes.length) {
      const l = lexemes[i];
      if (l.kind === "punct" && l.value === ":") {
        let j = i + 1;
        while (lexemes[j]?.kind === "space") j += 1;
        const next = lexemes[j];
        if (next?.kind === "ident" && next.value.startsWith("register")) {
          let k = j + 1;
          while (lexemes[k]?.kind === "space") k += 1;
          if (lexemes[k]?.kind === "punct" && lexemes[k].value === "(") {
            let depth = 0;
            let end = k;
            for (; end < lexemes.length; end += 1) {
              const v = lexemes[end].value;
              if (lexemes[end].kind === "punct" && (v === "(" || v === ")")) {
                if (v === "(") depth += 1;
                else {
                  depth -= 1;
                  if (depth === 0) {
                    end += 1;
                    break;
                  }
                }
              }
            }
            i = end;
            continue;
          }
        } else if (next?.kind === "ident" && SEMANTIC_PATTERN.test(next.value)) {
          i = j + 1; // 跳过 : 空格 语义名
          continue;
        }
      }
      out.push(l);
      i += 1;
    }
    return render(out);
  });
}

/** 剔除 sampler_state { ... }; 块与裸 sampler 声明(HLSL 采样器状态,GLSL 无对应物)。 */
function dropSamplerDeclarations(text: string): string {
  return rewriteCodeSegments(text, (code) => {
    const lexemes = lexSource(code);
    const out: Lexeme[] = [];
    let i = 0;
    while (i < lexemes.length) {
      const l = lexemes[i];
      if (l.kind === "ident" && l.value === "sampler_state") {
        let depth = 0;
        let sawOpen = false;
        let end = i;
        for (; end < lexemes.length; end += 1) {
          const v = lexemes[end].value;
          if (lexemes[end].kind === "punct" && v === "{") {
            depth += 1;
            sawOpen = true;
          } else if (lexemes[end].kind === "punct" && v === "}") {
            depth -= 1;
            if (sawOpen && depth === 0) {
              end += 1;
              break;
            }
          }
        }
        let k = end;
        while (lexemes[k]?.kind === "space") k += 1;
        if (lexemes[k]?.kind === "punct" && lexemes[k].value === ";") k += 1;
        i = k;
        continue;
      }
      if (l.kind === "ident" && l.value === "sampler") {
        let j = i + 1;
        while (lexemes[j]?.kind === "space") j += 1;
        if (lexemes[j]?.kind === "ident") {
          let k = j + 1;
          while (lexemes[k]?.kind === "space") k += 1;
          if (lexemes[k]?.kind === "punct" && lexemes[k].value === ";") {
            i = k + 1;
            continue;
          }
        }
      }
      out.push(l);
      i += 1;
    }
    return render(out);
  });
}

// ---------- 函数调用改写 ----------

/** 按顶层逗号切分实参(平衡 ()/[]/{} 嵌套)。 */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts.filter((p) => p !== "");
}

interface CallRule {
  /** 期望实参个数;null 表示不校验。 */
  arity: number | null;
  build(args: string[]): string | null;
  /** 改写后吞掉紧跟的 ";"(clip 语句)。 */
  eatsSemicolon?: boolean;
}

/** HLSL 特殊函数调用 → GLSL 等价形式。 */
const CALL_RULES: Record<string, CallRule> = {
  mad: {
    arity: 3,
    build: (a) => "((" + a[0] + ") * (" + a[1] + ") + (" + a[2] + "))",
  },
  rcp: {
    arity: 1,
    build: (a) => "(1.0 / (" + a[0] + "))",
  },
  log10: {
    arity: 1,
    build: (a) => "((log(" + a[0] + ") / log(10.0)))",
  },
  clip: {
    arity: 1,
    build: (a) => "if ((" + a[0] + ") < 0.0) discard;",
    eatsSemicolon: true,
  },
  mul: {
    arity: 2,
    build: (a) => "((" + a[0] + ") * (" + a[1] + "))",
  },
  tex2D: {
    arity: 2,
    build: (a) => "texture(" + a[0] + ", _flipUv(" + a[1] + "))",
  },
  tex2Dproj: {
    arity: 2,
    build: (a) => "textureProj(" + a[0] + ", _flipProj(" + a[1] + "))",
  },
  tex2Dlod: {
    arity: 2,
    build: (a) => {
      const inner = a[1].trim();
      const m = /^Vector4\s*\(([\s\S]*)\)$/.exec(inner);
      if (m) {
        const v = splitTopLevel(m[1]);
        if (v.length === 4) {
          return "textureLod(" + a[0] + ", _flipUv(vec2(" + v[0] + ", " + v[1] + ")), " + v[3] + ")";
        }
      }
      return "textureLod(" + a[0] + ", _flipUv((" + a[1] + ").xy), (" + a[1] + ").w)";
    },
  },
  tex2Dbias: {
    arity: 2,
    build: (a) => "texture(" + a[0] + ", _flipUv((" + a[1] + ").xy))",
  },
};

/** 手工平衡括号扫描 name( 调用并按规则重建(嵌套调用由第二轮扫过)。 */
function scanAndRewriteCalls(code: string): string {
  const names = Object.keys(CALL_RULES);
  let out = "";
  let i = 0;
  while (i < code.length) {
    let hit: string | null = null;
    for (const candidate of names) {
      if (
        code.startsWith(candidate, i) &&
        !/^[A-Za-z0-9_]$/.test(code[i - 1] ?? "") &&
        code[i + candidate.length] === "("
      ) {
        hit = candidate;
        break;
      }
    }
    if (hit === null) {
      out += code[i];
      i += 1;
      continue;
    }
    const rule = CALL_RULES[hit];
    const openAt = i + hit.length;
    let depth = 0;
    let closeAt = -1;
    for (let j = openAt; j < code.length; j += 1) {
      const ch = code[j];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          closeAt = j;
          break;
        }
      }
    }
    if (closeAt === -1) {
      out += code[i];
      i += 1;
      continue;
    }
    const args = splitTopLevel(code.slice(openAt + 1, closeAt));
    if (rule.arity !== null && args.length !== rule.arity) {
      out += code[i];
      i += 1;
      continue;
    }
    const rebuilt = rule.build(args);
    if (rebuilt === null) {
      out += code[i];
      i += 1;
      continue;
    }
    out += rebuilt;
    i = closeAt + 1;
    if (rule.eatsSemicolon === true) {
      let j = i;
      while (j < code.length && /\s/.test(code[j])) j += 1;
      if (code[j] === ";") i = j + 1;
    }
  }
  return out;
}

// ---------- 顶层自由变量提升 ----------

/** 可提升为 uniform 的顶层类型(改写后的 GLSL 名)。 */
const PROMOTABLE_TYPES = new Set([
  "float",
  "int",
  "uint",
  "vec2",
  "vec3",
  "vec4",
  "ivec2",
  "ivec3",
  "ivec4",
  "uvec2",
  "uvec3",
  "uvec4",
  "mat2",
  "mat3",
  "mat4",
  "sampler2D",
]);

/** 顶层 [const] <类型> <名> ; 提升为 uniform(词法级,仅深度 0;运行时同名者丢弃声明)。 */
function promoteTopLevelUniforms(text: string): string {
  return rewriteCodeSegments(text, (code) => {
    const lexemes = lexSource(code);
    const out: Lexeme[] = [];
    let depth = 0;
    let i = 0;
    while (i < lexemes.length) {
      const l = lexemes[i];
      if (l.kind === "punct" && (l.value === "{" || l.value === "}")) {
        depth += l.value === "{" ? 1 : -1;
        out.push(l);
        i += 1;
        continue;
      }
      if (depth === 0 && l.kind === "ident") {
        let j = i;
        if (lexemes[j]?.value === "const") j += 1;
        const typeTok = lexemes[j];
        if (typeTok?.kind === "ident" && PROMOTABLE_TYPES.has(typeTok.value)) {
          let k = j + 1;
          while (lexemes[k]?.kind === "space") k += 1;
          const nameTok = lexemes[k];
          if (nameTok?.kind === "ident") {
            let m = k + 1;
            while (lexemes[m]?.kind === "space") m += 1;
            if (lexemes[m]?.kind === "punct" && lexemes[m].value === ";") {
              if (!RUNTIME_UNIFORM_NAMES.has(nameTok.value)) {
                out.push({ kind: "ident", value: "uniform" });
                out.push({ kind: "space", value: " " });
                out.push(typeTok);
                out.push({ kind: "space", value: " " });
                out.push(nameTok);
              }
              i = m + 1;
              continue;
            }
          }
        }
      }
      out.push(l);
      i += 1;
    }
    return render(out);
  });
}

// ---------- technique 段剥除 ----------

/** 剥除 technique/pass 段落:从首个 technique 关键字起截断。 */
function stripTechniqueSections(text: string): string {
  const idx = text.toLowerCase().search(/\btechnique(?:10|11)?\b/);
  return idx >= 0 ? text.slice(0, idx) : text;
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

/** 顶点入口的合法返回类型(识别时校验,避免误匹配调用点)。 */
const VEC4_RETURN_TYPES = new Set(["float4", "half4", "fixed4", "vec4"]);

/** 在词法序列中查找函数签名:名字前有返回类型、后跟平衡括号;返回参数表文本。 */
function findFunctionSignature(lexemes: Lexeme[], name: string): string | null {
  for (let i = 0; i < lexemes.length; i += 1) {
    const l = lexemes[i];
    if (l.kind !== "ident" || l.value !== name) continue;

    let prev = i - 1;
    while (prev >= 0 && lexemes[prev].kind === "space") prev -= 1;
    if (prev >= 0) {
      const p = lexemes[prev];
      if (!(p.kind === "ident" && VEC4_RETURN_TYPES.has(p.value))) continue;
    }

    let j = i + 1;
    while (j < lexemes.length && lexemes[j].kind === "space") j += 1;
    if (lexemes[j]?.kind !== "punct" || lexemes[j].value !== "(") continue;

    let depth = 0;
    let text = "";
    let closed = false;
    let k = j;
    for (; k < lexemes.length; k += 1) {
      const v = lexemes[k].value;
      if (lexemes[k].kind === "punct" && (v === "(" || v === ")")) {
        if (v === "(") depth += 1;
        else {
          depth -= 1;
          if (depth === 0) {
            closed = true;
            break;
          }
        }
      }
      text += v;
    }
    if (!closed) continue;
    return text.slice(1, -1);
  }
  return null;
}

/** 在给定源码中检测顶点入口 MainVS。 */
export function detectVertexEntry(source: string, entryName = "MainVS"): VertexEntry | null {
  const lexemes = lexSource(normalizeLineEndings(source));
  const argsText = findFunctionSignature(lexemes, entryName);
  if (argsText === null) return null;
  const params = parseParams(argsText);
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

// ---------- 组装 ----------

/** 顶点/片段公共头部。 */
const STAGE_PREAMBLE = [
  "#version 300 es",
  "precision highp float;",
  "precision highp int;",
].join("\n");

/** 数学兜底辅助:saturate 与 HLSL 纹理 UV(原点在左上)适配。 */
function stageHelpers(): string {
  return [
    "float saturate(float x) { return clamp(x, 0.0, 1.0); }",
    "vec2 saturate(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }",
    "vec3 saturate(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }",
    "vec4 saturate(vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }",
    "vec2 _flipUv(vec2 uv) { return vec2(uv.x, 1.0 - uv.y); }",
    "vec4 _flipProj(vec4 uvzw) { return vec4(uvzw.x, uvzw.w - uvzw.y, uvzw.z, uvzw.w); }",
    "",
  ].join("\n");
}

/** 入口参数占位名 → 片段 main 局部变量名(字面量直接透传)。 */
const ARGUMENT_MAP: Record<string, string> = {
  uv: "uv",
  fragCoord: "fragCoord",
  vertexColor: "vertexColor",
  outColor: "outColor",
};

function mapCallArg(arg: string): string {
  return ARGUMENT_MAP[arg] ?? arg;
}

/** 组装片段 main():像素坐标换算 + 入口调用(返回/输出两种形态)。 */
function buildFragmentMain(
  entryName: string,
  kind: "out" | "return",
  args: string[],
  vertexColorVarying: boolean,
): string {
  const call = entryName + "(" + args.join(", ") + ")";
  const lines = [
    "void main() {",
    "  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);",
    "  vec2 fragCoord = uv * iResolution.xy;",
    "  vec4 vertexColor = " + (vertexColorVarying ? "vColor;" : "vec4(1.0);"),
  ];
  if (kind === "out") {
    lines.push("  vec4 outColor = vec4(0.0);");
    lines.push("  " + call + ";");
    lines.push("  fragColor = outColor;");
  } else {
    lines.push("  fragColor = " + call + ";");
  }
  lines.push("}");
  return lines.join("\n");
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
  const args = entry.callArgs.map(mapCallArg);

  const parts = [
    STAGE_PREAMBLE,
    "",
    "in vec2 vUv;",
    opts.vertexColorVarying === true ? "in vec4 vColor;" : "",
    "out vec4 fragColor;",
    "",
    RUNTIME_UNIFORM_LINES.join("\n"),
    "",
    stageHelpers(),
    "#line 1",
    transformed,
    "",
    buildFragmentMain(entry.name, entry.kind, args, opts.vertexColorVarying === true),
    "",
  ];
  return { ok: true, source: parts.join("\n") };
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
  const args = entry.callArgs.map((arg) => {
    if (arg === "position") return "position";
    if (arg === "texCoord") return "texCoord";
    if (arg === "vertexColor") return "vertexColorIn";
    return arg; // vec4(1.0) 字面量
  });

  const parts = [
    STAGE_PREAMBLE,
    "",
    "layout(location = 0) in vec3 aPosition;",
    "layout(location = 1) in vec4 aColor;",
    "layout(location = 2) in vec2 aTexCoord;",
    "",
    "out vec4 vColor;",
    "out vec2 vUv;",
    "",
    RUNTIME_UNIFORM_LINES.join("\n"),
    "",
    "#line 1",
    transformed,
    "",
    "void main() {",
    "  vec3 position = aPosition;",
    "  vec4 vertexColorIn = aColor;",
    "  vec2 texCoord = aTexCoord;",
    "  vec4 vsOut = " + entry.name + "(" + args.join(", ") + ");",
    "  vec2 pixelPos = vsOut.xy;",
    "  vec2 safe = max(uResolution.xy, vec2(1.0));",
    "  vec2 clip = vec2((pixelPos.x / safe.x) * 2.0 - 1.0, 1.0 - (pixelPos.y / safe.y) * 2.0);",
    "  gl_Position = vec4(clip, vsOut.z, 1.0);",
    "  vColor = vertexColorIn;",
    "  vUv = vec2(texCoord.x, 1.0 - texCoord.y);",
    "}",
    "",
  ];
  return { ok: true, source: parts.join("\n") };
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

/** 转译主流程(顺序敏感):技术段剥除 → 语义/register 剥除 → 采样器剔除 → 标识符改写 → 调用改写(两轮,覆盖嵌套)→ 顶层提升。 */
function transformSource(raw: string): string {
  let out = stripTechniqueSections(raw);
  out = stripSemanticAnnotations(out);
  out = dropSamplerDeclarations(out);
  out = rewriteIdentifiers(out);
  out = rewriteCodeSegments(out, scanAndRewriteCalls);
  out = rewriteCodeSegments(out, scanAndRewriteCalls);
  out = promoteTopLevelUniforms(out);
  return out;
}
