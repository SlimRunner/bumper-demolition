export type Tuple<TItem, TLength extends number> = [TItem, ...TItem[]] & {
  length: TLength;
};

export namespace math {
  export class Vector<N extends Number> extends Float32Array {
    static create<M extends number>(...arr: Tuple<number, M>): Vector<M>;
    static cast<M extends number>(...args: Tuple<number, M>[]): Vector<M>[];
    copy(): Vector<N>;

    equals(b: Vector<N> | Vector3 | Vector4): boolean;
    plus(b: Vector<N> | Vector3 | Vector4): Vector<N>;
    minus(b: Vector<N> | Vector3 | Vector4): Vector<N>;
    times_pairwise(b: Vector<N> | Vector3 | Vector4): Vector<N>;
    times(b: number): Vector<N>;
    scale_by(b: number): void;
    randomized(b: number): void;
    mix(b: Vector<N> | Vector3 | Vector4, s: number): Vector<N>;

    normalize(): void;

    norm(): number;
    normalized(): Vector<N>;
    dot(b: Vector<N> | Vector3 | Vector4): number;
    cross(b: Vector<N> | Vector3): Vector<3>;

    to3(): Vector3;
    to4(): Vector4;

    to_string(): string;
  }

  export class Vector3 extends Float32Array {
    static create(...arr: Tuple<number, 3>): Vector3;
    static cast(...args: Tuple<number, 3>[]): Vector3[];
    copy(): Vector3;

    equals(b: Vector<3> | Vector3): boolean;
    plus(b: Vector<3> | Vector3): Vector3;
    minus(b: Vector<3> | Vector3): Vector3;
    times_pairwise(b: Vector<3> | Vector3): Vector3;
    times(b: number): Vector3;
    randomized(s: number): Vector3;
    mix(b: Vector<3> | Vector3, s: number): Vector3;

    add_by(b: Vector<3> | Vector3): void;
    subtract_by(b: Vector<3> | Vector3): void;
    scale_by(s: number): void;
    scale_pairwise_by(b: Vector<3> | Vector3): void;
    normalize(): void;

    norm(): number;
    normalized(): Vector3;
    dot(b: Vector<3> | Vector3): number;
    cross(b: Vector<3> | Vector3): Vector3;

    static shared_memory: UnsafeVec3;
    static unsafe(x: number, y: number, z: number): UnsafeVec3;

    to4(is_a_point: 0 | 1): Vector4;
    to_string(): string;
  }

  type UnsafeVec3 = Vector3 & { __unsafe: true };

  export class Vector4 extends Float32Array {
    static create(...arr: Tuple<number, 4>): Vector4;
    static cast(...args: Tuple<number, 4>[]): Vector4[];
    copy(): Vector4;

    equals(b: Vector<4> | Vector4): boolean;
    plus(b: Vector<4> | Vector4): Vector4;
    minus(b: Vector<4> | Vector4): Vector4;
    times_pairwise(b: Vector<4> | Vector4): Vector4;
    times(b: number): Vector4;
    randomized(s: number): Vector4;
    mix(b: Vector<4> | Vector4, s: number): Vector4;

    add_by(b: Vector<4> | Vector4): void;
    subtract_by(b: Vector<4> | Vector4): void;
    scale_by(s: number): void;
    scale_pairwise_by(b: Vector<4> | Vector4): void;
    normalize(): void;

    norm(): number;
    normalized(): Vector4;
    dot(b: Vector<4> | Vector4): number;

    static shared_memory: UnsafeVec4;
    static unsafe(x: number, y: number, z: number, w: number): UnsafeVec4;

    to3(): Vector3;
    to_string(): string;
  }

  type UnsafeVec4 = Vector4 & { __unsafe: true };

  export type MatrixLike<R extends number, C extends number> = Array<
    Array<number>
  > & {
    readonly rows: R;
    readonly cols: C;
  };

  export class Matrix<R extends number, C extends number>
    extends Array<Array<number>>
    implements MatrixLike<R, C>
  {
    declare readonly rows: R;
    declare readonly cols: C;

    constructor(...args: Tuple<Tuple<number, C>, R>);
    set(M: MatrixLike<R, C>): void;
    set_identity(n: R, m: C): void;
    sub_block<R2 extends number, C2 extends number>(
      start: [number, number],
      end: [number, number],
    ): Matrix<R2, C2>;
    copy(): Matrix<R, C>;
    equals(b: MatrixLike<R, C>): boolean;
    plus(b: MatrixLike<R, C>): Matrix<R, C>;
    minus(b: MatrixLike<R, C>): Matrix<R, C>;
    transposed(): Matrix<C, R>;
    times(b: number, pre_alloc?: MatrixLike<R, C>): Matrix<R, C>;
    times(v: Vector3, pre_alloc?: MatrixLike<R, 3>): Matrix<R, 1>;
    times(v: Vector4, pre_alloc?: MatrixLike<R, 4>): Matrix<R, 1>;
    times<C2 extends number>( // R x C  *  C x C2  =  R x C2
      b: MatrixLike<C, C2>,
      pre_alloc?: MatrixLike<R, C2>,
    ): Matrix<R, C2>;
    pre_multiply<R2 extends number>(b: MatrixLike<R2, R>): Matrix<R2, C>; // R2 x R  *  R x C  =  R2 x C
    post_multiply(b: number): Matrix<R, C>;
    post_multiply<C2 extends number>(v: Vector4): Matrix<R, 1>;
    post_multiply<C2 extends number>(b: MatrixLike<C, C2>): Matrix<R, C2>; // R x C  *  C x C2  =  R x C2
    static flatten_2D_to_1D<
      R2 extends number,
      C2 extends number,
    >(M: MatrixLike<R2, C2>): Float32Array;
    to_string(): string;
  }

  export class Mat4 extends Matrix<4, 4> {
    static identity(): Mat4;
    static rotation(angle: number, x: number, y: number, z: number): Mat4;
    static scale(x: number, y: number, z: number): Mat4;
    static translation(x: number, y: number, z: number): Mat4;
    static look_at(
      eye: Vector3 | Vector<3>,
      at: Vector3 | Vector<3>,
      up: Vector3 | Vector<3>,
    ): Mat4;
    static orthographic(
      left: number,
      right: number,
      bottom: number,
      top: number,
      near: number,
      far: number,
    ): Mat4;
    static perspective(
      fov_y: number,
      aspect: number,
      near: number,
      far: number,
    ): Mat4;
    static inverse(m: MatrixLike<4, 4>): Mat4;
  }

  export const vec: typeof Vector.create;
  export const vec3: typeof Vector3.create;
  export const vec4: typeof Vector4.create;
  export const unsafe3: typeof Vector3.unsafe;
  export const unsafe4: typeof Vector4.unsafe;
  export const color: typeof Vector4.create;
}
