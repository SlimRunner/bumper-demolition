// most of these are transcribed from Inigo Quilez's collection
// - https://iquilezles.org/articles/distfunctions/
// - https://iquilezles.org/articles/distfunctions2d/

import { clamp, PlaneChoice, vec2, Vec3Ext, Vector2 } from "../utils/math";
import { math } from "../../tiny-graphics-math";

// reference: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html
type Arr = readonly unknown[];

export type FunctorSDF<T, R> = (p: T) => R;

export function curry<T, R, Args extends Arr>(
  sdf: (p: T, ...args: [...Args]) => R,
  ...args: [...Args]
): FunctorSDF<T, R> {
  return (p: T) => sdf(p, ...args);
}

export function curryDyn<T, R, Args extends Arr>(
  sdf: (p: T, ...args: [...Args]) => R,
  args: () => [...Args],
): FunctorSDF<T, R> {
  return (p: T) => sdf(p, ...args());
}

export function sdGradient2D(
  pt3: math.Vector3,
  sdf: FunctorSDF<math.Vector3, number>,
  delta: number,
  onto: PlaneChoice,
) {
  const pt = Vector2.from3d(pt3, onto);
  const xdt = vec2(delta, 0);
  const ydt = vec2(0, delta);
  return vec2(
    sdf(pt.plus(xdt).to3(0, onto)) - sdf(pt.minus(xdt).to3(0, onto)),
    sdf(pt.plus(ydt).to3(0, onto)) - sdf(pt.minus(ydt).to3(0, onto)),
  )
    .times(2 * delta)
    .to3(0, onto)
    .normalized();
}

export function sdGradient3D(
  pt: math.Vector3,
  sdf: FunctorSDF<math.Vector3, number>,
  delta: number,
) {
  const xdt = math.vec3(delta, 0, 0);
  const ydt = math.vec3(0, delta, 0);
  const zdt = math.vec3(0, 0, delta);
  return math
    .vec3(
      sdf(pt.plus(xdt)) - sdf(pt.minus(xdt)),
      sdf(pt.plus(ydt)) - sdf(pt.minus(ydt)),
      sdf(pt.plus(zdt)) - sdf(pt.minus(zdt)),
    )
    .times(2 * delta)
    .normalized();
}

export function sdGradient3DMut(
  pt: math.Vector3,
  sdf: FunctorSDF<math.Vector3, number>,
  delta: number,
  out: math.Vector3,
  tmp: math.Vector3
) {
  const px = pt[0];
  const py = pt[1];
  const pz = pt[2];

  tmp[0] = px + delta; tmp[1] = py; tmp[2] = pz;
  const dx1 = sdf(tmp);

  tmp[0] = px - delta;
  const dx2 = sdf(tmp);

  tmp[0] = px; tmp[1] = py + delta;
  const dy1 = sdf(tmp);

  tmp[1] = py - delta;
  const dy2 = sdf(tmp);

  tmp[1] = py; tmp[2] = pz + delta;
  const dz1 = sdf(tmp);

  tmp[2] = pz - delta;
  const dz2 = sdf(tmp);

  const scale = 1 / (2 * delta);

  out[0] = (dx1 - dx2) * scale;
  out[1] = (dy1 - dy2) * scale;
  out[2] = (dz1 - dz2) * scale;
}

export function sdPlane(
  pt: math.Vector3,
  normal: math.Vector3,
  height: number,
) {
  return pt.dot(normal) + height;
}

export function sdOrientedRect(
  pt3: math.Vector3,
  a: Vector2,
  b: Vector2,
  th: number,
  onto: PlaneChoice,
) {
  const pt = Vector2.from3d(pt3, onto);
  const ba = b.minus(a);
  const l = ba.norm();
  const d = ba.times(1 / l);
  let q = pt.minus(a.plus(b).times(0.5));
  q = q.transform([
    [d[0], d[1]],
    [-d[1], d[0]],
  ]);
  q = q.abs().minus(vec2(l * 0.5, th * 0.5));
  return Vector2.max(q, 0).norm() + Math.min(Math.max(q[0], q[1]), 0);
}

/**
 * computes the sdf of an oriented pill
 * @param pt3 probe point in 3d
 * @param a start of segment
 * @param b end of segment
 * @param r radius of segment
 * @param onto plane onto which project the shape
 * @returns distance to pt3
 */
export function sdOrientedCapsule2D(
  pt3: math.Vector3,
  a: Vector2,
  b: Vector2,
  r: number,
  onto: PlaneChoice,
) {
  // reference: https://www.desmos.com/calculator/qkh8fxkiiy

  // this is technically the function of a line segment but it was
  // modified to make a "directed pill"

  const pt = Vector2.from3d(pt3, onto);
  let ba = b.minus(a);
  let baN2 = ba.normalized().times(r);
  let baN1 = baN2.times(1 / 2);
  const pa = pt.minus(a).minus(baN1);
  ba = ba.minus(baN2);
  const h = clamp(pa.dot(ba) / ba.dot(ba), 0, 1);
  return pa.minus(ba.times(h)).norm() - r / 2;
}

export function sdInvertedCapsule2D(
  pt3: math.Vector3,
  a: Vector2,
  b: Vector2,
  r: number,
  onto: PlaneChoice,
) {
  // reference: https://www.desmos.com/calculator/qkh8fxkiiy

  // this is technically the function of a line segment but it was
  // modified to make a "directed pill"

  const pt = Vector2.from3d(pt3, onto);
  let ba = b.minus(a);
  let baN2 = ba.normalized().times(r);
  let baN1 = baN2.times(1 / 2);
  const pa = pt.minus(a).minus(baN1);
  ba = ba.minus(baN2);
  const h = clamp(pa.dot(ba) / ba.dot(ba), 0, 1);
  return r / 2 - pa.minus(ba.times(h)).norm();
}

export function sdBox(pt: math.Vector3, b: math.Vector3, c: math.Vector3) {
  const q = Vec3Ext.abs(pt.minus(c)).minus(b);
  return (
    Vec3Ext.max(q, 0).norm() + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0)
  );
}

export function sdRoundBox(pt: math.Vector3, b: math.Vector3, r: number) {
  const q = Vec3Ext.abs(pt).minus(b);
  q[0] += r;
  q[1] += r;
  q[2] += r;
  return (
    Vec3Ext.max(q, 0).norm() +
    Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0) -
    r
  );
}
