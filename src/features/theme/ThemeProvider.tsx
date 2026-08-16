import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ACCENT_ATTR,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  THEME_ATTR,
  type AccentPreset,
  type ThemeMode,
} from "./theme";

/**
 * 主题上下文的值:当前模式与 accent 预设,及其切换函数。
 * 状态由切换函数驱动,副作用(effect)把 data-theme / data-accent 写到文档根元素。
 */
export type ThemeContextValue = {
  /** 当前明/暗模式。 */
  mode: ThemeMode;
  /** 当前 accent 预设。 */
  accent: AccentPreset;
  /** 设置为指定模式。 */
  setMode: (mode: ThemeMode) => void;
  /** 在 light/dark 之间翻转。 */
  toggleMode: () => void;
  /** 设置为指定 accent 预设。 */
  setAccent: (accent: AccentPreset) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * 主题提供者。置于应用根部,持有模式与 accent 的当前状态,
 * 并确保每次变化都同步写到 <html> 的 data-theme / data-accent 上。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE);
  const [accent, setAccent] = useState<AccentPreset>(DEFAULT_ACCENT);

  // 状态即真相:任何变化都同步到文档根元素,CSS 依 data-theme/data-accent 取令牌。
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTR, mode);
    root.setAttribute(ACCENT_ATTR, accent);
  }, [mode, accent]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      accent,
      setMode,
      toggleMode: () => setMode((m) => (m === "light" ? "dark" : "light")),
      setAccent,
    }),
    [mode, accent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 读取主题状态与切换函数;必须在 <ThemeProvider> 内使用。 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme 必须在 <ThemeProvider> 内使用");
  }
  return ctx;
}
