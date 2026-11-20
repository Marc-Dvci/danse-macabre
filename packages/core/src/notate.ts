import { bodyFrame } from './body-frame';
import { footContacts } from './contact';
import { heldCells, hysteresisCells } from './held-cells';
import { limbBaseJoint, limbEndJoint } from './rig';
import { notateSupports, type SupportOptions } from './notate-supports';
import { canonicalScore, GESTURE_COLUMNS } from './score';
import { angularSpeeds, holdFrames, moveEdges, restFrames, smooth } from './segment';
import type { BodyAxes, Cell, ColumnId, Frame, Score, Symbol, Vec3 } from './types';
import { sub } from './vec';

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
  /** Rest threshold in deg/s (Requirement 4.4). Default 3. */
  restSpeed?: number;
  /** Hysteresis width in degrees for a limb resting near a cell boundary (Requirement 4.8). Default 4. */
  hysteresis?: number;
  /** Height of an ankle above the other ankle for the foot to count as off the floor, in metres (Requirement 4.7). Default 0.10. */
  liftHeight?: number;
  /** Shortest hold in seconds that counts as a rest (Requirement 4.4, rule b). Default 0.35. */
  dwellTime?: number;
  /** Largest angle in degrees from the start of a hold that still counts as holding (Requirement 4.4, rule b). Default 8. */
  dwellAngle?: number;
};

/** A move of one limb, from the frame where it starts to the frame where it ends, with the cell it settles in. */
type Move = { start: number; end: number; cell: Cell };

/**
 * Writes a gesture score from frames. Arms are notated from wrist minus shoulder and legs from ankle minus hip, both
 * relative to the body axes of each frame. Each limb's motion is split into moves at its rests, and each move that
 * settles in a new cell gets one symbol for that cell (Requirement 4.4). Leg symbols are written only while the foot is
 * off the floor (Requirement 4.7). See design.md, decisions D1 to D13.
 * @param frames Frames in time order, with all joints. At least one frame.
 * @param options Tempo, grid, title and thresholds. Defaults: minHold 0.12 s, smoothing 0.2 s, restSpeed 3 deg/s,
 *   hysteresis 4 deg, liftHeight 0.10 m.
 * @returns A canonical score that passes `validateScore`.
 * @throws RangeError when `frames` is empty.
 */
export function notateGestures(frames: Frame[], options: NotateOptions): Score {
  if (frames.length === 0) throw new RangeError('notateGestures: no frames');
  const minHold = options.minHold ?? 0.12;
  const smoothing = options.smoothing ?? 0.2;
  const restSpeed = options.restSpeed ?? 3;
  const hysteresis = options.hysteresis ?? 4;
  const liftHeight = options.liftHeight ?? 0.1;
  const dwellTime = options.dwellTime ?? 0.35;
  const dwellAngle = options.dwellAngle ?? 8;
  const n = frames.length;
  const t0 = frames[0]!.t;
  const times = frames.map((f) => f.t - t0);
  const lastDt = n > 1 ? times[n - 1]! - times[n - 2]! : 1 / 30;
  const endTime = times[n - 1]! + lastDt;
  const beatsPerSecond = options.tempo / 60;

  const axes: BodyAxes[] = [];
  for (const f of frames) axes.push(bodyFrame(f, axes[axes.length - 1]));

  const startPosition: Partial<Record<ColumnId, Cell>> = {};
  const symbols: Symbol[] = [];

  for (const column of GESTURE_COLUMNS) {
    const base = limbBaseJoint(column);
    const end = limbEndJoint(column);
    const vectors: Vec3[] = frames.map((f) => sub(f.joints[end], f.joints[base]));

    // Requirement 4.8 then 4.3: the cell each frame holds.
    const cells = heldCells(hysteresisCells(vectors, axes, hysteresis), times, minHold, endTime);
    startPosition[column] = cells[0]!;

    // Requirement 4.4: rests from the smoothed speed and from holds, moves between consecutive rests, edges from the
    // raw speed.
    const raw = angularSpeeds(vectors, times);
    const speedRests = restFrames(smooth(raw, times, smoothing), restSpeed);
    const rests = [
      ...new Set([...speedRests, ...holdFrames(vectors, times, raw, speedRests, dwellTime, dwellAngle)]),
    ].sort((a, b) => a - b);
    const moves: Move[] = [];
    for (let i = 0; i + 1 < rests.length; i++) {
      const edges = moveEdges(raw, rests[i]!, rests[i + 1]!);
      if (!edges) continue;
      const from = cells[edges.start]!;
      const settled = cells[edges.end]!;
      if (from.direction === settled.direction && from.level === settled.level) continue;
      // The new cell must hold for minHold after the move ends.
      let next = edges.end + 1;
      while (next < n && cells[next]!.direction === settled.direction && cells[next]!.level === settled.level) next++;
      const hold = (next < n ? times[next]! : endTime) - times[edges.end]!;
      if (hold < minHold) continue;
      moves.push({ start: edges.start, end: edges.end, cell: settled });
    }

    // Requirement 4.7: a leg symbol is written only while its ankle is more than liftHeight above the other ankle in
    // every frame of the move.
    const kept = column.endsWith('-leg')
      ? moves.filter((m) => {
          const other = end === 'left-ankle' ? 'right-ankle' : 'left-ankle';
          for (let k = m.start; k <= m.end; k++) {
            const j = frames[k]!.joints;
            if (!(j[end].y - j[other].y > liftHeight)) return false;
          }
          return true;
        })
      : moves;

    // Requirement 4.5: round to the grid, keep the duration at one grid or more, and do not overlap the previous symbol.
    let prevEndK = -Infinity;
    kept.forEach((move, i) => {
      const startK = Math.max(Math.round((times[move.start]! * beatsPerSecond) / options.grid), prevEndK);
      const endK = Math.round((times[move.end]! * beatsPerSecond) / options.grid);
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

/** Options for `notate`: gesture options plus the support thresholds. */
export type NotateAllOptions = NotateOptions & SupportOptions;

/**
 * Writes one score from frames: gesture symbols for the arms and legs (`notateGestures`) and support and turn symbols
 * for the feet (`notateSupports`). A leg gesture is kept only when its foot is off the floor on every frame of the
 * symbol's time window (supports-and-turns Requirement 1.5). The window is half open, `[start, start + duration)`.
 * @param frames Frames in time order, with all joints. At least one frame.
 * @param options Gesture and support options. Tempo and grid are used by both parts.
 * @returns A canonical score that passes `validateScore`.
 * @throws RangeError when `frames` is empty.
 */
export function notate(frames: Frame[], options: NotateAllOptions): Score {
  const gestures = notateGestures(frames, options);
  const supports = notateSupports(frames, options);
  const contacts = footContacts(frames, options);
  const t0 = frames[0]!.t;
  const secondsPerBeat = 60 / options.tempo;

  const kept = gestures.symbols.filter((s) => {
    if (s.column !== 'left-leg' && s.column !== 'right-leg') return true;
    const onFloor = s.column === 'left-leg' ? contacts.left : contacts.right;
    const from = s.start * secondsPerBeat;
    const to = (s.start + s.duration) * secondsPerBeat;
    for (let k = 0; k < frames.length; k++) {
      const rel = frames[k]!.t - t0;
      if (rel >= from && rel < to && onFloor[k]) return false;
    }
    return true;
  });

  return canonicalScore({ ...gestures, symbols: [...kept, ...supports] });
}
