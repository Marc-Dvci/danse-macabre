import { WORLD_AXES } from './body-frame';
import { slerp, smoothstep } from './interpolate';
import { cellCenter } from './quantize';
import { directionSymbols } from './symbol';
import type { Cell, ColumnId, Score, Vec3 } from './types';

/** One move of a limb: from one cell centre to the next, between two times in seconds. */
export type Segment = { t0: number; t1: number; from: Vec3; to: Vec3 };

/** The cell centres of one gesture column over time. Vectors are in `WORLD_AXES` coordinates. */
export type Track = { start: Vec3; segments: Segment[] };

/** Cell used for a gesture column with no `startPosition` entry: the limb hangs straight down. */
export const DEFAULT_START: Cell = { direction: 'place', level: 'low' };

/**
 * Builds the track of one gesture column from its direction symbols.
 * @param score A score. Only direction symbols in `column` are read.
 * @param column The gesture column.
 * @param beatSeconds Seconds per beat (`60 / tempo`).
 */
export function buildTrack(score: Score, column: ColumnId, beatSeconds: number): Track {
  const start = cellCenter(score.startPosition[column] ?? DEFAULT_START, WORLD_AXES);
  const symbols = directionSymbols(score)
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

/**
 * Unit direction of a track at time t. Holds the start cell before the first move and the last cell after it.
 * @param track A track from `buildTrack`.
 * @param t Time in seconds.
 */
export function sampleTrack(track: Track, t: number): Vec3 {
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
