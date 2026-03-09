import { math } from "../../tiny-graphics-math";

export type tuple4 = [number, number, number];
export type tuple3 = [number, number, number];
export type tuple2 = [number, number];
export type matrix3x3 = [tuple3, tuple3, tuple3];
export type matrix4x4 = [tuple4, tuple4, tuple4, tuple4];

export enum VectorKind {
  vector = 0,
  point = 1,
}

export type PlaneChoice = "xy" | "yx" | "xz" | "zx" | "yz" | "zy";

export function lerp(a: number, b: number, t: number): number {
  return (1 - t) * a + t * b;
}

export function lerptg3(a: tuple3, b: tuple3, t: number): tuple3 {
  const s = 1 - t;
  return [s * a[0] + t * b[0], s * a[1] + t * b[1], s * a[2] + t * b[2]];
}

export function smoothstep(t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 3 * t2 - 2 * t3;
}

export function transposeMatrix<T>(src: T[][]) {
  const rows = src.length;
  const cols = src[0]?.length ?? 0;

  if (rows === cols) {
    return src.map((row, r, arr) => row.map((x, c) => arr[c][r]));
  } else {
    const dest: T[][] = new Array<T[]>(cols);
    for (let c = 0; c < cols; ++c) {
      dest[c] = new Array<T>(rows);
      for (let r = 0; r < rows; ++r) {
        dest[c][r] = src[r][c];
      }
    }
    return dest;
  }
}

export function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

export function clampV3(num: math.Vector3, min: number, max: number) {
  return math.vec3(
    clamp(num[0], min, max),
    clamp(num[1], min, max),
    clamp(num[2], min, max),
  );
}

export function vecTransform(lhs: number[][], vec: number[]) {
  const lhsRows = lhs.length;
  const lhsCols = lhs[0]?.length ?? 0;
  const rhsRows = vec.length;
  const rhsCols = 1;

  if (lhsCols !== rhsRows) {
    throw new Error(
      `Matrix error: cannot multiply ${lhsRows}⨯${lhsCols} times ${rhsRows}⨯${1}`,
    );
  }
  const prod: number[] = new Array(lhsRows);
  for (let i = 0; i < lhsRows; ++i) {
    let sum = 0;
    for (let k = 0; k < lhsCols; ++k) {
      sum += lhs[i][k] * vec[k];
    }
    prod[i] = sum;
  }
  return prod;
}

export function matrixMult(lhs: number[][], rhs: number[][]) {
  const lhsRows = lhs.length;
  const lhsCols = lhs[0]?.length ?? 0;
  const rhsRows = rhs.length;
  const rhsCols = rhs[0]?.length ?? 0;

  if (lhsCols !== rhsRows) {
    throw new Error(
      `Matrix error: cannot multiply ${lhsRows}⨯${lhsCols} times ${rhsRows}⨯${rhsCols}`,
    );
  }
  const prod: number[][] = new Array(lhsRows);
  for (let i = 0; i < lhsRows; ++i) {
    prod[i] = new Array(rhsCols);
    for (let j = 0; j < rhsCols; ++j) {
      let sum = 0;
      for (let k = 0; k < lhsCols; ++k) {
        sum += lhs[i][k] * rhs[k][j];
      }
      prod[i][j] = sum;
    }
  }
  return prod;
}

export function basisChange(
  forward: math.Vector3,
  center: math.Vector3,
  right: math.Vector3,
  loc: math.Vector3,
) {
  const w = forward.minus(center).normalized();
  const v = w.cross(right.minus(center)).normalized();
  const u = v.cross(w);

  return new math.Mat4(
    [u[0], v[0], w[0], loc[0]],
    [u[1], v[1], w[1], loc[1]],
    [u[2], v[2], w[2], loc[2]],
    [0, 0, 0, 1],
  );
}

export function linearTransform(
  mtx: math.Matrix<3, 3> | matrix3x3,
  tup3: math.Vector3 | math.Vector<3> | tuple3,
): tuple3 {
  return [
    mtx[0][0] * tup3[0] + mtx[0][1] * tup3[1] + mtx[0][2] * tup3[2],
    mtx[1][0] * tup3[0] + mtx[1][1] * tup3[1] + mtx[1][2] * tup3[2],
    mtx[2][0] * tup3[0] + mtx[2][1] * tup3[1] + mtx[2][2] * tup3[2],
  ];
}

export function affineTransform(
  mtx: math.Mat4 | math.Matrix<4, 4> | matrix4x4,
  tup3: math.Vector3 | math.Vector<3> | tuple3,
  affine: VectorKind,
): tuple3 {
  return [
    mtx[0][0] * tup3[0] +
      mtx[0][1] * tup3[1] +
      mtx[0][2] * tup3[2] +
      mtx[0][3] * affine,
    mtx[1][0] * tup3[0] +
      mtx[1][1] * tup3[1] +
      mtx[1][2] * tup3[2] +
      mtx[1][3] * affine,
    mtx[2][0] * tup3[0] +
      mtx[2][1] * tup3[1] +
      mtx[2][2] * tup3[2] +
      mtx[2][3] * affine,
  ];
}

export function crossMut(
  lhs: math.Vector3,
  rhs: math.Vector3,
  out: math.Vector3,
) {
  const lx = lhs[0],
    ly = lhs[1],
    lz = lhs[2];
  const rx = rhs[0],
    ry = rhs[1],
    rz = rhs[2];
  out[0] = ly * rz - lz * ry;
  out[1] = lz * rx - lx * rz;
  out[2] = lx * ry - ly * rx;
}

/**
 * projects v onto u
 * @param u vector to be projected into
 * @param v vector being projected
 * @param out vector projection
 */
export function projMut(u: math.Vector3, v: math.Vector3, out: math.Vector3) {
  const ux = u[0],
    uy = u[1],
    uz = u[2];
  const distSq = ux * ux + uy * uy + uz * uz;

  if (distSq < 1e-9) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return;
  }

  const dUV = ux * v[0] + uy * v[1] + uz * v[2];
  const scalar = dUV / distSq;

  out[0] = scalar * ux;
  out[1] = scalar * uy;
  out[2] = scalar * uz;
}

export function setVector(vec: math.Vector3, other: math.Vector3) {
  vec[0] = other[0];
  vec[1] = other[1];
  vec[2] = other[2];
}

export function rotateAboutAxis(
  v: math.Vector3,
  axis: math.Vector3,
  angle: number,
) {
  // implements Rodrigues' rotation formula
  const k = axis.normalized();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const term1 = v.times(cos);
  const term2 = k.cross(v).times(sin);
  const term3 = k.times(k.dot(v) * (1 - cos));

  return term1.plus(term2).plus(term3);
}

export class Vec3Ext {
  static max(a: math.Vector3, b: math.Vector3 | number) {
    if (b instanceof math.Vector3) {
      return math.vec3(
        Math.max(a[0], b[0]),
        Math.max(a[1], b[1]),
        Math.max(a[2], b[2]),
      );
    } else {
      return math.vec3(Math.max(a[0], b), Math.max(a[1], b), Math.max(a[2], b));
    }
  }

  static min(a: math.Vector3, b: math.Vector3 | number) {
    if (b instanceof math.Vector3) {
      return math.vec3(
        Math.min(a[0], b[0]),
        Math.min(a[1], b[1]),
        Math.min(a[2], b[2]),
      );
    } else {
      return math.vec3(Math.min(a[0], b), Math.min(a[1], b), Math.min(a[2], b));
    }
  }

  static abs(a: math.Vector3) {
    return math.vec3(Math.abs(a[0]), Math.abs(a[1]), Math.abs(a[2]));
  }
}

export class Vector2 extends Float32Array {
  static create(x: number, y: number) {
    const v = new Vector2(2);
    v[0] = x;
    v[1] = y;
    return v;
  }

  plus(rhs: Vector2) {
    return vec2(this[0] + rhs[0], this[1] + rhs[1]);
  }

  minus(rhs: Vector2) {
    return vec2(this[0] - rhs[0], this[1] - rhs[1]);
  }

  times(rhs: number) {
    return vec2(this[0] * rhs, this[1] * rhs);
  }

  norm() {
    return Math.sqrt(this[0] * this[0] + this[1] * this[1]);
  }

  normalized() {
    const d = 1 / this.norm();
    return vec2(this[0] * d, this[1] * d);
  }

  dot(rhs: Vector2) {
    return this[0] * rhs[0] + this[1] * rhs[1];
  }

  to3(last: number = 0, onto: PlaneChoice = "xz") {
    switch (onto) {
      case "xy":
        return math.vec3(this[0], this[1], last);
      case "yx":
        return math.vec3(this[1], this[0], last);
      case "xz":
        return math.vec3(this[0], last, this[1]);
      case "zx":
        return math.vec3(this[1], last, this[0]);
      case "yz":
        return math.vec3(last, this[0], this[1]);
      case "zy":
        return math.vec3(last, this[1], this[0]);
    }
  }

  transform(mtx: [tuple2, tuple2]) {
    return vec2(
      mtx[0][0] * this[0] + mtx[0][1] * this[1],
      mtx[1][0] * this[0] + mtx[1][1] * this[1],
    );
  }

  abs() {
    return vec2(Math.abs(this[0]), Math.abs(this[1]));
  }

  static max(v: Vector2, n: number) {
    return vec2(Math.max(v[0], n), Math.max(v[1], n));
  }

  static min(v: Vector2, n: number) {
    return vec2(Math.min(v[0], n), Math.min(v[1], n));
  }

  static from3d(pt3: math.Vector3, pick: PlaneChoice) {
    switch (pick) {
      case "xy":
        return vec2(pt3[0], pt3[1]);
      case "yx":
        return vec2(pt3[1], pt3[0]);
      case "xz":
        return vec2(pt3[0], pt3[2]);
      case "zx":
        return vec2(pt3[2], pt3[0]);
      case "yz":
        return vec2(pt3[1], pt3[2]);
      case "zy":
        return vec2(pt3[2], pt3[1]);
    }
  }
}

export const vec2 = Vector2.create;
