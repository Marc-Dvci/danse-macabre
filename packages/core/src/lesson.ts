import { cellPhrase, LESSON_COLUMN_ORDER, symbolPhrase } from './lesson-words';
import type { ColumnId, Direction, Level, Score, Symbol } from './types';

/**
 * One line of the spoken lesson. Beat lines have `beat`, `count` and `bar`. The start and metre lines have them set to
 * null. `symbolIds` lists the symbols the line speaks about. Start lines use `start:<column>` and the metre line uses
 * `score`.
 */
export type LessonLine = {
  beat: number | null;
  count: number | null;
  bar: number | null;
  text: string;
  symbolIds: string[];
};

/** Start cells that make up the standing position, in the order they are named. */
const STANDING_COLUMNS: readonly ColumnId[] = ['left-support', 'right-support', 'left-leg', 'right-leg'];
const ARM_COLUMNS: readonly ColumnId[] = ['left-arm', 'right-arm'];

/**
 * Start line (requirement 1.5). Both supports at `place middle`, with each leg at `place low` or not written, read as
 * standing on both feet. Both arms at `place low` read as arms down by the sides. Other start cells are named as symbols are.
 */
function startLine(score: Score): LessonLine {
  const sp = score.startPosition;
  const is = (column: ColumnId, direction: Direction, level: Level): boolean => {
    const cell = sp[column];
    return cell !== undefined && cell.direction === direction && cell.level === level;
  };
  // Standing: both supports in place at the same level; a leg either hangs straight down or is not written.
  const legDownOrUnwritten = (column: ColumnId): boolean => sp[column] === undefined || is(column, 'place', 'low');
  const standLevel = (['middle', 'high', 'low'] as const).find(
    (lv) => is('left-support', 'place', lv) && is('right-support', 'place', lv),
  );
  const standing = standLevel !== undefined && legDownOrUnwritten('left-leg') && legDownOrUnwritten('right-leg');
  const standingWords: Record<Level, string> = {
    middle: 'standing on both feet',
    high: 'standing on the balls of both feet',
    low: 'standing on both feet, knees bent',
  };
  const armsDown = ARM_COLUMNS.every((c) => is(c, 'place', 'low'));

  const items: string[] = [];
  const ids: string[] = [];
  if (standing) {
    items.push(standingWords[standLevel!]);
    ids.push(...STANDING_COLUMNS.filter((c) => sp[c] !== undefined).map((c) => `start:${c}`));
  }
  if (armsDown) {
    items.push('arms down by your sides');
    ids.push(...ARM_COLUMNS.map((c) => `start:${c}`));
  }
  for (const column of LESSON_COLUMN_ORDER) {
    const cell = sp[column];
    if (!cell) continue;
    if (standing && STANDING_COLUMNS.includes(column)) continue;
    if (armsDown && ARM_COLUMNS.includes(column)) continue;
    items.push(cellPhrase(column, cell));
    ids.push(`start:${column}`);
  }

  if (items.length === 0) return { beat: null, count: null, bar: null, text: 'Start position not written.', symbolIds: ids };
  const lead = standing ? 'Start' : 'Start with';
  return { beat: null, count: null, bar: null, text: `${lead} ${items.join(', ')}.`, symbolIds: ids };
}

function metreLine(score: Score): LessonLine {
  return {
    beat: null,
    count: null,
    bar: null,
    text: `${score.beatsPerBar} counts per bar, ${score.tempo} counts per minute.`,
    symbolIds: ['score'],
  };
}

function columnRank(column: ColumnId): number {
  return LESSON_COLUMN_ORDER.indexOf(column);
}

/**
 * Writes the score as a spoken lesson. Lines are: the starting position, the metre and tempo, then one line per beat at
 * which a symbol starts, in time order. A beat line names the bar when the bar changes, numbers the count within the
 * bar from 1, writes `and` for a half beat, and joins the symbols that start on that beat with `; `. Direction and turn
 * symbols are both written.
 * @param score A valid score. Half-beat starts only.
 * @returns Lesson lines in reading order.
 * @throws RangeError when `beatsPerBar` is not a positive integer or a symbol starts off the half-beat grid.
 */
export function describe(score: Score): LessonLine[] {
  const bpb = score.beatsPerBar;
  if (!Number.isInteger(bpb) || bpb < 1) throw new RangeError(`describe: beatsPerBar must be a positive integer, got ${bpb}`);

  const lines: LessonLine[] = [startLine(score), metreLine(score)];

  const sorted = [...score.symbols].sort(
    (a, b) => a.start - b.start || columnRank(a.column) - columnRank(b.column) || (a.id < b.id ? -1 : 1),
  );
  const groups: { beat: number; symbols: Symbol[] }[] = [];
  for (const s of sorted) {
    if (!Number.isInteger(s.start * 2)) {
      throw new RangeError(`describe: symbol "${s.id}" starts at ${s.start}, which is not on a half beat`);
    }
    const last = groups[groups.length - 1];
    if (last && last.beat === s.start) last.symbols.push(s);
    else groups.push({ beat: s.start, symbols: [s] });
  }

  let previousBar: number | null = null;
  for (const group of groups) {
    const bar = Math.floor(group.beat / bpb) + 1;
    const within = group.beat - (bar - 1) * bpb;
    const count = Math.floor(within) + 1;
    const label = `${count}${within % 1 === 0.5 ? ' and' : ''}`;
    const prefix = bar !== previousBar ? `Bar ${bar}, count ${label}: ` : `Count ${label}: `;
    const body = group.symbols.map(symbolPhrase).join('; ');
    lines.push({
      beat: group.beat,
      count,
      bar,
      text: `${prefix}${body}.`,
      symbolIds: group.symbols.map((s) => s.id),
    });
    previousBar = bar;
  }
  return lines;
}
