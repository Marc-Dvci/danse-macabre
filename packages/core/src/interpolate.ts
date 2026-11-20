import type { Vec3 } from './types';
import { add, cross, dot, length, normalize, scale } from './vec';

const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 };
const WORLD_RIGHT: Vec3 = { x: 1, y: 0, z: 0 };

/** Ease in and out: 0 at u = 0, 1 at u = 1, with zero speed at both ends (smoothstep). */
export function smoothstep(u: number): number {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
}

/**
 * Spherical interpolation between two unit vectors. `k = 0` gives `u0` and `k = 1` gives `u1`. For antipodal inputs the
 * path goes through a fixed perpendicular: `cross(u0, up)`, or `cross(u0, right)` when `u0` is vertical.
 * @param u0 Unit vector at k = 0.
 * @param u1 Unit vector at k = 1.
 * @param k Fraction along the arc, in [0, 1].
 */
export function slerp(u0: Vec3, u1: Vec3, k: number): Vec3 {
  const c = Math.min(1, Math.max(-1, dot(u0, u1)));
  const theta = Math.acos(c);
  if (theta < 1e-9) return u0;
  if (Math.PI - theta < 1e-9) {
    let perp = cross(u0, WORLD_UP);
    if (length(perp) < 1e-9) perp = cross(u0, WORLD_RIGHT);
    const phi = Math.PI * k;
    return normalize(add(scale(u0, Math.cos(phi)), scale(normalize(perp), Math.sin(phi))));
  }
  const sinTheta = Math.sin(theta);
  const a = Math.sin((1 - k) * theta) / sinTheta;
  const b = Math.sin(k * theta) / sinTheta;
  return add(scale(u0, a), scale(u1, b));
}
