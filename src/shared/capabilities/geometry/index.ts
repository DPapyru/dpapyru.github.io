/**
 * geometry — 渲染数学库(渲染能力共享层)入口。
 * 对外公开 Vec2 / Vec3 / Mat4,供 rendering feature 的 WebGL 顶点绘制
 * 与动画运行时(渲染接缝 2)复用。零第三方运行时依赖。
 */

import { Vec2 } from "./Vec2";
import { Vec3 } from "./Vec3";
import { Mat4 } from "./Mat4";

export { Vec2, Vec3, Mat4 };
