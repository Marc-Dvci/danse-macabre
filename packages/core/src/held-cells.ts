import { cellMargin, quantizeGesture } from './quantize';
import type { BodyAxes, Cell, Vec3 } from './types';
import { length } from './vec';

/** The cell a limb holds before any frame is seen (decision D6). */
const DEFAULT_CELL: Cell = { direction: 'place', level: 'low' };

function sameCell(a: Cell, b: Cell): boolean {
  return a.direction === b.direction && a.level === b.level;
}

/**
 * Returns the cell of a limb in each frame with hysteresis (Requirement 4.8). A new cell replaces the held cell only
 * when the vector is at least `hysteresis` degrees inside it. A zero vector keeps the held cell.
 * @param vectors Limb vectors, one per frame.
 * @param axes Body axes per frame.
 * @param hysteresis Width in degrees.
 */
export function hysteresisCells(vectors: Vec3[], axes: BodyAxes[], hysteresis: number): Cell[] {
  const out: Cell[] = [];
  let held: Cell | null = null;
  vectors.forEach((v, k) => {
    if (length(v) >= 1e-12) {
      const candidate = quantizeGesture(v, axes[k]!);
      if (held === null) held = candidate;
      else if (!sameCell(candidate, held) && cellMargin(v, candidate, axes[k]!) >= hysteresis) held = candidate;
    }
    out.push(held ?? DEFAULT_CELL);
  });
  return out;
}

/**
 * Returns the held cell of each frame after the minimum-hold rule (Requirement 4.3). A run of equal cells becomes the held
 * cell only when it lasts at least `minHold` seconds, and the run lasts until the next change in `raw` or until
 * `endTime`. The first run is the start cell and is always taken.
 * @param raw Cell per frame, after hysteresis.
 * @param times Frame times in seconds, relative to the first frame.
 * @param minHold Minimum hold in seconds.
 * @param endTime Time at which the last run ends.
 */
export function heldCells(raw: Cell[], times: number[], minHold: number, endTime: number): Cell[] {
  const n = raw.length;
  const out: Cell[] = [];
  let held: Cell = raw[0] ?? DEFAULT_CELL;
  let k = 0;
  while (k < n) {
    let j = k + 1;
    while (j < n && sameCell(raw[j]!, raw[k]!)) j++;
    if (k > 0 && !sameCell(raw[k]!, held)) {
      const hold = (j < n ? times[j]! : endTime) - times[k]!;
      if (hold >= minHold) held = raw[k]!;
    }
    for (let m = k; m < j; m++) out.push(held);
    k = j;
  }
  return out;
}
