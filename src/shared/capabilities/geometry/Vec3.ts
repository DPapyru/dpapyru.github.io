/**
 * Vec3 — 三维向量(渲染能力 / 几何数学)。
 *
 * 零第三方依赖、纯函数式风格:所有运算返回新的 Vec3 实例,不修改入参。
 * 与 Vec2 共享同一套外部约定(Vec 加减/缩放/点积/长度/归一化),
 * 另含三维专属的叉积与分量式构造。
 */

export class Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  constructor();
  constructor(x: number, y: number, z: number);
  constructor(readonlyTuple?: never, ...args: never[]);
  constructor(x?: number, y?: number, z?: number) {
    this.x = x ?? 0;
    this.y = y ?? 0;
    this.z = z ?? 0;
  }

  /** 向量加法:返回新的向量。 */
  add(other: Vec3): Vec3 {
    return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  /** 向量减法:返回新的向量。 */
  sub(other: Vec3): Vec3 {
    return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  /** 标量缩放:返回新的向量。 */
  scale(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  /** 点积(标量)。 */
  dot(other: Vec3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  /** 叉积:返回垂直于两向量所在平面的新向量。 */
  cross(other: Vec3): Vec3 {
    return new Vec3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  /** 长度(模)。 */
  length(): number {
    return Math.hypot(this.x, this.y, this.z);
  }

  /** 归一化:返回单位向量;零向量返回零向量(不产生 NaN)。 */
  normalized(): Vec3 {
    const len = this.length();
    if (len === 0) return new Vec3(0, 0, 0);
    return new Vec3(this.x / len, this.y / len, this.z / len);
  }

  /** 分量完全相等比较(直觉断言用)。 */
  equals(other: Vec3, epsilon = 0): boolean {
    return (
      Math.abs(this.x - other.x) <= epsilon &&
      Math.abs(this.y - other.y) <= epsilon &&
      Math.abs(this.z - other.z) <= epsilon
    );
  }

  /** 以 (x, y, z) 顺序的数组表示。 */
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }
}
