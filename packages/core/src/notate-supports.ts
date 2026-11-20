import { bodyFrame } from './body-frame';
import { footContacts, standingHeight, type ContactOptions } from './contact';
import { quantizeGesture } from './quantize';
import { bodyAxesFromYaw, yawDegOf } from './support-axes';
import type { BodyAxes, ColumnId, Direction, Frame, Level, Symbol } from './types';
import { length } from './vec';

/** Thresholds for support notation (supports-and-turns Glossary and Requirements 1 and 2). */
export type SupportOptions = ContactOptions & {
  /** Largest horizontal pelvis displacement that still counts as `place`, in metres. Default 0.12. */
  stepPlace?: number;
};

export type SupportNotateOptions = SupportOptions & {
  /** Beats per minute. */
  tempo: number;
  /** Grid unit in beats. */
  grid: number;
};

/** Yaw change between two touchdowns that writes a turn sign, in degrees (Requirement 2.1). */
const TURN_THRESHOLD = 67.5;

/** A pending support symbol, before grid rounding. Times are in seconds from the first frame. */
type Pending = {
  column: ColumnId;
  startSec: number;
  endSec: number;
  symbol:
    | { kind: 'step'; direction: Direction; level: Level; displacement: { x: number; y: number; z: number } | null }
    | { kind: 'turn'; rotation: 'cw' | 'ccw'; amount: number };
};

/** Wraps an angle in degrees into (−180, 180]. */
function wrap(deg: number): number {
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}

/** Quarter-turn amount for a signed yaw change, or null when it is below the turn threshold. */
function turnOf(delta: number): { rotation: 'cw' | 'ccw'; amount: number } | null {
  const size = Math.abs(delta);
  if (size < TURN_THRESHOLD) return null;
  const quarters = Math.round((size / 360) * 4);
  const amount = Math.min(1, Math.max(0.25, quarters / 4));
  return { rotation: delta < 0 ? 'cw' : 'ccw', amount };
}

/**
 * Writes the support and turn symbols of a performance (supports-and-turns Requirements 1 and 2). A step is written for
 * each foot that leaves the floor and lands again, with its direction from the pelvis displacement and its level from
 * the pelvis height at landing. A turn sign is written in the column of the foot that stays in contact between two
 * consecutive touchdowns, when the body yaw changes by at least 67.5 degrees in that interval.
 * @param frames Frames in time order, with pelvis, hips, shoulders and ankles.
 * @param options Tempo, grid and thresholds. Defaults: contactHeight 0.12 m, contactSpeed 0.35 m/s, stepPlace 0.12 m.
 * @returns Support and turn symbols in canonical order. Ids are `${column}-${n}`. Each symbol's start and duration
 *   are whole grid units.
 * @throws RangeError when `frames` is empty.
 */
export function notateSupports(frames: Frame[], options: SupportNotateOptions): Symbol[] {
  if (frames.length === 0) throw new RangeError('notateSupports: no frames');
  const stepPlace = options.stepPlace ?? 0.12;
  const n = frames.length;
  const t0 = frames[0]!.t;
  const times = frames.map((f) => f.t - t0);
  const contacts = footContacts(frames, options);
  const standing = standingHeight(frames, contacts);

  const axes: BodyAxes[] = [];
  for (const f of frames) axes.push(bodyFrame(f, axes[axes.length - 1]));

  const pending: Pending[] = [];

  // Requirement 1.2: one step per leave and the next touchdown of the same foot.
  for (const side of ['left', 'right'] as const) {
    const c = contacts[side];
    const column = `${side}-support` as ColumnId;
    for (let a = 1; a < n; a++) {
      if (!(c[a - 1] && !c[a])) continue;
      let b = a + 1;
      while (b < n && !c[b]) b++;
      if (b >= n) break;

      // Requirement 1.3: horizontal displacement of the pelvis, in the body axes of the last frame on the floor (a − 1).
      // The foot leaves between frames a − 1 and a; during a fast turn the body can rotate 25 degrees in one frame, so
      // the facing is read where the step starts, not one frame into it (D32).
      const pa = frames[a - 1]!.joints.pelvis;
      const pb = frames[b]!.joints.pelvis;
      const d = { x: pb.x - pa.x, y: 0, z: pb.z - pa.z };
      const size = length(d);
      const direction: Direction = size < stepPlace || size === 0 ? 'place' : quantizeGesture(d, axes[a - 1]!).direction;
      // The direction is measured again below, in the facing at the step's notated start (D32).
      const displacement = direction === 'place' ? null : d;

      // Requirement 1.4: level from the pelvis height at landing.
      const h = frames[b]!.joints.pelvis.y;
      const level: Level = h < 0.93 * standing ? 'low' : h > 1.03 * standing ? 'high' : 'middle';

      pending.push({
        column,
        startSec: times[a]!,
        endSec: times[b]!,
        symbol: { kind: 'step', direction, level, displacement },
      });
    }
  }

  // Requirement 2.1: turns between consecutive touchdowns, in the column of the foot that stays down.
  const touchdowns: { k: number; side: 'left' | 'right' }[] = [];
  for (const side of ['left', 'right'] as const) {
    const c = contacts[side];
    for (let k = 1; k < n; k++) if (!c[k - 1] && c[k]) touchdowns.push({ k, side });
  }
  touchdowns.sort((x, y) => x.k - y.k || (x.side < y.side ? -1 : 1));
  for (let i = 0; i + 1 < touchdowns.length; i++) {
    const a = touchdowns[i]!;
    const b = touchdowns[i + 1]!;
    if (b.k <= a.k) continue;
    const stayed = contacts[a.side];
    // The pivot must stay down until the other foot lands. A foot can register its touchdown one frame after it lands,
    // because contact also needs low speed, so the pivot may lift one frame before that touchdown is seen. The turn then
    // ends at the pivot's lift frame. A pivot that lifts more than one frame early gives no turn (D30).
    let end = b.k;
    for (let k = a.k; k < b.k; k++) {
      if (!stayed[k]) {
        end = k;
        break;
      }
    }
    if (end < b.k - 1) continue;
    // Sum the wrapped yaw change of each frame, so a half or full turn keeps its sign (endpoints alone cannot tell
    // +180 from −180, or a full turn from none) (D29).
    let delta = 0;
    for (let k = a.k; k < end; k++) delta += wrap(yawDegOf(axes[k + 1]!) - yawDegOf(axes[k]!));
    const turn = turnOf(delta);
    if (!turn) continue;
    pending.push({
      column: `${a.side}-support` as ColumnId,
      startSec: times[a.k]!,
      endSec: times[end]!,
      symbol: { kind: 'turn', rotation: turn.rotation, amount: turn.amount },
    });
  }

  // Requirement 1.1: round to the same grid as the gestures (laban-core 4.5), keep one grid minimum, and do not overlap
  // the previous symbol in the same column.
  const beatsPerSecond = options.tempo / 60;
  const byColumn = new Map<ColumnId, Pending[]>();
  for (const p of pending) {
    const list = byColumn.get(p.column) ?? [];
    list.push(p);
    byColumn.set(p.column, list);
  }

  // Continuous yaw per frame (unwrapped), so the facing can be read between frames at a step's notated start.
  const yaws: number[] = [];
  for (const ax of axes) {
    const y = yawDegOf(ax);
    yaws.push(yaws.length === 0 ? y : yaws[yaws.length - 1]! + wrap(y - yaws[yaws.length - 1]!));
  }
  const fps = n > 1 ? (n - 1) / (times[n - 1]! - times[0]!) : 30;
  const yawAtSec = (sec: number): number => {
    const x = Math.min(Math.max(sec * fps, 0), n - 1);
    const i = Math.floor(x);
    const j = Math.min(i + 1, n - 1);
    return yaws[i]! + (yaws[j]! - yaws[i]!) * (x - i);
  };

  const out: Symbol[] = [];
  for (const column of ['left-support', 'right-support'] as const) {
    const list = (byColumn.get(column) ?? []).sort((x, y) => x.startSec - y.startSec);
    let prevEndK = -Infinity;
    list.forEach((p, i) => {
      const startK = Math.max(Math.round((p.startSec * beatsPerSecond) / options.grid), prevEndK);
      const endK = Math.round((p.endSec * beatsPerSecond) / options.grid);
      const durK = Math.max(1, endK - startK);
      prevEndK = startK + durK;
      const id = `${column}-${i}`;
      const start = startK * options.grid;
      const duration = durK * options.grid;
      if (p.symbol.kind === 'turn') {
        out.push({
          id,
          kind: 'turn',
          column,
          start,
          duration,
          rotation: p.symbol.rotation,
          amount: p.symbol.amount as 0.25 | 0.5 | 0.75 | 1,
        });
      } else {
        // D32: playback moves a step in the facing at the symbol's start, so the notation reads the direction in the
        // facing at the rounded start time, interpolated between frames. During a fast turn the facing changes by up
        // to 30 degrees between two frames.
        const disp = p.symbol.displacement;
        const direction = disp ? quantizeGesture(disp, bodyAxesFromYaw(yawAtSec(start / beatsPerSecond))).direction : p.symbol.direction;
        out.push({ id, column, start, duration, direction, level: p.symbol.level });
      }
    });
  }
  return out;
}
