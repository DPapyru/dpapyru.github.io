/**
 * <ProtocolRender/> —— 协议嵌入渲染接管(ticket #17)。
 *
 * 把协议嵌入插件(#11)产出的 anims:/fx: 占位节点接管为真实渲染:
 * - anims:<path> → <AnimCanvas script={...}/>(素材为 public/demos/demo-anim-*.js
 *   的自包含 ES 模块,default 导出 AnimScript);
 * - fx:<path>    → <ShaderStage source={...}/>(素材为 public/demos/*.fx 的 HLSL 源码)。
 *
 * 素材经构建期 import.meta.glob 内联进 bundle(与 #11 的 cs: 加载器同思路,零网络请求),
 * 按站点相对路径(public/ 之下的路径)与 basename 双查找。文件缺失 → 明确错误提示,
 * 不破坏整篇;ShaderStage 自身的转译/编译/上下文失败也有内建错误横幅。
 */
import type { ReactElement } from "react";
import { AnimCanvas } from "./AnimCanvas/AnimCanvas";
import { ShaderStage } from "./ShaderStage";

export type ProtocolKind = "anims" | "fx";

export interface ProtocolRenderProps {
  /** 协议名:anims(动画)或 fx(shader)。 */
  protocol: ProtocolKind;
  /** 素材的站点内相对路径(如 demos/demo-anim-rotating-square.js)。 */
  path: string;
  /** 透传类名(保留协议嵌入的样式上下文)。 */
  className?: string;
}

/** 动画脚本素材:src/assets/demos/demo-anim-*.js,构建期内联为模块。 */
const animModules = import.meta.glob("../../../src/assets/demos/demo-anim-*.js", {
  import: "default",
  eager: true,
}) as Record<string, unknown>;

/** shader 素材:src/assets/demos/*.fx,构建期 ?raw 内联为源码字符串。 */
const fxSources = import.meta.glob("../../../src/assets/demos/*.fx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/**
 * 归一化 glob 键为「src/assets/ 之后的相对路径」,按相对路径与 basename 双查找。
 * vitest 与 vite 的 glob 键形态不同(绝对/相对),统一处理。
 */
function resolveAsset(table: Record<string, unknown>, path: string): unknown {
  const marker = "assets/";
  for (const [key, value] of Object.entries(table)) {
    const at = key.lastIndexOf(marker);
    const rel = at >= 0 ? key.slice(at + marker.length) : key;
    if (rel === path) return value;
    const base = rel.slice(rel.lastIndexOf("/") + 1);
    if (base === path) return value;
  }
  return undefined;
}

/** anims:/fx: 素材缺失时的降级提示(不抛错,不破坏整篇)。 */
function MissingAsset({ path }: { path: string }): ReactElement {
  return (
    <div role="alert" data-testid="protocol-missing">
      未找到渲染素材:{path}
    </div>
  );
}

export function ProtocolRender({
  protocol,
  path,
  className,
}: ProtocolRenderProps): ReactElement {
  if (protocol === "anims") {
    const script = resolveAsset(animModules, path);
    if (script === undefined) return <MissingAsset path={path} />;
    return <AnimCanvas script={script} className={className} />;
  }
  const source = resolveAsset(fxSources, path);
  if (typeof source !== "string") return <MissingAsset path={path} />;
  return <ShaderStage source={source} className={className} />;
}
