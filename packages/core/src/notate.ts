import { bodyFrame } from './body-frame';
import { quantizeGesture } from './quantize';
import { limbBaseJoint, limbEndJoint } from './rig';
import { canonicalScore, GESTURE_COLUMNS } from './score';
import type { BodyAxes, Cell, ColumnId, Frame, Score, Symbol, Vec3 } from './types';
import { angleDeg, length, sub } from './vec';

export type NotateOptions = {
  /** Beats per minute. */
  tempo: number;
  beatsPerBar: number;
  /** Grid unit in beats. */
  grid: number;
  title: string;
  /** Shortest hold of a new cell, in seconds (Requirement 4.3). Default 0.12. */
  minHold?: number;
  /** Width of the centred moving average of the angular speed, in seconds (Requirement 4.4). Default 0.2. */
  smoothing?: number;
  /** Height of an ankle above the other ankle for the foot to count as off the floor, in metres (Requirement 4.7). Default 0.10. */
  liftHeight?: number;
};

/** A frame counts as at the minimum when its smoothed speed is within max(this, 10%) of the minimum, in deg/s. */
const TIE_TOLERANCE = 2;
const TIE_FRACTION = 0.1;

/** A cell change after its frame-level detection. `frame` is the first frame of the new cell. */
type Change = { frame: number; cell: Cell };

/** A change with the frame range of its symbol. Indices are frames; `endIdx` is the end of the symbol's motion. */
type Move = Change & { startIdx: number; endIdx: number };

/** Returns the cell of a gesture column in one frame. A zero vector keeps the previous cell. */
function cellAt(frame: Frame, column: ColumnId, axes: BodyAxes, previous: Cell): Cell {
  const v: Vec3 = sub(frame.joints[limbEndJoint(column)], frame.joints[limbBaseJoint(column)]);
  if (length(v) < 1e-12) return previous;
  return quantizeGesture(v, axes);
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.direction === b.direction && a.level === b.level;
}

/**
 * Angular speed of the limb between each frame and the one before it, in deg/s. Entry 0 copies entry 1, so the first
 * frame does not show a false stop.
 */
function angularSpeeds(vectors: Vec3[], times: number[]): number[] {
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
 * `window / 2` seconds of frame k. Edges average over the frames that exist.
 */
function smooth(speeds: number[], times: number[], window: number): number[] {
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
 * Returns the frame in [from, to] that is at the minimum of the smoothed speed. A frame is at the minimum when it is
 * within max(2 deg/s, 10%) of the minimum. Among those frames, `latest` picks the last one and otherwise the first one.
 */
function settle(smoothed: number[], from: number, to: number, latest: boolean): number {
  let min = Infinity;
  for (let i = from; i <= to; i++) min = Math.min(min, smoothed[i]!);
  const limit = min + Math.max(TIE_TOLERANCE, TIE_FRACTION * min);
  if (latest) {
    for (let i = to; i >= from; i--) if (smoothed[i]! <= limit) return i;
  } else {
    for (let i = from; i <= to; i++) if (smoothed[i]! <= limit) return i;
  }
  return from;
}

/**
 * Writes a gesture score from frames. Arms are notated from wrist minus shoulder and legs from ankle minus hip, both
 * relative to the body axes of each frame. A symbol is written for each cell change that holds for `minHold`. Its start
 * and end are the speed minima around the change (Requirement 4.4). Leg symbols are written only while the foot is off
 * the floor (Requirement 4.7). See design.md, decisions D1 to D7.
 * @param frames Frames in time order, with all joints. At least one frame.
 * @param options Tempo, grid, title and the thresholds (defaults: minHold 0.12 s, smoothing 0.2 s, liftHeight 0.10 m).
 * @returns A canonical score that passes `validateScore`.
 * @throws RangeError when `frames` is empty.
 */
export function notateGestures(frames: Frame[], options: NotateOptions): Score {
  if (frames.length === 0) throw new RangeError('notateGestures: no frames');
  const minHold = options.minHold ?? 0.12;
  const smoothing = options.smoothing ?? 0.2;
  const liftHeight = options.liftHeight ?? 0.1;
  const n = frames.length;
  const t0 = frames[0]!.t;
  const times = frames.map((f) => f.t - t0);
  const lastDt = n > 1 ? times[n - 1]! - times[n - 2]! : 1 / 30;
  const beatsPerSecond = options.tempo / 60;

  const axes: BodyAxes[] = [];
  for (const f of frames) axes.push(bodyFrame(f, axes[axes.length - 1]));

  const startPosition: Partial<Record<ColumnId, Cell>> = {};
  const symbols: Symbol[] = [];

  for (const column of GESTURE_COLUMNS) {
    const cells: Cell[] = [];
    for (let k = 0; k < n; k++) {
      const previous = cells[k - 1] ?? { direction: 'place', level: 'low' };
      cells.push(cellAt(frames[k]!, column, axes[k]!, previous));
    }
    startPosition[column] = cells[0]!;

    // Requirement 4.3: a new cell counts only if it holds for minHold. Its hold runs to the next cell change in the
    // raw cells, or to the end of the clip for the last run.
    const runs: { start: number; cell: Cell; hold: number }[] = [];
    for (let k = 0; k < n; k++) {
      if (k === 0 || !sameCell(cells[k]!, cells[k - 1]!)) runs.push({ start: k, cell: cells[k]!, hold: 0 });
    }
    runs.forEach((run, i) => {
      const next = i + 1 < runs.length ? times[runs[i + 1]!.start]! : times[n - 1]! + lastDt;
      run.hold = next - times[run.start]!;
    });
    const changes: Change[] = [];
    let held = cells[0]!;
    for (let i = 1; i < runs.length; i++) {
      const run = runs[i]!;
      if (sameCell(run.cell, held) || run.hold < minHold) continue;
      changes.push({ frame: run.start, cell: run.cell });
      held = run.cell;
    }

    // Requirement 4.4: the start is the speed minimum between the previous symbol's end (or frame 0) and the change,
    // and the end is the speed minimum between the change and the next change (or the last frame).
    const vectors = frames.map((f) => sub(f.joints[limbEndJoint(column)], f.joints[limbBaseJoint(column)]));
    const smoothed = smooth(angularSpeeds(vectors, times), times, smoothing);
    const moves: Move[] = [];
    let prevEnd = 0;
    changes.forEach((change, j) => {
      const nextChange = j + 1 < changes.length ? changes[j + 1]!.frame : n - 1;
      const startIdx = settle(smoothed, prevEnd, change.frame, true);
      const endIdx = settle(smoothed, change.frame, nextChange, false);
      moves.push({ ...change, startIdx, endIdx });
      prevEnd = endIdx;
    });

    // Requirement 4.7: a leg symbol is written only while its ankle is more than liftHeight above the other ankle in
    // every frame of the symbol.
    const kept = column.endsWith('-leg')
      ? moves.filter((m) => {
          const own = limbEndJoint(column);
          const other = own === 'left-ankle' ? 'right-ankle' : 'left-ankle';
          for (let k = m.startIdx; k <= m.endIdx; k++) {
            const f = frames[k]!.joints;
            if (!(f[own].y - f[other].y > liftHeight)) return false;
          }
          return true;
        })
      : moves;

    // Requirement 4.5: round to the grid, keep the duration at one grid or more, and do not overlap the previous symbol.
    let prevEndK = -Infinity;
    kept.forEach((move, i) => {
      const startK = Math.max(Math.round((times[move.startIdx]! * beatsPerSecond) / options.grid), prevEndK);
      const endK = Math.round((times[move.endIdx]! * beatsPerSecond) / options.grid);
      const durK = Math.max(1, endK - startK);
      prevEndK = startK + durK;
      symbols.push({
        id: `${column}-${i}`,
        column,
        start: startK * options.grid,
        duration: durK * options.grid,
        direction: move.cell.direction,
        level: move.cell.level,
      });
    });
  }

  return canonicalScore({
    version: 1,
    title: options.title,
    tempo: options.tempo,
    beatsPerBar: options.beatsPerBar,
    grid: options.grid,
    startPosition,
    symbols,
  });
}
