import { cellCenter } from './quantize';
import { normalize } from './vec';
import type { BodyAxes, Direction, Level, Vec3 } from './types';

/**
 * Pelvis height for each support level during playback, in metres (supports-and-turns Requirement 3.1): low 0.88,
 * middle 1.0 and high 1.05 times the rig's standing pelvis height of 0.95 m.
 */
export const PLAY_LEVEL_PELVIS: Record<Level, number> = {
  low: 0.88 * 0.95,
  middle: 1.0 * 0.95,
  high: 1.05 * 0.95,
};

/**
 * Body axes for a facing given as yaw in degrees. Yaw is `atan2(forward.x, forward.z)`, so it grows counter-clockwise
 * seen from above. Yaw 0 gives the world axes of `body-frame.ts` (forward +z, right −x).
 * @param yawDeg Yaw in degrees.
 */
export function bodyAxesFromYaw(yawDeg: number): BodyAxes {
  const a = (yawDeg * Math.PI) / 180;
  const forward: Vec3 = { x: Math.sin(a), y: 0, z: Math.cos(a) };
  const up: Vec3 = { x: 0, y: 1, z: 0 };
  // right = forward × up. At yaw 0 this is (−1, 0, 0), as in WORLD_AXES.
  const right: Vec3 = { x: -forward.z, y: 0, z: forward.x };
  return { up, right, forward };
}

/**
 * Yaw of a set of body axes in degrees, in (−180, 180]. The inverse of `bodyAxesFromYaw`.
 * @param axes Body axes. Only `forward` is read.
 */
export function yawDegOf(axes: BodyAxes): number {
  return (Math.atan2(axes.forward.x, axes.forward.z) * 180) / Math.PI;
}

/**
 * Horizontal unit vector of a step direction in the given body axes. `place` gives the zero vector.
 * @param direction Any of the nine directions.
 * @param axes Body axes at the time of the step.
 */
export function horizontalVector(direction: Direction, axes: BodyAxes): Vec3 {
  if (direction === 'place') return { x: 0, y: 0, z: 0 };
  const v = cellCenter({ direction, level: 'middle' }, axes);
  return normalize({ x: v.x, y: 0, z: v.z });
}
