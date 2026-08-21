/**
 * check-shaders.ts — 真实 WebGL2 编译冒烟闸(shader 素材回归守卫)。
 *
 * 背景:单元测试里的 GL mock 从不真正编译 GLSL,135/135 全绿也可能带着
 * 「片段编译失败」的运行时 bug 上线(参见 ERRORS.md 的 HLSL 标量→向量广播问题)。
 * 本脚本用真实 headless Chrome 的 canvas.getContext('webgl2') 编译链接全部
 * shader 素材(HLSL 先经 hlslToGLSL 转译),任一编译/链接失败即 exit 1。
 *
 * 覆盖素材:
 *   - src/assets/demos/*.fx(HLSL → translateFragmentSource 后编译)
 *   - fnaFixture.FNA_FX_SOURCE(HLSL → translateFragmentSource 后编译)
 *   - hlslToGLSL.FALLBACK_FRAGMENT / FALLBACK_VERTEX(已是 GLSL,直接编译)
 * 每个片段都与运行时的 FULLSCREEN_VERTEX 配对编译链接;另加
 * FALLBACK_VERTEX+FALLBACK_FRAGMENT 程序以覆盖兜底顶点自身。
 *
 * 用法:bun scripts/check-shaders.ts(或 package.json 的 check:shaders)。
 */
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { translateFragmentSource, FALLBACK_FRAGMENT, FALLBACK_VERTEX } from "../src/features/rendering/hlslToGLSL";
import {
  FULLSCREEN_VERTEX,
  FULLSCREEN_POSITIONS,
  FULLSCREEN_TEXCOORDS,
  FULLSCREEN_INDICES,
} from "../src/features/rendering/shaders/shaderStageRuntime";
import { FNA_FX_SOURCE } from "../src/features/rendering/demos/fnaFixture";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, ".tmp", "e2e");

/** 收集全部 HLSL 片段素材(name → fx 源码)。 */
function collectHlslFragments(): Array<{ name: string; fx: string }> {
  const items: Array<{ name: string; fx: string }> = [];
  const demosDir = join(ROOT, "src", "assets", "demos");
  const fxFiles = readdirSync(demosDir).filter((f) => f.endsWith(".fx")).sort();
  if (fxFiles.length === 0) {
    console.error("check-shaders: src/assets/demos/ 下未找到任何 *.fx 素材");
    process.exit(1);
  }
  for (const f of fxFiles) {
    items.push({ name: f, fx: readFileSync(join(demosDir, f), "utf8") });
  }
  items.push({ name: "fnaFixture.FNA_FX_SOURCE", fx: FNA_FX_SOURCE });
  return items;
}

interface ProgramSpec {
  name: string;
  vs: string;
  fs: string;
}

/** 把字符串嵌入 <script> 的 JS 字符串字面量(转义 < 防止 </script> 截断)。 */
function jsStr(s: string): string {
  return JSON.stringify(s).replace(/</g, "\\u003c");
}

/** 生成自包含的 WebGL2 编译 HTML(内嵌全部程序,状态写入 <pre id="out">)。 */
function buildHtml(programs: ProgramSpec[], pos: Float32Array, uv: Float32Array, idx: Uint16Array): string {
  const lines: string[] = [];
  lines.push("<!DOCTYPE html>");
  lines.push("<html><head><meta charset=\"utf-8\"><title>check-shaders</title></head><body>");
  lines.push("<canvas id=\"c\" width=\"320\" height=\"180\"></canvas>");
  lines.push("<pre id=\"out\">RUNNING</pre>");
  lines.push("<script>");
  lines.push("const log = (s) => { document.getElementById('out').textContent += '\\n' + s; };");
  lines.push("const PROGRAMS = " + JSON.stringify(programs.map((p) => ({ name: p.name, vs: p.vs, fs: p.fs }))) + ";");
  lines.push("const POS = new Float32Array(" + JSON.stringify(Array.from(pos)) + ");");
  lines.push("const UV = new Float32Array(" + JSON.stringify(Array.from(uv)) + ");");
  lines.push("const IDX = new Uint16Array(" + JSON.stringify(Array.from(idx)) + ");");
  lines.push("const W = 320, H = 180;");
  lines.push("function main() {");
  lines.push("  const canvas = document.getElementById('c');");
  lines.push("  const gl = canvas.getContext('webgl2');");
  lines.push("  if (!gl) { log('NO WEBGL2 CONTEXT'); return; }");
  lines.push("  log('WEBGL2 OK: ' + gl.getParameter(gl.VERSION) + ' renderer=' + gl.getParameter(gl.RENDERER));");
  lines.push("  const compile = (type, src, label) => {");
  lines.push("    const sh = gl.createShader(type);");
  lines.push("    if (!sh) { log(label + ': createShader returned null'); return null; }");
  lines.push("    gl.shaderSource(sh, src);");
  lines.push("    gl.compileShader(sh);");
  lines.push("    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {");
  lines.push("      log(label + ' COMPILE FAILED:\\n' + (gl.getShaderInfoLog(sh) || '(no info log)'));");
  lines.push("      gl.deleteShader(sh);");
  lines.push("      return null;");
  lines.push("    }");
  lines.push("    log(label + ' compiled OK');");
  lines.push("    return sh;");
  lines.push("  };");
  lines.push("  for (const p of PROGRAMS) {");
  lines.push("    log('===== ' + p.name + ' =====');");
  lines.push("    const vs = compile(gl.VERTEX_SHADER, p.vs, 'VERTEX[' + p.name + ']');");
  lines.push("    const fs = compile(gl.FRAGMENT_SHADER, p.fs, 'FRAGMENT[' + p.name + ']');");
  lines.push("    const prog = gl.createProgram();");
  lines.push("    if (vs) gl.attachShader(prog, vs);");
  lines.push("    if (fs) gl.attachShader(prog, fs);");
  lines.push("    gl.linkProgram(prog);");
  lines.push("    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {");
  lines.push("      log('LINK FAILED[' + p.name + ']: ' + (gl.getProgramInfoLog(prog) || '(no info log)'));");
  lines.push("    } else {");
  lines.push("      log('LINK OK[' + p.name + ']');");
  lines.push("      const posVbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posVbo); gl.bufferData(gl.ARRAY_BUFFER, POS, gl.STATIC_DRAW);");
  lines.push("      const posLoc = gl.getAttribLocation(prog, 'aPosition'); gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);");
  lines.push("      const texVbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, texVbo); gl.bufferData(gl.ARRAY_BUFFER, UV, gl.STATIC_DRAW);");
  lines.push("      const texLoc = gl.getAttribLocation(prog, 'aTexCoord'); gl.enableVertexAttribArray(texLoc); gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);");
  lines.push("      const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, IDX, gl.STATIC_DRAW);");
  lines.push("      gl.useProgram(prog);");
  lines.push("      const setU = (prog, n, fn) => { const l = gl.getUniformLocation(prog, n); if (l) fn(l); };");
  lines.push("      setU(prog, 'uResolution', l => gl.uniform2f(l, W, H));");
  lines.push("      setU(prog, 'iResolution', l => gl.uniform3f(l, W, H, 1));");
  lines.push("      setU(prog, 'iTime', l => gl.uniform1f(l, 1.0));");
  lines.push("      setU(prog, 'uTime', l => gl.uniform1f(l, 1.0));");
  lines.push("      setU(prog, 'iFrame', l => gl.uniform1i(l, 1));");
  lines.push("      setU(prog, 'iTimeDelta', l => gl.uniform1f(l, 0.016));");
  lines.push("      gl.viewport(0, 0, W, H);");
  lines.push("      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);");
  lines.push("      gl.drawElements(gl.TRIANGLES, IDX.length, gl.UNSIGNED_SHORT, 0);");
  lines.push("      const buf = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);");
  lines.push("      const sample = (buf, x, y) => { const i = (y * W + x) * 4; return buf[i] + ',' + buf[i+1] + ',' + buf[i+2]; };");
  lines.push("      log('PIX[' + p.name + '] BL=' + sample(buf, 8, 8) + ' BR=' + sample(buf, W - 9, 8) + ' TL=' + sample(buf, 8, H - 9) + ' TR=' + sample(buf, W - 9, H - 9) + ' C=' + sample(buf, W >> 1, H >> 1) + ' RM=' + sample(buf, W - 9, H >> 1));");
  lines.push("    }");
  lines.push("  }");
  lines.push("}");
  lines.push("try { main(); } catch (e) { log('EXCEPTION: ' + e.message); }");
  lines.push("</script></body></html>");
  return lines.join("\n");
}

/** 定位本机可用的无头 Chrome。 */
function findChrome(): string | null {
  for (const c of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const r = spawnSync("which", [c], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

/** 从 --dump-dom 输出中抽取 <pre id="out"> 文本。 */
function extractOut(dom: string): string {
  const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
  return m ? m[1] : "";
}

/** 解析 "PIX[name] BL=r,g,b BR=... TL=... TR=... C=... RM=..." 行(按行前缀匹配)。 */
function parsePix(out: string, name: string): Record<string, [number, number, number]> | null {
  const prefix = "PIX[" + name + "] ";
  const line = out.split("\n").find((l) => l.startsWith(prefix));
  if (!line) return null;
  const res: Record<string, [number, number, number]> = {};
  for (const pair of line.slice(prefix.length).split(" ")) {
    const [k, v] = pair.split("=");
    if (v) res[k] = v.split(",").map(Number) as [number, number, number];
  }
  return res;
}

/** 是否等于 clear 色(纯黑):三通道都 < 3。缺失几何=clear 色会暴露为纯黑。 */
function isClearBlack(c: [number, number, number]): boolean {
  return c[0] < 3 && c[1] < 3 && c[2] < 3;
}

function fail(detail: string): never {
  console.error("\ncheck-shaders: FAIL");
  console.error(detail);
  process.exit(1);
}

function main(): void {
  // 1) 汇总 HLSL 片段素材并转译。
  const programs: ProgramSpec[] = [];
  const hlsl = collectHlslFragments();
  for (const { name, fx } of hlsl) {
    const t = translateFragmentSource(fx);
    if (!t.ok) {
      fail("转译失败 " + name + ": " + t.error);
    }
    programs.push({ name: name + " (translated)", vs: FULLSCREEN_VERTEX, fs: t.source });
  }

  // 2) 兜底 GLSL 素材直接参与编译链接。
  programs.push({ name: "FALLBACK_FRAGMENT", vs: FULLSCREEN_VERTEX, fs: FALLBACK_FRAGMENT });
  programs.push({ name: "FALLBACK_VERTEX", vs: FALLBACK_VERTEX, fs: FALLBACK_FRAGMENT });

  // 3) 生成自包含 HTML(数据取自运行时常量,保证测的是源码真实数据)。
  const html = buildHtml(programs, FULLSCREEN_POSITIONS, FULLSCREEN_TEXCOORDS, FULLSCREEN_INDICES);
  const htmlPath = join(OUT_DIR, "check-shaders.html");
  writeFileSync(htmlPath, html, "utf8");

  // 4) 无头 Chrome 真实编译。
  const chrome = findChrome();
  if (!chrome) fail("找不到 headless Chrome(google-chrome / chromium)。");
  const profDir = mkdtempSync(join(tmpdir(), "shader-check-"));
  const domPath = join(OUT_DIR, "check-shaders-dom.html");
  const run = spawnSync(
    chrome,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--user-data-dir=" + profDir,
      "--virtual-time-budget=4000",
      "--dump-dom",
      "file://" + htmlPath,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
  writeFileSync(domPath, run.stdout, "utf8");
  if (run.status !== 0 && !run.stdout) {
    fail("Chrome 运行失败(status=" + run.status + "): " + (run.stderr || "(no stderr)"));
  }

  const out = extractOut(run.stdout);
  if (!out) fail("无法从 Chrome 输出解析 <pre id=\"out\">。DOM 已存: " + domPath);

  // 5) 断言全部程序 编译 OK + 链接 OK。
  const problems: string[] = [];
  if (out.includes("NO WEBGL2 CONTEXT")) problems.push("NO WEBGL2 CONTEXT: 当前 Chrome 无法创建 WebGL2 上下文。");
  if (out.includes("EXCEPTION")) problems.push("页面脚本抛异常: " + out.split("\n").filter((l) => l.includes("EXCEPTION")).join(" | "));
  for (const p of programs) {
    if (!out.includes("VERTEX[" + p.name + "] compiled OK")) problems.push(p.name + ": VERTEX 未编译成功");
    if (!out.includes("FRAGMENT[" + p.name + "] compiled OK")) problems.push(p.name + ": FRAGMENT 未编译成功");
    if (!out.includes("LINK OK[" + p.name + "]")) problems.push(p.name + ": 未 LINK OK");
  }
  if (out.includes("COMPILE FAILED")) problems.push("存在 COMPILE FAILED(见下方完整输出)");
  if (out.includes("LINK FAILED")) problems.push("存在 LINK FAILED(见下方完整输出)");

  // 6) 断言:真实绘制像素。
  //    - demo.fx(博客 fx: 素材):四角色相须符合预期平面渐变(BL 蓝、BR 粉、TL 青、TR 白粉),
  //      直接拦截"半屏黑/渐变撕裂"的全屏四边形拓扑与 UV 回归。
  //    - FALLBACK_*(纯色兜底):中心与右缘中点都不得是 clear 黑。
  //    - 其余(fna 网格系,画面本身较暗):中心非黑即可。
  for (const p of programs) {
    const pix = parsePix(out, p.name);
    if (!pix) {
      problems.push(p.name + ": 未解析到 PIX 采样(可能未成功绘制)");
      continue;
    }
    if (p.name.startsWith("demo.fx")) {
      const bl = pix["BL"], br = pix["BR"], tl = pix["TL"], tr = pix["TR"];
      if (!bl || !br || !tl || !tr) {
        problems.push(p.name + ": 缺四角采样");
        continue;
      }
      if (!(bl[2] > bl[1])) problems.push(p.name + ": BL 应为蓝色调(B>G),实际 " + bl.join(","));
      if (!(br[0] > 100)) problems.push(p.name + ": BR 应为粉色/红色调(R>100),实际 " + br.join(","));
      if (!(tl[1] > 100)) problems.push(p.name + ": TL 应为青色/绿色调(G>100),实际 " + tl.join(","));
      if (!(tr[0] > 100 && tr[1] > 100)) problems.push(p.name + ": TR 应为亮色(R>100 且 G>100),实际 " + tr.join(","));
    } else if (p.name.startsWith("FALLBACK")) {
      const c = pix["C"], rm = pix["RM"];
      if (!c || isClearBlack(c)) problems.push(p.name + ": 中心应是纯色兜底(非黑),实际 " + (c ? c.join(",") : "无"));
      if (!rm || isClearBlack(rm)) problems.push(p.name + ": 右缘中点应被绘制(非黑),实际 " + (rm ? rm.join(",") : "无"));
    } else {
      const c = pix["C"];
      if (!c || isClearBlack(c)) problems.push(p.name + ": 中心应非黑(有内容),实际 " + (c ? c.join(",") : "无"));
    }
  }

  if (problems.length > 0) {
    fail(
      problems.map((p) => "  - " + p).join("\n") +
        "\n\n=== <pre id=\"out\"> 完整内容 ===\n" +
        out,
    );
  }

  console.log("check-shaders: PASS (" + programs.length + " 个程序全部 编译+链接+渲染像素断言 通过)");
  for (const p of programs) {
    console.log("  ✓ " + p.name);
  }
  console.log("  (输出: " + htmlPath + " / " + domPath + ")");
}

main();
