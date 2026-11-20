import { glyphPolygon, turnPolygon, type Point } from './layout-shapes';
import { isTurnSymbol } from './symbol';
import type { ColumnId, Direction, Level, Score, TurnSymbol } from './types';

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
 *
 * `kind` tells the two forms apart. A `direction` glyph has `level` and null turn fields. A `turn` glyph has `rotation`
 * and `amount` and a null `level`.
 */
export type StaffGlyph = {
  symbolId: string;
  kind: 'direction' | 'turn';
  column: ColumnId;
  x: number;
  y: number;
  w: number;
  h: number;
  polygon: Point[];
  /** Level of a direction glyph. Null for a turn glyph. */
  level: Level | null;
  /** Rotation of a turn glyph, seen from above. Null for a direction glyph. */
  rotation: TurnSymbol['rotation'] | null;
  /** Amount of a turn glyph, as a fraction of a full turn. Null for a direction glyph. */
  amount: TurnSymbol['amount'] | null;
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
 * arm. Turn signs in support columns get turn glyphs.
 * @param score A valid score.
 * @param options `beatHeight` (default 24) and `columnWidth` (default 16).
 * @returns Columns, staff lines, bar lines, counts and glyphs, one glyph per symbol plus one per start cell.
 * @throws RangeError when a size is not positive, a symbol's column is unknown, or a symbol has a bad start or duration.
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

  /** Box of a glyph in its column, and the column's side. */
  const boxFor = (column: ColumnId, y0: number, h: number) => {
    const x = columnX.get(column);
    if (x === undefined) throw new RangeError(`layoutStaff: unknown column "${column}"`);
    const side = column.startsWith('left') ? 'left' : 'right';
    return { x, side, box: { x0: x, x1: x + w, y0, y1: y0 + h } } as const;
  };

  const glyphs: StaffGlyph[] = [];
  for (const [column, cell] of Object.entries(score.startPosition) as [ColumnId, NonNullable<Score['startPosition'][ColumnId]>][]) {
    const { x, side, box } = boxFor(column, 0, bh);
    glyphs.push({
      symbolId: `start:${column}`,
      kind: 'direction',
      column,
      x,
      y: 0,
      w,
      h: bh,
      polygon: glyphPolygon(cell.direction, side, box, centreX),
      level: cell.level,
      rotation: null,
      amount: null,
    });
  }
  for (const s of score.symbols) {
    if (s.start < 0 || s.duration <= 0) throw new RangeError(`layoutStaff: symbol "${s.id}" has a bad start or duration`);
    const { x, side, box } = boxFor(s.column, y(s.start), s.duration * bh);
    const h = s.duration * bh;
    if (isTurnSymbol(s)) {
      glyphs.push({
        symbolId: s.id,
        kind: 'turn',
        column: s.column,
        x,
        y: y(s.start),
        w,
        h,
        polygon: turnPolygon(s.rotation, side, box, centreX),
        level: null,
        rotation: s.rotation,
        amount: s.amount,
      });
    } else {
      glyphs.push({
        symbolId: s.id,
        kind: 'direction',
        column: s.column,
        x,
        y: y(s.start),
        w,
        h,
        polygon: glyphPolygon(s.direction, side, box, centreX),
        level: s.level,
        rotation: null,
        amount: null,
      });
    }
  }

  return { width, height, columns, lines, bars: barLines, counts, glyphs };
}
