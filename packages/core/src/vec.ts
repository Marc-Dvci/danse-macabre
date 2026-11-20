import type { Vec3 } from './types';

/** Returns a + b. */
export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** Returns a - b. */
export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** Returns a * s. */
export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

/** Returns the dot product a · b. */
export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Returns the cross product a × b. */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** Returns the Euclidean length of a. */
export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

/**
 * Returns a / |a|. Throws a RangeError when |a| is below 1e-12, because no direction is defined for it.
 */
export function normalize(a: Vec3): Vec3 {
  const n = length(a);
  if (n < 1e-12) throw new RangeError('normalize: zero-length vector has no direction');
  return scale(a, 1 / n);
}

/** Returns the angle between a and b in degrees, in [0, 180]. Either vector may be zero (the result is 0). */
export function angleDeg(a: Vec3, b: Vec3): number {
  const la = length(a);
  const lb = length(b);
  if (la < 1e-12 || lb < 1e-12) return 0;
  const c = Math.min(1, Math.max(-1, dot(a, b) / (la * lb)));
  return (Math.acos(c) * 180) / Math.PI;
}
