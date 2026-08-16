/**
 * theme 功能模块公开 API。
 * 对外暴露 Provider/Hook/组件,以及类型与常量。
 */
export { ThemeProvider, useTheme } from "./ThemeProvider";
export type { ThemeContextValue } from "./ThemeProvider";
export { ThemeToggle } from "./ThemeToggle";
export {
  THEME_ATTR,
  ACCENT_ATTR,
  DEFAULT_MODE,
  DEFAULT_ACCENT,
  ACCENT_PRESETS,
} from "./theme";
export type { ThemeMode, AccentPreset } from "./theme";
