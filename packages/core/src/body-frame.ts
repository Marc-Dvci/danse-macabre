import type { BodyAxes, Frame } from './types';
import { cross, normalize, scale, sub, add, length } from './vec';

/**
 * Axes used when a frame has no usable hips or shoulders and there is no previous frame: up is +y, right is −x and
 * forward is +z. Right-handed: a dancer facing +z has their right side toward −x (Requirement 2.1).
 */
export const WORLD_AXES: BodyAxes = {
  up: { x: 0, y: 1, z: 0 },
  right: { x: -1, y: 0, z: 0 },
  forward: { x: 0, y: 0, z: 1 },
};

/** Horizontal width below which the hip and shoulder line gives no reliable facing (metres). */
const MIN_HORIZONTAL_WIDTH = 0.01;

/**
 * Returns the dancer's body axes for one frame. `right` is the horizontal part of the mean of the hip line and the
 * shoulder line (each measured from left to right joint), and `forward = normalize(cross(up, right))`.
 * @param frame A frame with all joints.
 * @param previous Axes of the previous frame. Used when the hip and shoulder line is shorter than 1 cm.
 * @returns Orthonormal axes. Without `previous`, falls back to WORLD_AXES.
 */
export function bodyFrame(frame: Frame, previous?: BodyAxes): BodyAxes {
  const j = frame.joints;
  const hips = sub(j['right-hip'], j['left-hip']);
  const shoulders = sub(j['right-shoulder'], j['left-shoulder']);
  const mean = scale(add(hips, shoulders), 0.5);
  const horizontal = { x: mean.x, y: 0, z: mean.z };
  if (length(horizontal) < MIN_HORIZONTAL_WIDTH) return previous ?? WORLD_AXES;
  const up = WORLD_AXES.up;
  const right = normalize(horizontal);
  const forward = normalize(cross(up, right));
  return { up, right, forward };
}
