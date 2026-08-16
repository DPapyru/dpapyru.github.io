import { About } from "./features/about/About";

/**
 * 应用根组件。本期仅渲染「关于我」板块。
 * 路由(react-router-dom)由 #4 ticket 负责。
 */
export function App() {
  return <About />;
}
