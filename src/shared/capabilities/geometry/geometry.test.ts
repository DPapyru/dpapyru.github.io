import { describe, expect, test } from "vitest";
import { Vec2, Vec3, Mat4 } from "./index";

// 输入→输出的近似断言辅助(接缝 2:渲染运行时能力)。
function expectClose(actual: number, expected: number, eps = 1e-6): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(eps);
}

describe("Vec2 — 外部行为(输入→输出)", () => {
  test("加减与缩放返回新向量,入参不被修改", () => {
    const a = new Vec2(1, 2);
    const b = new Vec2(3, -1);
    expect(a.add(b).toArray()).toEqual([4, 1]);
    expect(a.sub(b).toArray()).toEqual([-2, 3]);
    expect(a.scale(2).toArray()).toEqual([2, 4]);
    expect(a.toArray()).toEqual([1, 2]);
  });

  test("点积与长度", () => {
    expect(new Vec2(1, 2).dot(new Vec2(3, 4))).toBe(11);
    expect(new Vec2(3, 4).length()).toBe(5);
  });

  test("归一化得到单位向量;零向量不动", () => {
    const n = new Vec2(3, 4).normalized();
    expectClose(n.x, 0.6);
    expectClose(n.y, 0.8);
    expectClose(n.length(), 1);
    const zero = new Vec2(0, 0).normalized();
    expect(zero.toArray()).toEqual([0, 0]);
  });

  test("equals 支持 epsilon 比较", () => {
    expect(new Vec2(1, 2).equals(new Vec2(1, 2))).toBe(true);
    expect(new Vec2(1, 2).equals(new Vec2(1.01, 2), 0.1)).toBe(true);
    expect(new Vec2(1, 2).equals(new Vec2(1.01, 2))).toBe(false);
  });
});

describe("Vec3 — 外部行为(输入→输出)", () => {
  test("加减、缩放、点积、长度", () => {
    const a = new Vec3(1, 2, 3);
    const b = new Vec3(4, 5, 6);
    expect(a.add(b).toArray()).toEqual([5, 7, 9]);
    expect(a.sub(b).toArray()).toEqual([-3, -3, -3]);
    expect(a.scale(3).toArray()).toEqual([3, 6, 9]);
    expect(a.dot(b)).toBe(32);
    expect(new Vec3(2, 3, 6).length()).toBe(7);
  });

  test("叉积(右手系)", () => {
    const x = new Vec3(1, 0, 0);
    const y = new Vec3(0, 1, 0);
    expect(x.cross(y).toArray()).toEqual([0, 0, 1]);
    expect(y.cross(x).toArray()).toEqual([0, 0, -1]);
  });

  test("归一化", () => {
    const n = new Vec3(0, 0, 5).normalized();
    expectClose(n.z, 1);
    expectClose(n.length(), 1);
    expect(new Vec3(0, 0, 0).normalized().toArray()).toEqual([0, 0, 0]);
  });
});

describe("Mat4 — 外部行为(输入→输出)", () => {
  test("单位矩阵 transformPoint 恒等", () => {
    expect(Mat4.identity().transformPoint(2, -3, 5).toArray()).toEqual([2, -3, 5]);
  });

  test("平移矩阵把点加上平移量", () => {
    expect(Mat4.translation(10, 20, 30).transformPoint(1, 2, 3).toArray()).toEqual([
      11, 22, 33,
    ]);
  });

  test("绕 Z 轴旋转 90° 把 (1,0,0) 转到 (0,1,0)", () => {
    const p = Mat4.rotationZ(Math.PI / 2).transformPoint(1, 0, 0);
    expectClose(p.x, 0);
    expectClose(p.y, 1);
    expectClose(p.z, 0);
  });

  test("绕 X / Y 轴旋转 90° 的已知输入→输出", () => {
    // 绕 X:y 轴上的 (0,1,0) → (0,0,1)
    const px = Mat4.rotationX(Math.PI / 2).transformPoint(0, 1, 0);
    expectClose(px.y, 0);
    expectClose(px.z, 1);
    // 绕 Y:x 轴上的 (1,0,0) → (0,0,-1)
    const py = Mat4.rotationY(Math.PI / 2).transformPoint(1, 0, 0);
    expectClose(py.x, 0);
    expectClose(py.z, -1);
  });

  test("缩放矩阵按系数缩放点", () => {
    expect(Mat4.scaling(2, 3, 4).transformPoint(1, 1, 1).toArray()).toEqual([2, 3, 4]);
  });

  test("矩阵乘法 T*S 等价于先缩放再平移", () => {
    const composed = Mat4.translation(1, 2, 3).multiply(Mat4.scaling(2, 2, 2));
    const s = Mat4.scaling(2, 2, 2);
    const t = Mat4.translation(1, 2, 3);
    const sv = s.transformPoint(1, 1, 1);
    const viaSteps = t.transformPoint(sv.x, sv.y, sv.z);
    expect(composed.transformPoint(1, 1, 1).toArray()).toEqual(viaSteps.toArray());
  });

  test("矩阵乘法列主序:作用于点等于先 b 后 a", () => {
    const a = Mat4.fromValues(
      1, 1, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      2, 0, 0, 1,
    );
    const b = Mat4.fromValues(
      1, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, 3, 0,
      0, 0, 0, 1,
    );
    const c = a.multiply(b);
    const bv = b.transformPoint(1, 1, 1);
    const direct = a.transformPoint(bv.x, bv.y, bv.z);
    expect(c.transformPoint(1, 1, 1).toArray()).toEqual(direct.toArray());
  });

  test("透视投影:近平面上视中心点 → z=-1,远平面上 → z=1", () => {
    const m = Mat4.perspective(Math.PI / 2, 1, 1, 10);
    const near = m.transformPoint(0, 0, -1);
    expectClose(near.x, 0);
    expectClose(near.y, 0);
    expectClose(near.z, -1);
    const far = m.transformPoint(0, 0, -10);
    expectClose(far.x, 0);
    expectClose(far.y, 0);
    expectClose(far.z, 1);
  });

  test("正交投影把近/远平面映射到 -1/1", () => {
    const m = Mat4.orthographic(-1, 1, -1, 1, 1, 10);
    expectClose(m.transformPoint(0.5, -0.5, -1).z, -1);
    expectClose(m.transformPoint(0.5, -0.5, -10).z, 1);
  });

  test("转置交换行列:平移量从第 4 列变到第 4 行", () => {
    const t = Mat4.translation(1, 2, 3).transpose();
    expect(t.values[3]).toBe(1);
    expect(t.values[7]).toBe(2);
    expect(t.values[11]).toBe(3);
  });

  test("equals 与 toArray", () => {
    const a = Mat4.scaling(1, 2, 3);
    const b = Mat4.scaling(1, 2, 3);
    expect(a.equals(b)).toBe(true);
    expect(a.values[0]).toBe(1);
    expect(a.values[5]).toBe(2);
    expect(a.values[10]).toBe(3);
    expect(a.toArray()).toHaveLength(16);
  });
});
