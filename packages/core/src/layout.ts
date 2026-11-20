import { glyphPolygon, type Point } from './layout-shapes';
import type { ColumnId, Direction, Level, Score } from './types';

export type StaffOptions = {
  /** Staff units per beat. Default 24. */
  beatHeight?: number;
  /** Staff units per column. Default 16. */
  columnWidth?: number;
};

export type StaffColumnId = ColumnId | 'left-torso' | 'right-torso';

export type StaffColumn = { id: StaffColumnId; x: number; w: number };

/** A vertical line from `y1` to `y2` at `x`. */
export type StaffLine = { x: number; y1: number; y2: number };

/** A horizontal bar line from `x1` to `x2` at `y`. `double` marks the double bar line at beat 0. */
export type StaffBar = { y: number; x1: number; x2: number; double: boolean };

/** A count number, drawn on the left of the staff at `x`, at the height of `beat`. */
export type StaffCount = { beat: number; x: number; y: number; label: string };

/**
 * One glyph. Glyphs for symbols use the symbol id. Glyphs for the starting position use `start:<column>`, so each symbol
 * has exactly one glyph with its own id.
 */
export type StaffGlyph = {
  symbolId: string;
  column: ColumnId;
  x: number;
  y: number;
  w: number;
  h: number;
  polygon: Point[];
  level: Level;
};

export type StaffLayout = {
  width: number;
  height: number;
  columns: StaffColumn[];
  lines: StaffLine[];
  bars: StaffBar[];
  counts: StaffCount[];
  glyphs: StaffGlyph[];
};

/**
 * Lays out a score as a Labanotation staff in staff units (Requirement 3). Time runs upward. The starting position sits
 * in the zone below the double bar line at beat 0. Columns run outward from the centre line: support, leg, torso (empty),
 * arm.
 * @param score A valid score.
 * @param options `beatHeight` (default 24) and `columnWidth` (default 16).
 * @returns Columns, staff lines, bar lines, counts and glyphs. Turn glyphs are not drawn: the score has no turns yet.
 * @throws RangeError when a size is not positive, or a symbol's column is unknown.
 */
export function layoutStaff(score: Score, options: StaffOptions = {}): StaffLayout {
  const bh = options.beatHeight ?? 24;
  const w = options.columnWidth ?? 16;
  if (!(bh > 0) || !(w > 0)) throw new RangeError('layoutStaff: beatHeight and columnWidth must be positive');

  const bpb = score.beatsPerBar;
  const end = score.symbols.reduce((m, s) => Math.max(m, s.start + s.duration), 0);
  const bars = Math.max(1, Math.ceil(end / bpb - 1e-9));
  const totalBeats = bars * bpb;

  const y = (beat: number): number => (beat + 1) * bh;
  const height = y(totalBeats);
  const width = 8 * w;
  const centreX = 4 * w;

  const columns: StaffColumn[] = [
    { id: 'left-arm', x: 0, w },
    { id: 'left-torso', x: w, w },
    { id: 'left-leg', x: 2 * w, w },
    { id: 'left-support', x: 3 * w, w },
    { id: 'right-support', x: 4 * w, w },
    { id: 'right-leg', x: 5 * w, w },
    { id: 'right-torso', x: 6 * w, w },
    { id: 'right-arm', x: 7 * w, w },
  ];
  const columnX = new Map<string, number>(columns.map((c) => [c.id, c.x]));

  const lines: StaffLine[] = [2 * w, centreX, 6 * w].map((x) => ({ x, y1: 0, y2: height }));

  const barLines: StaffBar[] = [];
  for (let beat = 0; beat <= totalBeats; beat += bpb) {
    barLines.push({ y: y(beat), x1: 2 * w, x2: 6 * w, double: beat === 0 });
  }

  const counts: StaffCount[] = [];
  for (let beat = 0; beat < totalBeats; beat++) {
    counts.push({ beat, x: 2 * w, y: y(beat), label: String((beat % bpb) + 1) });
  }

  const glyphs: StaffGlyph[] = [];
  const glyphFor = (symbolId: string, column: ColumnId, direction: Direction, level: Level, y0: number, h: number) => {
    const x = columnX.get(column);
    if (x === undefined) throw new RangeError(`layoutStaff: unknown column "${column}"`);
    const side = column.startsWith('left') ? 'left' : 'right';
    const box = { x0: x, x1: x + w, y0, y1: y0 + h };
    return { symbolId, column, x, y: y0, w, h, polygon: glyphPolygon(direction, side, box, centreX), level };
  };

  for (const [column, cell] of Object.entries(score.startPosition) as [ColumnId, NonNullable<Score['startPosition'][ColumnId]>][]) {
    glyphs.push(glyphFor(`start:${column}`, column, cell.direction, cell.level, 0, bh));
  }
  for (const s of score.symbols) {
    if (s.start < 0 || s.duration <= 0) throw new RangeError(`layoutStaff: symbol "${s.id}" has a bad start or duration`);
    glyphs.push(glyphFor(s.id, s.column, s.direction, s.level, y(s.start), s.duration * bh));
  }

  return { width, height, columns, lines, bars: barLines, counts, glyphs };
}
