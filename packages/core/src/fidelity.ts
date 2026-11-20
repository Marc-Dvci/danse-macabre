import { bodyFrame } from './body-frame';
import { perform } from './perform';
import { standardRig, type Rig } from './rig';
import { mean, median, percentile } from './fidelity-stats';
import type { BodyAxes, Frame, JointName, Score, Vec3 } from './types';

export type Limb = 'left-arm' | 'right-arm' | 'left-leg' | 'right-leg';

export type FidelityOptions = {
  /** Frames per second of the replay. Default: the recording's own rate, 1 / (t[1] - t[0]). */
  fps?: number;
  /** Passed to `perform`, in metres. Default 0.4. */
  stepLength?: number;
  /** Passed to `perform`. Default `standardRig()`. */
  rig?: Rig;
  /** Height in metres of an ankle above the other ankle for the foot to count as off the floor. Default 0.10. */
  liftHeight?: number;
};

export type FidelityResult = {
  /** Mean angle over all counted limb samples, in degrees. */
  meanDegrees: number;
  /** Median angle over all counted limb samples, in degrees. */
  medianDegrees: number;
  /** 90th percentile angle over all counted limb samples, in degrees. */
  p90Degrees: number;
  /** Mean angle of each limb, in degrees. NaN when the limb has no counted sample. */
  perLimb: Record<Limb, number>;
  /** Recording frames compared. */
  frames: number;
};

const LIMBS: Limb[] = ['left-arm', 'right-arm', 'left-leg', 'right-leg'];

/** The two joints whose difference is the limb direction: shoulder to wrist, or hip to ankle. */
const SEGMENT: Record<Limb, [JointName, JointName]> = {
  'left-arm': ['left-shoulder', 'left-wrist'],
  'right-arm': ['right-shoulder', 'right-wrist'],
  'left-leg': ['left-hip', 'left-ankle'],
  'right-leg': ['right-hip', 'right-ankle'],
};

/** Length of a vector. */
function len(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** Coordinates of a world vector in the body axes of one frame: (right, up, forward). */
function inBody(v: Vec3, axes: BodyAxes): Vec3 {
  const d = (a: Vec3) => v.x * a.x + v.y * a.y + v.z * a.z;
  return { x: d(axes.right), y: d(axes.up), z: d(axes.forward) };
}

/** Angle in degrees between two vectors, or NaN when one has zero length. Uses atan2 of |a x b| and a . b, which keeps
 * precision for nearly parallel vectors (acos would lose about half the digits there). */
function angleDegrees(a: Vec3, b: Vec3): number {
  const la = len(a);
  const lb = len(b);
  if (la < 1e-9 || lb < 1e-9) return NaN;
  const cx = a.y * b.z - a.z * b.y;
  const cy = a.z * b.x - a.x * b.z;
  const cz = a.x * b.y - a.y * b.x;
  const sin = len({ x: cx, y: cy, z: cz });
  const cos = a.x * b.x + a.y * b.y + a.z * b.z;
  return (Math.atan2(sin, cos) * 180) / Math.PI;
}

/** The limb direction of one frame, in the body axes of that frame. */
function limbInBody(f: Frame, limb: Limb, axes: BodyAxes): Vec3 {
  const [from, to] = SEGMENT[limb];
  const a = f.joints[from];
  const b = f.joints[to];
  return inBody({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, axes);
}

/**
 * Measures how closely a score reproduces a recording. The score is performed with `perform` at the recording's frame
 * rate. For each frame and each of the four limbs, the limb direction (wrist minus shoulder, or ankle minus hip) is
 * written in the body axes of its own frame, in both the recording and the replay, and the angle between the two is
 * taken. Position and facing of the recording do not count. A leg sample is counted only in frames where the recorded
 * foot is off the floor (laban-core Requirement 4.7): its ankle is more than `liftHeight` above the other ankle.
 * @param recording Frames in time order, with all joints. Its frames are compared with the replay's frames, up to the
 *   shorter of the two.
 * @param score The score to replay.
 * @param options See `FidelityOptions`.
 * @returns Mean, median and 90th percentile of the angles in degrees, the mean per limb, and the number of frames
 *   compared. Statistics are NaN when no sample is counted.
 */
export function replayFidelity(recording: Frame[], score: Score, options: FidelityOptions = {}): FidelityResult {
  const fps = options.fps ?? (recording.length > 1 ? 1 / (recording[1]!.t - recording[0]!.t) : 30);
  const liftHeight = options.liftHeight ?? 0.1;
  const replay = perform(score, { fps, stepLength: options.stepLength, rig: options.rig ?? standardRig() });
  const n = Math.min(recording.length, replay.length);

  const all: number[] = [];
  const byLimb: Record<Limb, number[]> = { 'left-arm': [], 'right-arm': [], 'left-leg': [], 'right-leg': [] };
  let recAxes: BodyAxes | undefined;
  let repAxes: BodyAxes | undefined;

  for (let k = 0; k < n; k++) {
    const rec = recording[k]!;
    const rep = replay[k]!;
    recAxes = bodyFrame(rec, recAxes);
    repAxes = bodyFrame(rep, repAxes);
    for (const limb of LIMBS) {
      if (limb.endsWith('-leg')) {
        const own = limb === 'left-leg' ? 'left-ankle' : 'right-ankle';
        const other = limb === 'left-leg' ? 'right-ankle' : 'left-ankle';
        if (!(rec.joints[own].y - rec.joints[other].y > liftHeight)) continue;
      }
      const angle = angleDegrees(limbInBody(rec, limb, recAxes), limbInBody(rep, limb, repAxes));
      if (Number.isNaN(angle)) continue;
      all.push(angle);
      byLimb[limb].push(angle);
    }
  }

  return {
    meanDegrees: mean(all),
    medianDegrees: median(all),
    p90Degrees: percentile(all, 0.9),
    perLimb: {
      'left-arm': mean(byLimb['left-arm']),
      'right-arm': mean(byLimb['right-arm']),
      'left-leg': mean(byLimb['left-leg']),
      'right-leg': mean(byLimb['right-leg']),
    },
    frames: n,
  };
}
