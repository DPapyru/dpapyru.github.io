/**
 * Mat4 — 4x4 矩阵(渲染能力 / 几何数学)。
 *
 * 零第三方依赖;列主序布局(column-major,与 WebGL/OpenGL 约定一致),
 * 内部以 16 个元素的定点数数组承载,可直接供 WebGL uniform 上传
 * (e.g. gl.uniformMatrix4fv(loc, false, mat.values))。
 * 纯函数式:静态工厂返回新矩阵,变换方法返回新矩阵,不修改入参。
 */

import { Vec3 } from "./Vec3";

export type Mat4Values = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

/** 列主序下标辅助:列 col(0..3)、行 row(0..3) → 数组索引。 */
function idx(col: number, row: number): number {
  return col * 4 + row;
}

export class Mat4 {
  /** 16 元素列主序矩阵数据(0 = 单位矩阵)。 */
  readonly values: Mat4Values;

  constructor(values?: Mat4Values) {
    if (values) {
      this.values = [...values] as Mat4Values;
    } else {
      this.values = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ] as Mat4Values;
    }
  }

  /** 单位矩阵。 */
  static identity(): Mat4 {
    return new Mat4();
  }

  /** 从 16 个值(列主序)构造 —— 与 WebGL 上传约定一致。 */
  static fromValues(...values: Mat4Values): Mat4 {
    return new Mat4(values);
  }

  /** 平移矩阵(列主序)。 */
  static translation(tx: number, ty: number, tz: number): Mat4 {
    const m = new Mat4();
    const v = m.values;
    v[idx(3, 0)] = tx;
    v[idx(3, 1)] = ty;
    v[idx(3, 2)] = tz;
    return m;
  }

  /** 绕 X 轴的旋转矩阵,angle 为弧度。 */
  static rotationX(angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = new Mat4();
    const v = m.values;
    v[idx(1, 1)] = c;
    v[idx(1, 2)] = s;
    v[idx(2, 1)] = -s;
    v[idx(2, 2)] = c;
    return m;
  }

  /** 绕 Y 轴的旋转矩阵,angle 为弧度。 */
  static rotationY(angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = new Mat4();
    const v = m.values;
    v[idx(0, 0)] = c;
    v[idx(0, 2)] = -s;
    v[idx(2, 0)] = s;
    v[idx(2, 2)] = c;
    return m;
  }

  /** 绕 Z 轴的旋转矩阵,angle 为弧度。 */
  static rotationZ(angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = new Mat4();
    const v = m.values;
    v[idx(0, 0)] = c;
    v[idx(0, 1)] = s;
    v[idx(1, 0)] = -s;
    v[idx(1, 1)] = c;
    return m;
  }

  /** 缩放矩阵。 */
  static scaling(sx: number, sy: number, sz: number): Mat4 {
    const m = new Mat4();
    const v = m.values;
    v[idx(0, 0)] = sx;
    v[idx(1, 1)] = sy;
    v[idx(2, 2)] = sz;
    return m;
  }

  /**
   * 透视投影矩阵(field-of-view 形式)。
   * @param fovY  纵向视场角,弧度(0 < fovY < PI)
   * @param aspect 宽高比(width / height)
   * @param near  近裁剪面距离(> 0)
   * @param far   远裁剪面距离(> near)
   */
  static perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    return Mat4.fromValues(
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    );
  }

  /** 正交投影矩阵。 */
  static orthographic(
    left: number, right: number,
    bottom: number, top: number,
    near: number, far: number,
  ): Mat4 {
    const l = left, r = right, b = bottom, t = top, n = near, f = far;
    return Mat4.fromValues(
      2 / (r - l), 0, 0, 0,
      0, 2 / (t - b), 0, 0,
      0, 0, -2 / (f - n), 0,
      -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1,
    );
  }

  /** 矩阵乘法(this * other)。 */
  multiply(other: Mat4): Mat4 {
    const a = this.values;
    const b = other.values;
    const out = new Array<number>(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        const bc = idx(c, 0), b1 = idx(c, 1), b2 = idx(c, 2), b3 = idx(c, 3);
        out[idx(c, r)] =
          a[idx(0, r)] * b[bc] +
          a[idx(1, r)] * b[b1] +
          a[idx(2, r)] * b[b2] +
          a[idx(3, r)] * b[b3];
      }
    }
    return new Mat4(out as Mat4Values);
  }

  /** 变换点/向量:把 (x, y, z, w=1) 经齐次裁剪后归一化,得到三维结果。 */
  transformPoint(x: number, y: number, z: number): Vec3 {
    const v = this.values;
    const tx = v[0] * x + v[4] * y + v[8] * z + v[12];
    const ty = v[1] * x + v[5] * y + v[9] * z + v[13];
    const tz = v[2] * x + v[6] * y + v[10] * z + v[14];
    const tw = v[3] * x + v[7] * y + v[11] * z + v[15];
    if (tw === 0) return new Vec3(tx, ty, tz);
    return new Vec3(tx / tw, ty / tw, tz / tw);
  }

  /** 转置(交换行列)。 */
  transpose(): Mat4 {
    const s = this.values;
    return new Mat4([
      s[0], s[4], s[8], s[12],
      s[1], s[5], s[9], s[13],
      s[2], s[6], s[10], s[14],
      s[3], s[7], s[11], s[15],
    ]);
  }

  /** 分量完全相等比较(直觉断言用)。 */
  equals(other: Mat4, epsilon = 0): boolean {
    const a = this.values;
    const b = other.values;
    for (let i = 0; i < 16; i++) {
      if (Math.abs(a[i] - b[i]) > epsilon) return false;
    }
    return true;
  }

  /** 以列主序数组返回数据副本(可直接上传 WebGL uniform)。 */
  toArray(): Mat4Values {
    return [...this.values] as Mat4Values;
  }
}
