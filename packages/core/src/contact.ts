import type { Frame } from './types';
import { length, sub } from './vec';

export type ContactOptions = {
  /** Largest height of an ankle above the lowest ankle of the clip, in metres. Default 0.12. */
  contactHeight?: number;
  /** Largest speed of an ankle, in m/s. Default 0.35. */
  contactSpeed?: number;
};

export type Contacts = {
  /** Per frame: true when the left foot is in contact. */
  left: boolean[];
  /** Per frame: true when the right foot is in contact. */
  right: boolean[];
  /** Lowest ankle height over all frames and both feet, in metres. */
  minY: number;
};

/**
 * Finds the frames where each foot is in contact with the floor (supports-and-turns, Glossary). An ankle is in contact
 * when it is within `contactHeight` of the lowest ankle of the clip and moves slower than `contactSpeed`. The speed of
 * frame k is the 3D distance of the ankle from frame k − 1 divided by the time between them. Frame 0 uses frame 1.
 * @param frames Frames in time order, with both ankles.
 * @param options Thresholds. Defaults 0.12 m and 0.35 m/s.
 */
export function footContacts(frames: Frame[], options: ContactOptions = {}): Contacts {
  const height = options.contactHeight ?? 0.12;
  const speedLimit = options.contactSpeed ?? 0.35;
  const n = frames.length;
  let minY = Infinity;
  for (const f of frames) {
    minY = Math.min(minY, f.joints['left-ankle'].y, f.joints['right-ankle'].y);
  }

  const result = { left: [] as boolean[], right: [] as boolean[], minY: n === 0 ? 0 : minY };
  for (const side of ['left', 'right'] as const) {
    const ankle = `${side}-ankle` as const;
    const out = result[side];
    for (let k = 0; k < n; k++) {
      const a = k === 0 ? 0 : k - 1;
      const b = k === 0 ? Math.min(1, n - 1) : k;
      const dt = frames[b]!.t - frames[a]!.t;
      const travelled = length(sub(frames[b]!.joints[ankle], frames[a]!.joints[ankle]));
      const speed = dt > 0 ? travelled / dt : 0;
      const low = frames[k]!.joints[ankle].y - minY <= height + 1e-9;
      out.push(low && speed <= speedLimit + 1e-9);
    }
  }
  return result;
}

/** Median of a list of numbers. The list is not modified. Returns NaN for an empty list. */
function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Pelvis height of the rig at standing, in metres. Used when no frame has both feet in contact (D22). */
export const RIG_STANDING_PELVIS = 0.95;

/**
 * Standing height (supports-and-turns, Glossary): the median pelvis height over the frames where both feet are in
 * contact. When there are none, the rig's standing pelvis height is returned (D22).
 * @param frames Frames with a pelvis joint.
 * @param contacts Result of `footContacts` for the same frames.
 */
export function standingHeight(frames: Frame[], contacts: Contacts): number {
  const heights: number[] = [];
  for (let k = 0; k < frames.length; k++) {
    if (contacts.left[k] && contacts.right[k]) heights.push(frames[k]!.joints.pelvis.y);
  }
  const m = median(heights);
  return Number.isNaN(m) ? RIG_STANDING_PELVIS : m;
}
