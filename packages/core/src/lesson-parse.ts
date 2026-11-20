import type { LessonLine } from './lesson';
import { DIRECTION_WORDS, LEVEL_WORDS, SUPPORT_LEVEL_WORDS } from './lesson-words';
import type { ColumnId, Direction, Level } from './types';

/**
 * A symbol recovered from lesson text. `turn` is always null: the current score model has no turn symbols
 * (see `design.md` in `lesson-search-layout`).
 */
export type LessonSymbol = {
  column: ColumnId;
  start: number;
  duration: number;
  direction: Direction;
  level: Level;
  turn: null;
};

const METRE_RE = /^(\d+) counts per bar, \S+ counts per minute\.$/;
const BEAT_RE = /^(?:Bar (\d+), )?[Cc]ount (\d+)( and)?: (.+)\.$/;
const DURATION_RE = /, over (\d+(?:\.\d+)?) counts?$/;
const SUPPORT_RE = /^step (.+) on the (left|right) foot, (knees bent|standing normally|on the balls of your feet)$/;
const GESTURE_RE = /^(left|right) (arm|leg) (?:moves|lifts) (.+)$/;

const DIRECTION_FROM_WORD = new Map<string, Direction>(
  (Object.entries(DIRECTION_WORDS) as [Direction, string][]).map(([d, w]) => [w, d]),
);
const LEVEL_FROM_WORD = new Map<string, Level>((Object.entries(LEVEL_WORDS) as [Level, string][]).map(([l, w]) => [w, l]));
const SUPPORT_LEVEL_FROM_WORD = new Map<string, Level>(
  (Object.entries(SUPPORT_LEVEL_WORDS) as [Level, string][]).map(([l, w]) => [w, l]),
);

function fail(message: string): never {
  throw new Error(`parseLesson: ${message}`);
}

function directionFromWord(word: string, phrase: string): Direction {
  const d = DIRECTION_FROM_WORD.get(word);
  if (d === undefined) fail(`unknown direction "${word}" in "${phrase}"`);
  return d;
}

/** Reads one phrase (no duration) into column, direction and level. */
function parsePhrase(phrase: string): { column: ColumnId; direction: Direction; level: Level } {
  const support = SUPPORT_RE.exec(phrase);
  if (support) {
    const column = `${support[2]}-support` as ColumnId;
    const level = SUPPORT_LEVEL_FROM_WORD.get(support[3]!)!;
    const move = support[1]!;
    const direction = move === 'in place' ? 'place' : directionFromWord(move, phrase);
    return { column, direction, level };
  }

  const gesture = GESTURE_RE.exec(phrase);
  if (gesture) {
    const column = `${gesture[1]}-${gesture[2]}` as ColumnId;
    const rest = gesture[3]!;
    if (rest === 'straight up') return { column, direction: 'place', level: 'high' };
    if (rest === 'down by your side' && gesture[2] === 'arm') return { column, direction: 'place', level: 'low' };
    if (rest === 'straight down' && gesture[2] === 'leg') return { column, direction: 'place', level: 'low' };
    const comma = rest.lastIndexOf(', ');
    if (comma < 0) fail(`no level in "${phrase}"`);
    const direction = directionFromWord(rest.slice(0, comma), phrase);
    const level = LEVEL_FROM_WORD.get(rest.slice(comma + 2));
    if (level === undefined) fail(`unknown level in "${phrase}"`);
    return { column, direction, level };
  }

  return fail(`unknown phrase "${phrase}"`);
}

/**
 * Recovers the symbols from the lesson text. Only `text` is read. The beat of each symbol comes from the bar and count
 * in the text, and the beats per bar come from the metre line. Start and metre lines are skipped.
 * @param lines Lines from `describe`, or lines written in the same form.
 * @returns Symbols in reading order (time, then the order of `describe`). Ids are not in the text, so they are absent.
 * @throws Error when the metre line is missing, a beat line comes before any bar is named, or a phrase is unknown.
 */
export function parseLesson(lines: readonly LessonLine[]): LessonSymbol[] {
  let bpb: number | null = null;
  for (const line of lines) {
    const m = METRE_RE.exec(line.text);
    if (m) {
      bpb = Number(m[1]);
      break;
    }
  }
  if (bpb === null) fail('no metre line ("<n> counts per bar, <t> counts per minute.")');

  const out: LessonSymbol[] = [];
  let bar: number | null = null;
  for (const line of lines) {
    const m = BEAT_RE.exec(line.text);
    if (!m) continue;
    if (m[1] !== undefined) bar = Number(m[1]);
    if (bar === null) fail(`beat line before any bar is named: "${line.text}"`);
    const count = Number(m[2]);
    if (count < 1 || count > bpb) fail(`count ${count} outside 1..${bpb} in "${line.text}"`);
    const start = (bar - 1) * bpb + (count - 1) + (m[3] ? 0.5 : 0);

    for (const segment of m[4]!.split('; ')) {
      const dur = DURATION_RE.exec(segment);
      if (!dur) fail(`no duration in "${segment}"`);
      const phrase = segment.slice(0, dur.index);
      const cell = parsePhrase(phrase);
      out.push({ ...cell, start, duration: Number(dur[1]), turn: null });
    }
  }
  return out;
}
