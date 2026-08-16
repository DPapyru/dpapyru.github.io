import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";
import {
  ACCENT_ATTR,
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  THEME_ATTR,
} from "./theme";

/**
 * 主题切换 — 外部行为断言:切换后文档根元素(data-theme/data-accent)变化。
 * 状态经 context + effect 落到 <html>,是我们对组件可观察的外部契约。
 */
function renderHarness() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("主题切换", () => {
  const root = () => document.documentElement;

  beforeEach(() => {
    // 每个用例从干净根元素开始。
    root().removeAttribute(THEME_ATTR);
    root().removeAttribute(ACCENT_ATTR);
  });

  it("挂载后把默认 data-theme 与 data-accent 写到文档根元素", () => {
    renderHarness();
    expect(root().getAttribute(THEME_ATTR)).toBe(DEFAULT_MODE);
    expect(root().getAttribute(ACCENT_ATTR)).toBe(DEFAULT_ACCENT);
  });

  it("点击明/暗切换后 data-theme 在 light/dark 间翻转", () => {
    renderHarness();
    expect(root().getAttribute(THEME_ATTR)).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "切换明/暗主题" }));

    expect(root().getAttribute(THEME_ATTR)).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "切换明/暗主题" }));
    expect(root().getAttribute(THEME_ATTR)).toBe("light");
  });

  it("点击 accent 预设后 data-accent 变化", () => {
    renderHarness();
    expect(root().getAttribute(ACCENT_ATTR)).toBe(DEFAULT_ACCENT);

    // 逐个遍历所有预设,验证每个都写到根元素。
    const group = screen.getByRole("radiogroup", { name: "accent 预设色" });
    for (const preset of ACCENT_PRESETS) {
      fireEvent.click(
        screen.getByRole("radio", { name: "accent 预设:" + preset }),
      );
      expect(root().getAttribute(ACCENT_ATTR)).toBe(preset);
      expect(group).toBeInTheDocument();
    }
  });
});
