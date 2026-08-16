import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./features/theme";
import { About } from "./features/about/About";
import { Blog } from "./features/blog/Blog";
import { Contact } from "./features/contact/Contact";
import { Header } from "./shared/compositions/Header/Header";
import { NotFound } from "./shared/compositions/NotFound/NotFound";

/**
 * 应用路由表 —— 板块与 URL 一一对应,可独立于 Router 测试(用 MemoryRouter 包裹)。
 * 默认落地「关于我」(/)。
 */
export function AppRoutes() {
  return (
    <ThemeProvider>
      <Header />
      <Routes>
        <Route path="/" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  );
}

/**
 * 应用根组件。浏览器路由(DOM history + 深链刷新的 SPA 回退由 404.html 承担)。
 */
export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
