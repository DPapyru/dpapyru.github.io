import { NavLink } from "react-router-dom";
import styles from "./Header.module.css";

type NavItem = {
  to: string;
  label: string;
};

/** 站点顶部导航的三个板块入口。 */
const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "关于我" },
  { to: "/blog", label: "博客" },
  { to: "/contact", label: "联系方式" },
];

/**
 * 站点顶部导航 — 跨板块共享,置于共享层 compositions。
 * 用 NavLink 呈现当前板块选中态(aria-current="page")。
 * 预留主题切换(ThemeToggle)挂载位,theme feature 提供后可直接复用。
 */
export function Header() {
  return (
    <header className={styles.header}>
      <nav aria-label="板块导航" className={styles.nav}>
        <ul className={styles.navList}>
          {NAV_ITEMS.map(({ to, label }) => (
            <li key={to} className={styles.navItem}>
              <NavLink
                to={to}
                end
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.active}` : styles.link
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {/* ThemeToggle 挂载位:theme feature 提供后在此挂载 */}
      <div className={styles.themeSlot} data-testid="theme-toggle-slot" />
    </header>
  );
}
