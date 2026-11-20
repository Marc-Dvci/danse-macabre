import { WORLD_AXES } from './body-frame';
import { cellCenter } from './quantize';
import { buildFrame, standardRig, type Rig } from './rig';
import { GESTURE_COLUMNS } from './score';
import { slerp, smoothstep } from './interpolate';
import type { Cell, ColumnId, Frame, Score, Vec3 } from './types';

export type PerformOptions = {
  /** Frames per second. Default 30. */
  fps?: number;
  /** Segment lengths. Default `standardRig()`. */
  rig?: Rig;
};

type Segment = { t0: number; t1: number; from: Vec3; to: Vec3 };
type Track = { start: Vec3; segments: Segment[] };

/** Cell used for a gesture column with no `startPosition` entry: the limb hangs straight down. */
const DEFAULT_START: Cell = { direction: 'place', level: 'low' };

function buildTrack(score: Score, column: ColumnId, beatSeconds: number): Track {
  const start = cellCenter(score.startPosition[column] ?? DEFAULT_START, WORLD_AXES);
  const symbols = score.symbols
    .filter((s) => s.column === column)
    .sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let from = start;
  for (const s of symbols) {
    const to = cellCenter({ direction: s.direction, level: s.level }, WORLD_AXES);
    segments.push({ t0: s.start * beatSeconds, t1: (s.start + s.duration) * beatSeconds, from, to });
    from = to;
  }
  return { start, segments };
}

/** Unit direction of a track at time t. Holds the start before the first move and the last cell after it. */
function sample(track: Track, t: number): Vec3 {
  let current = track.start;
  for (const seg of track.segments) {
    if (t < seg.t0) return current;
    if (t <= seg.t1 && seg.t1 > seg.t0) {
      const u = (t - seg.t0) / (seg.t1 - seg.t0);
      return slerp(seg.from, seg.to, smoothstep(u));
    }
    current = seg.to;
  }
  return current;
}

/**
 * Plays the gesture columns of a score on the rig. Each limb holds its start cell, moves from its previous cell centre
 * to the next cell centre over the symbol's duration with ease in and out, and then holds. Symbols in support
 * columns are not performed in this spec.
 * @param score A score. Times come from `beat * 60 / tempo`.
 * @param options `fps` (default 30) and `rig` (default `standardRig()`).
 * @returns Frames from time 0 to the end of the last symbol plus one beat.
 */
export function performGestures(score: Score, options: PerformOptions = {}): Frame[] {
  const fps = options.fps ?? 30;
  const rig = options.rig ?? standardRig();
  const beatSeconds = 60 / score.tempo;
  const tracks = Object.fromEntries(
    GESTURE_COLUMNS.map((c) => [c, buildTrack(score, c, beatSeconds)]),
  ) as Record<(typeof GESTURE_COLUMNS)[number], Track>;

  let endBeat = 0;
  for (const s of score.symbols) endBeat = Math.max(endBeat, s.start + s.duration);
  const totalSeconds = (endBeat + 1) * beatSeconds;
  const last = Math.floor(totalSeconds * fps + 1e-9);

  const frames: Frame[] = [];
  for (let k = 0; k <= last; k++) {
    const t = k / fps;
    frames.push(
      buildFrame(
        t,
        {
          'left-arm': sample(tracks['left-arm'], t),
          'right-arm': sample(tracks['right-arm'], t),
          'left-leg': sample(tracks['left-leg'], t),
          'right-leg': sample(tracks['right-leg'], t),
        },
        rig,
      ),
    );
  }
  return frames;
}
