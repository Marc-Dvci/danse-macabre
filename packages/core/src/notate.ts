import { bodyFrame } from './body-frame';
import { footContacts, standingHeight } from './contact';
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
  /**
   * A speed minimum is a rest when it is below this fraction of the lower of its two neighbouring peaks (Requirement
   * 4.4, rule a). Default 0.9: any dip at least 10% below both neighbouring peaks. Chosen on the nine CMU dances by
   * replay fidelity (docs/measure/fidelity.md): 0.25 left continuous dancing almost unwritten.
   */
  restDepth?: number;
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
 * @param options Tempo, grid, title and thresholds. Defaults: minHold 0.12 s, smoothing 0.1 s, restSpeed 3 deg/s, restDepth 0.9,
 *   hysteresis 4 deg, liftHeight 0.10 m.
 * @returns A canonical score that passes `validateScore`.
 * @throws RangeError when `frames` is empty.
 */
export function notateGestures(frames: Frame[], options: NotateOptions): Score {
  if (frames.length === 0) throw new RangeError('notateGestures: no frames');
  const minHold = options.minHold ?? 0.12;
  const smoothing = options.smoothing ?? 0.1;
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
    // A leg's start cell is a gesture: written only when that foot is off the floor (Requirement 4.7) at the first frame.
    if (column.endsWith('-leg')) {
      const other = end === 'left-ankle' ? 'right-ankle' : 'left-ankle';
      const j0 = frames[0]!.joints;
      if (j0[end].y - j0[other].y > liftHeight) startPosition[column] = cells[0]!;
    } else {
      startPosition[column] = cells[0]!;
    }

    // Requirement 4.4: rests from the smoothed speed and from holds, moves between consecutive rests, edges from the
    // raw speed.
    const raw = angularSpeeds(vectors, times);
    const speedRests = restFrames(smooth(raw, times, smoothing), restSpeed, options.restDepth ?? 0.9);
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

    // Requirement 4.7 (fidelity Requirement 2.1): a leg symbol is written only when its ankle is more than liftHeight above
    // the other ankle at the end of the move, the frame where the leg arrives. The rising part of the move is not checked.
    const kept = column.endsWith('-leg')
      ? moves.filter((m) => {
          const other = end === 'left-ankle' ? 'right-ankle' : 'left-ankle';
          const j = frames[m.end]!.joints;
          return j[end].y - j[other].y > liftHeight;
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
 * for the feet (`notateSupports`). A leg gesture is kept only when its foot is off the floor at the last frame of the
 * symbol's time window, where the leg arrives (supports-and-turns Requirement 1.5, as revised).
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

  // A leg gesture is kept when its foot is off the floor where the leg arrives: the last frame of the symbol's window.
  // A kick starts from the floor, so the frames where it leaves do not count against it (owner's revision of 1.5).
  const kept = gestures.symbols.filter((s) => {
    if (s.column !== 'left-leg' && s.column !== 'right-leg') return true;
    const onFloor = s.column === 'left-leg' ? contacts.left : contacts.right;
    const to = (s.start + s.duration) * secondsPerBeat;
    let arrival = -1;
    for (let k = 0; k < frames.length; k++) if (frames[k]!.t - t0 < to) arrival = k;
    return arrival >= 0 && !onFloor[arrival];
  });

  // A foot on the floor at the first frame starts as a support in place, at the level of the pelvis then.
  const startPosition = { ...gestures.startPosition };
  const standing = standingHeight(frames, contacts);
  const h0 = frames[0]!.joints.pelvis.y;
  const level = h0 < 0.93 * standing ? 'low' : h0 > 1.03 * standing ? 'high' : 'middle';
  if (contacts.left[0]) startPosition['left-support'] = { direction: 'place', level };
  if (contacts.right[0]) startPosition['right-support'] = { direction: 'place', level };

  return canonicalScore({ ...gestures, startPosition, symbols: [...kept, ...supports] });
}
