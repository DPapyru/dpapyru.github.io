/**
 * theme 功能模块 —— 类型与常量。
 *
 * 状态 = 模式(明/暗)+ accent 预设。主题经 CSS 变量 + data-theme/data-accent
 * 属性作用到文档根元素上,组件样式只消费 CSS 变量(CSS Modules)。
 */

/** 明/暗两种模式。 */
export type ThemeMode = "light" | "dark";

/** accent 预设色。 */
export type AccentPreset = "blue" | "emerald" | "rose";

/** 默认模式。 */
export const DEFAULT_MODE: ThemeMode = "light";

/** 默认 accent 预设。 */
export const DEFAULT_ACCENT: AccentPreset = "blue";

/** 可用于切换的 accent 预设清单(至少 3 个,满足本期需求)。 */
export const ACCENT_PRESETS: readonly AccentPreset[] = [
  "blue",
  "emerald",
  "rose",
];

/** 附加到文档根元素(data-theme)的属性名。 */
export const THEME_ATTR = "data-theme";

/** 附加到文档根元素(data-accent)的属性名。 */
export const ACCENT_ATTR = "data-accent";
