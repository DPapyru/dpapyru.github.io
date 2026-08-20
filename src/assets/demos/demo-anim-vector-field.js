/**
 * demo-anim-vector-field.js —— 向量场(向量主题)动画脚本。
 *
 * 遵循 <AnimCanvas/> 运行时的「函数式/声明式 AnimScript」格式:
 * 作为 ES 模块 default 导出 { setup, update, render, dispose }。
 * 脚本自包含(不 import src/,因其会被静态加载)。
 *
 * 机制:在网格采样点上计算「向量场」函数 V(px,py),再按场方向画箭头;
 * 时间参数使场随时间摆动,呈现流动感。坐标归一化到画布中心(原点在中心,纵向向上)。
 */

/**
 * 极简二维向量(仅供此 demo 使用)。
 */
function v(x, y) {
  return { x, y };
}
function add(a, b) {
  return v(a.x + b.x, a.y + b.y);
}
function scale(a, s) {
  return v(a.x * s, a.y * s);
}

/** 向量场函数:给定归一化坐标(u,v)和时刻 t,返回该点的向量方向。 */
function field(u, v, t) {
  // 两个旋转涡旋 + 小幅摆动
  const r1 = Math.hypot(u, v - 0.25);
  const swirl = v(-(v - 0.25) / (r1 + 0.15), u / (r1 + 0.15));
  const wobble = v(Math.sin(u * 4 + t * 2) * 0.5, Math.cos(v * 4 - t) * 0.5);
  return add(scale(swirl, 0.6), wobble);
}

export default {
  setup(ctx) {
    const cell = 34;
    return {
      t: 0,
      cell,
      // 网格采样点(画布坐标)
      cols: Math.max(2, Math.floor(ctx.width / cell)),
      rows: Math.max(2, Math.floor(ctx.height / cell)),
      cx: ctx.width * 0.5,
      cy: ctx.height * 0.5,
      unit: Math.min(ctx.width, ctx.height),
    };
  },

  update(state, delta) {
    state.t += delta;
  },

  render(state, g, ctx) {
    g.clear("#0c0e14");

    // 坐标轴(穿过中心)
    g.line({ x: 0, y: state.cy }, { x: ctx.width, y: state.cy }, { stroke: "#263044", lineWidth: 1 });
    g.line({ x: state.cx, y: 0 }, { x: state.cx, y: ctx.height }, { stroke: "#263044", lineWidth: 1 });

    for (let r = 0; r < state.rows; r += 1) {
      for (let c = 0; c < state.cols; c += 1) {
        // 采样点
        const px = (c + 0.5) * state.cell - state.cx;
        const py = (r + 0.5) * state.cell - state.cy;
        // 归一化到 [-1,1],注意 y 轴翻转使其"向上"为正
        const u = px / state.cx;
        const v = -py / state.cy;
        const dir = field(u, v, state.t);
        const len = Math.min(state.cell * 0.4, state.unit * 0.12);
        const from = { x: state.cx + px, y: state.cy + py };
        const to = {
          x: from.x + dir.x * len,
          y: from.y - dir.y * len,
        };
        g.line(from, to, { stroke: "#7e57c2", lineWidth: 1.4 });
        // 箭头头
        g.arrow(from, to, { stroke: "#9575cd", lineWidth: 1.4, headLength: 5 });
      }
    }
  },

  dispose() {
    // 无计时器/监听器,无需清理
  },
};
