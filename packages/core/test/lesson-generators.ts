// Generators for the lesson, search and layout property tests. Not a test file (no ".test." in the name).
// Scores here use all six columns, including support steps, so the lesson text is tested on steps too.
import fc from 'fast-check';
import {
  COLUMN_ORDER,
  DIRECTIONS,
  GESTURE_CELLS,
  LEVELS,
  canonicalScore,
  type Cell,
  type ColumnId,
  type Score,
  type Symbol,
} from '../src/index';

/** One half beat. Every generated start and duration is a whole number of these. */
export const HALF_BEAT = 0.5;

/** Every direction at every level. Used for support columns. */
export const SUPPORT_CELLS: Cell[] = DIRECTIONS.flatMap((direction) =>
  LEVELS.map((level) => ({ direction, level })),
);

type Segment = { gap: number; units: number; pick: number };

const arbSegment = fc.record({
  gap: fc.integer({ min: 0, max: 4 }),
  units: fc.integer({ min: 1, max: 6 }),
  pick: fc.nat(),
});

const arbCell = (cells: readonly Cell[]): fc.Arbitrary<Cell> =>
  fc.integer({ min: 0, max: cells.length - 1 }).map((i) => cells[i]!);

/** Builds non-overlapping symbols in one column. Gaps and durations are in half beats. */
function columnSymbols(column: ColumnId, cells: readonly Cell[], segments: Segment[]): Symbol[] {
  const out: Symbol[] = [];
  let cursor = 0;
  segments.forEach((seg, i) => {
    const start = cursor + seg.gap;
    const cell = cells[seg.pick % cells.length]!;
    out.push({
      id: `${column}-${i}`,
      column,
      start: start * HALF_BEAT,
      duration: seg.units * HALF_BEAT,
      direction: cell.direction,
      level: cell.level,
    });
    cursor = start + seg.units;
  });
  return out;
}

/**
 * Generator of valid scores. Tempo 60 to 180 bpm, beats per bar 2, 3 or 4, grid half a beat. Each of the six columns
 * holds up to six non-overlapping symbols. Gesture columns use `GESTURE_CELLS`; support columns use `SUPPORT_CELLS`.
 * Each column's start cell is optional. The output passes `validateScore` and is canonical.
 */
export const genScore: fc.Arbitrary<Score> = fc
  .record({
    tempo: fc.integer({ min: 60, max: 180 }),
    beatsPerBar: fc.constantFrom(2, 3, 4),
    columns: fc.record(
      Object.fromEntries(
        COLUMN_ORDER.map((c) => [
          c,
          fc.record({
            segments: fc.array(arbSegment, { maxLength: 6 }),
            start: fc.option(arbCell(c.endsWith('support') ? SUPPORT_CELLS : GESTURE_CELLS), { nil: undefined }),
          }),
        ]),
      ) as Record<ColumnId, fc.Arbitrary<{ segments: Segment[]; start: Cell | undefined }>>,
    ),
  })
  .map(({ tempo, beatsPerBar, columns }) => {
    const symbols: Symbol[] = [];
    const startPosition: Partial<Record<ColumnId, Cell>> = {};
    for (const column of COLUMN_ORDER) {
      const col = columns[column];
      const cells = column.endsWith('support') ? SUPPORT_CELLS : GESTURE_CELLS;
      symbols.push(...columnSymbols(column, cells, col.segments));
      if (col.start) startPosition[column] = col.start;
    }
    return canonicalScore({
      version: 1,
      title: 'generated',
      tempo,
      beatsPerBar,
      grid: HALF_BEAT,
      startPosition,
      symbols,
    });
  });

/**
 * Cuts a phrase out of a score: every symbol that starts in `[from, from + length)`, shifted so that `from` becomes
 * beat 0. The phrase keeps the symbols' ids and has no start position.
 * @param score Source score. It is not modified.
 * @param from Start beat of the window.
 * @param length Window length in beats, greater than 0.
 */
export function cutPhrase(score: Score, from: number, length: number): Score {
  const symbols = score.symbols
    .filter((s) => s.start >= from - 1e-9 && s.start < from + length - 1e-9)
    .map((s) => ({ ...s, start: s.start - from }));
  return { version: 1, title: 'phrase', tempo: score.tempo, beatsPerBar: score.beatsPerBar, grid: score.grid, startPosition: {}, symbols };
}
