type tuple3 = [number, number, number];

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
