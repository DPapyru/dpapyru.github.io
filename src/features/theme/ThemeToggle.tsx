import { useTheme } from "./ThemeProvider";
import { ACCENT_PRESETS, type AccentPreset } from "./theme";
import styles from "./ThemeToggle.module.css";

/**
 * 主题切换器 — 提供明/暗切换按钮与 accent 预设色选择。
 * accent 选项从 theme.ts 的 ACCENT_PRESETS 导出,随预设清单自动更新。
 */
export function ThemeToggle() {
  const { accent, setAccent, toggleMode } = useTheme();

  return (
    <div className={styles.toggle}>
      <button
        type="button"
        className={styles.modeButton}
        onClick={toggleMode}
        aria-label="切换明/暗主题"
      >
        明 / 暗
      </button>
      <div role="radiogroup" aria-label="accent 预设色" className={styles.accentGroup}>
        {ACCENT_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={accent === preset}
            aria-label={"accent 预设:" + preset}
            className={
              accent === preset ? styles.swatch + " " + styles.swatchActive : styles.swatch
            }
            data-color={preset}
            onClick={() => setAccent(preset as AccentPreset)}
          />
        ))}
      </div>
    </div>
  );
}
