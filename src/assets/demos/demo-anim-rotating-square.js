/**
 * demo-anim-rotating-square.js —— 旋转方块(矩阵主题)动画脚本。
 *
 * 遵循 <AnimCanvas/> 运行时的「函数式/声明式 AnimScript」格式:
 * 作为 ES 模块 default 导出 { setup, update, render, dispose }。
 * 脚本自包含(不 import src/,因其会被静态度量加载),用最小 2D 仿射变换实现旋转方块。
 *
 * 机制:update 按 delta(秒)推进角度;render 用「旋转×缩放」矩阵把四个局部角点
 * 变换到画布坐标,再连线成方块,并显式画出两条对角线演示 2D 旋转变换的几何意义。
 */

/**
 * 2D 仿射变换(旋转×缩放×平移),列主序约定,仅供此 demo 使用。
 * transform(x, y) 返回仿射变换后的画布坐标点。
 */
function makeTransform(cx, cy, angle, s) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    transform(x, y) {
      return {
        x: x * (cos * s) - y * (sin * s) + cx,
        y: x * (sin * s) + y * (cos * s) + cy,
      };
    },
  };
}

export default {
  setup(ctx) {
    return {
      angle: 0,
      // 以原点为中心、边长 2 的局部正方形四角
      corners: [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ],
      cx: ctx.width * 0.5,
      cy: ctx.height * 0.5,
      unit: Math.min(ctx.width, ctx.height) * 0.28,
    };
  },

  update(state, delta) {
    state.angle += delta * Math.PI * 0.6; // 每秒约转 0.6 圈
  },

  render(state, g, ctx) {
    g.clear("#0d1017");

    // 背景网格
    const step = 24;
    for (let x = step; x < ctx.width; x += step) {
      g.line({ x, y: 0 }, { x, y: ctx.height }, { stroke: "#1b2230", lineWidth: 1 });
    }
    for (let y = step; y < ctx.height; y += step) {
      g.line({ x: 0, y }, { x: ctx.width, y }, { stroke: "#1b2230", lineWidth: 1 });
    }

    const t = makeTransform(state.cx, state.cy, state.angle, state.unit);
    const pts = state.corners.map((p) => t.transform(p.x, p.y));

    // 方块四条边
    const stroke = { stroke: "#4fc3f7", lineWidth: 2 };
    g.line(pts[0], pts[1], stroke);
    g.line(pts[1], pts[2], stroke);
    g.line(pts[2], pts[3], stroke);
    g.line(pts[3], pts[0], stroke);

    // 对角线:演示二维旋转矩阵的几何意义
    g.line(pts[0], pts[2], { stroke: "#81d4fa", lineWidth: 1 });
    g.line(pts[1], pts[3], { stroke: "#81d4fa", lineWidth: 1 });

    // 中心
    g.circle({ x: state.cx, y: state.cy }, 3, { fill: "#e0f7fa" });
  },

  dispose() {
    // 无计时器/监听器,无需清理
  },
};
