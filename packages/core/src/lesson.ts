import { cellPhrase, LESSON_COLUMN_ORDER, symbolPhrase } from './lesson-words';
import { directionSymbols } from './symbol';
import type { Cell, ColumnId, DirectionSymbol, Score } from './types';

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

function startLine(score: Score): LessonLine {
  const sp = score.startPosition;
  const armsDown = (['left-arm', 'right-arm'] as const).every((c) => {
    const cell = sp[c];
    return cell !== undefined && cell.direction === 'place' && cell.level === 'low';
  });
  const clauses: string[] = [];
  const ids: string[] = [];
  if (armsDown) {
    clauses.push('arms down by your sides');
    ids.push('start:left-arm', 'start:right-arm');
  }
  for (const column of LESSON_COLUMN_ORDER) {
    const cell: Cell | undefined = sp[column];
    if (!cell || (armsDown && column.endsWith('-arm'))) continue;
    clauses.push(cellPhrase(column, cell));
    ids.push(`start:${column}`);
  }
  const text = clauses.length > 0 ? `Start standing, ${clauses.join(', ')}.` : 'Start standing.';
  return { beat: null, count: null, bar: null, text, symbolIds: ids };
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
 * bar from 1, writes `and` for a half beat, and joins the symbols that start on that beat with `; `.
 * @param score A valid score. Half-beat starts only.
 * @returns Lesson lines in reading order.
 * @throws RangeError when `beatsPerBar` is not a positive integer or a symbol starts off the half-beat grid.
 */
export function describe(score: Score): LessonLine[] {
  const bpb = score.beatsPerBar;
  if (!Number.isInteger(bpb) || bpb < 1) throw new RangeError(`describe: beatsPerBar must be a positive integer, got ${bpb}`);

  const lines: LessonLine[] = [startLine(score), metreLine(score)];

  const sorted = directionSymbols(score).sort(
    (a, b) => a.start - b.start || columnRank(a.column) - columnRank(b.column) || (a.id < b.id ? -1 : 1),
  );
  const groups: { beat: number; symbols: DirectionSymbol[] }[] = [];
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
