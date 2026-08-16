/**
 * Vec2 — 二维向量(渲染能力 / 几何数学)。
 *
 * 零第三方依赖、纯函数式风格:不收(不 cache)向量常量子类,
 * 所有运算都返回新的 Vec2 实例,保持纯净(输入 → 输出)。
 * 置于 shared/capabilities(渲染接缝),供 WebGL 顶点与动画运行时复用。
 */

export interface Vec2Tuple {
  readonly x: number;
  readonly y: number;
}

export class Vec2 {
  readonly x: number;
  readonly y: number;

  constructor();
  constructor(x: number, y: number);
  constructor(readonlyTuple?: never, ...args: never[]);
  constructor(x?: number, y?: number) {
    this.x = x ?? 0;
    this.y = y ?? 0;
  }

  /** 向量加法:返回新的向量,不修改入参。 */
  add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  /** 向量减法:返回新的向量,不修改入参。 */
  sub(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  /** 标量缩放:返回新的向量,不修改入参。 */
  scale(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s);
  }

  /** 点积(标量)。 */
  dot(other: Vec2): number {
    return this.x * other.x + this.y * other.y;
  }

  /** 长度(模)。 */
  length(): number {
    return Math.hypot(this.x, this.y);
  }

  /** 归一化:返回单位向量;零向量返回零向量(不产生 NaN)。 */
  normalized(): Vec2 {
    const len = this.length();
    if (len === 0) return new Vec2(0, 0);
    return new Vec2(this.x / len, this.y / len);
  }

  /** 分量完全相等比较(直觉断言用)。 */
  equals(other: Vec2, epsilon = 0): boolean {
    return Math.abs(this.x - other.x) <= epsilon && Math.abs(this.y - other.y) <= epsilon;
  }

  /** 以 (x, y) 顺序的数组表示。 */
  toArray(): [number, number] {
    return [this.x, this.y];
  }
}
