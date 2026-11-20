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
  /** Shortest dwell in a new cell, in seconds. Default 0.12. */
  minHold?: number;
  /** Angular speed above which a limb counts as moving, in degrees per second. Default 60. */
  stillSpeed?: number;
  /** Height of an ankle above the lowest ankle of the clip for the foot to count as off the floor, in metres. Default 0.10. */
  liftHeight?: number;
};

/**
 * Angular speed below which a limb counts as at rest, in degrees per second. A move starts at the last frame at rest
 * before its fast part and ends at the first frame at rest after it. The ease in and out of the playback (Requirement
 * 5.2) has zero speed at both ends, so the fast part alone would start and end late. See design.md, decision D1.
 */
const REST_SPEED = 1;

type Move = { startIdx: number; endIdx: number; cell: Cell };

/** Returns the cell of a gesture column in one frame. A zero vector keeps the previous cell. */
function cellAt(frame: Frame, column: ColumnId, axes: BodyAxes, previous: Cell): Cell {
  const v: Vec3 = sub(frame.joints[limbEndJoint(column)], frame.joints[limbBaseJoint(column)]);
  if (length(v) < 1e-12) return previous;
  return quantizeGesture(v, axes);
}

/**
 * Finds the moves of one limb: runs of frames above `stillSpeed`, extended outward while the speed stays above
 * REST_SPEED. `speeds[k]` is the speed between frames k - 1 and k.
 */
function findMoves(speeds: number[], stillSpeed: number): { startIdx: number; endIdx: number }[] {
  const n = speeds.length;
  const moves: { startIdx: number; endIdx: number }[] = [];
  let prevEnd = 0;
  let i = 1;
  while (i < n) {
    if (speeds[i]! <= stillSpeed) {
      i++;
      continue;
    }
    const runStart = i;
    while (i + 1 < n && speeds[i + 1]! > stillSpeed) i++;
    const runEnd = i;
    let a = runStart;
    while (a - 1 >= 1 && speeds[a - 1]! > REST_SPEED) a--;
    let b = runEnd;
    while (b + 1 < n && speeds[b + 1]! > REST_SPEED) b++;
    const startIdx = Math.max(a - 1, prevEnd);
    moves.push({ startIdx, endIdx: b });
    prevEnd = b;
    i++;
  }
  return moves;
}

/**
 * Writes a gesture score from frames. Arms are notated from wrist minus shoulder, legs from ankle minus hip, both
 * relative to the body axes of each frame. Symbols are rounded to the grid and carry the cell that the limb settles
 * in. See design.md, decisions D1 to D8.
 * @param frames Frames in time order, with all joints. At least one frame.
 * @param options Tempo, grid, title and the three thresholds (defaults: minHold 0.12 s, stillSpeed 60 deg/s,
 *   liftHeight 0.10 m).
 * @returns A canonical score that passes `validateScore`.
 * @throws RangeError when `frames` is empty.
 */
export function notateGestures(frames: Frame[], options: NotateOptions): Score {
  if (frames.length === 0) throw new RangeError('notateGestures: no frames');
  const minHold = options.minHold ?? 0.12;
  const stillSpeed = options.stillSpeed ?? 60;
  const liftHeight = options.liftHeight ?? 0.1;
  const n = frames.length;
  const t0 = frames[0]!.t;
  const times = frames.map((f) => f.t - t0);

  const axes: BodyAxes[] = [];
  for (const f of frames) axes.push(bodyFrame(f, axes[axes.length - 1]));

  let lowestAnkle = Infinity;
  for (const f of frames) {
    lowestAnkle = Math.min(lowestAnkle, f.joints['left-ankle'].y, f.joints['right-ankle'].y);
  }
  const liftLine = lowestAnkle + liftHeight;

  const startPosition: Partial<Record<ColumnId, Cell>> = {};
  const symbols: Symbol[] = [];
  const beatPerSecond = options.tempo / 60;

  for (const column of GESTURE_COLUMNS) {
    const cells: Cell[] = [];
    for (let k = 0; k < n; k++) {
      const previous = cells[k - 1] ?? { direction: 'place', level: 'low' };
      cells.push(cellAt(frames[k]!, column, axes[k]!, previous));
    }
    startPosition[column] = cells[0]!;

    const vectors = frames.map((f) => sub(f.joints[limbEndJoint(column)], f.joints[limbBaseJoint(column)]));
    const speeds: number[] = [0];
    for (let k = 1; k < n; k++) {
      const dt = times[k]! - times[k - 1]!;
      speeds.push(dt > 0 ? angleDeg(vectors[k - 1]!, vectors[k]!) / dt : 0);
    }

    const moves: Move[] = findMoves(speeds, stillSpeed).map((m) => ({
      ...m,
      cell: cells[Math.min(m.endIdx + 1, n - 1)]!,
    }));

    // Keep the moves that pass the hold, change, and lift tests. The held cell follows every move, kept or not.
    const kept: Move[] = [];
    let held = cells[0]!;
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i]!;
      const nextStart = i + 1 < moves.length ? times[moves[i + 1]!.startIdx]! : times[n - 1]!;
      const dwell = nextStart - times[move.endIdx]!;
      const changed = move.cell.direction !== held.direction || move.cell.level !== held.level;
      held = move.cell;
      if (!changed || dwell < minHold) continue;
      if (column.endsWith('-leg')) {
        const ankle = limbEndJoint(column);
        let lifted = true;
        for (let k = move.startIdx; k <= move.endIdx; k++) {
          if (frames[k]!.joints[ankle].y <= liftLine) {
            lifted = false;
            break;
          }
        }
        if (!lifted) continue;
      }
      kept.push(move);
    }

    let prevEndK = -Infinity;
    kept.forEach((move, i) => {
      const startK = Math.max(Math.round(times[move.startIdx]! * beatPerSecond / options.grid), prevEndK);
      const endK = Math.round(times[move.endIdx]! * beatPerSecond / options.grid);
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
