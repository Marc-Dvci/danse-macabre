import type { Vec3 } from './types';
import { angleDeg } from './vec';

/** A move's edges are the first and last frames whose raw speed reaches this fraction of the move's peak speed. */
export const MOVE_EDGE_FRACTION = 0.05;

/**
 * Angular speed of a limb vector between each frame and the one before it, in deg/s. Entry 0 copies entry 1, so the
 * first frame does not show a false stop. A zero vector gives speed 0.
 * @param vectors Limb vectors, one per frame.
 * @param times Frame times in seconds, strictly increasing.
 */
export function angularSpeeds(vectors: Vec3[], times: number[]): number[] {
  const n = vectors.length;
  const speeds = new Array<number>(n).fill(0);
  for (let k = 1; k < n; k++) {
    const dt = times[k]! - times[k - 1]!;
    speeds[k] = dt > 0 ? angleDeg(vectors[k - 1]!, vectors[k]!) / dt : 0;
  }
  if (n > 1) speeds[0] = speeds[1]!;
  return speeds;
}

/**
 * Centred moving average over a time window: frame k is averaged with every frame whose time is within
 * `window / 2` seconds of frame k. Frames at the edges average over the frames that exist.
 * @param speeds Values per frame.
 * @param times Frame times in seconds, increasing.
 * @param window Window width in seconds.
 */
export function smooth(speeds: number[], times: number[], window: number): number[] {
  const n = speeds.length;
  const half = window / 2;
  const prefix = [0];
  for (const s of speeds) prefix.push(prefix[prefix.length - 1]! + s);
  const out: number[] = [];
  let lo = 0;
  let hi = 0;
  for (let k = 0; k < n; k++) {
    const t = times[k]!;
    while (times[lo]! < t - half - 1e-12) lo++;
    while (hi + 1 < n && times[hi + 1]! <= t + half + 1e-12) hi++;
    out.push((prefix[hi + 1]! - prefix[lo]!) / (hi - lo + 1));
  }
  return out;
}

/**
 * Returns the frame indices of the rests of one limb (Requirement 4.4). A rest is a local minimum of the smoothed speed
 * that is below a quarter of the lower of its two neighbouring peaks, or below `restSpeed`. A flat minimum counts as
 * one rest at its middle frame. The first and last frames are always rests.
 * @param smoothed Smoothed angular speed per frame, deg/s.
 * @param restSpeed Absolute rest threshold in deg/s.
 * @returns Sorted, unique frame indices.
 */
export function restFrames(smoothed: number[], restSpeed: number): number[] {
  const n = smoothed.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  // Local minima, with a flat run of equal values reduced to its middle frame.
  const minima: number[] = [];
  let runStart = -1;
  for (let k = 0; k < n; k++) {
    const s = smoothed[k]!;
    const leftOk = k === 0 || s <= smoothed[k - 1]!;
    const rightOk = k === n - 1 || s <= smoothed[k + 1]!;
    if (leftOk && rightOk) {
      if (runStart === -1) runStart = k;
    } else if (runStart !== -1) {
      minima.push(Math.floor((runStart + k - 1) / 2));
      runStart = -1;
    }
  }
  if (runStart !== -1) minima.push(Math.floor((runStart + n - 1) / 2));

  const rests = new Set<number>([0, n - 1]);
  minima.forEach((m, i) => {
    const from = i > 0 ? minima[i - 1]! : 0;
    const to = i < minima.length - 1 ? minima[i + 1]! : n - 1;
    let leftPeak = 0;
    for (let k = from; k <= m; k++) leftPeak = Math.max(leftPeak, smoothed[k]!);
    let rightPeak = 0;
    for (let k = m; k <= to; k++) rightPeak = Math.max(rightPeak, smoothed[k]!);
    const s = smoothed[m]!;
    if (s < restSpeed || s < 0.25 * Math.min(leftPeak, rightPeak)) rests.add(m);
  });
  return [...rests].sort((a, b) => a - b);
}

/**
 * Returns the frames where one move starts and ends, between two rests. The move starts at the frame before its first
 * frame of motion and ends at its last frame of motion. Motion means raw speed of at least MOVE_EDGE_FRACTION of the
 * move's peak speed. Raw speed is used here, not the smoothed speed, because the smoothing window would move each edge
 * by up to half its width (0.1 s at the default 0.2 s).
 * @param raw Raw angular speed per frame, deg/s.
 * @param from Index of the rest that opens the move.
 * @param to Index of the rest that closes the move.
 * @returns Frame indices `start` and `end`, or null when the move has no motion.
 */
export function moveEdges(raw: number[], from: number, to: number): { start: number; end: number } | null {
  let peak = 0;
  for (let k = from + 1; k <= to; k++) peak = Math.max(peak, raw[k]!);
  if (peak <= 0) return null;
  const threshold = MOVE_EDGE_FRACTION * peak;
  let first = -1;
  let last = -1;
  for (let k = from + 1; k <= to; k++) {
    if (raw[k]! >= threshold) {
      if (first === -1) first = k;
      last = k;
    }
  }
  return { start: first - 1, end: last };
}
