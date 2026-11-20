// Property tests for the spoken lesson: Requirement 4.1 (round trip) and 4.2 (every word comes from a symbol).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { describe as describeLesson, parseLesson, type ColumnId, type LessonLine, type Score } from '../src/index';
import { DIRECTION_WORDS, LESSON_COLUMN_ORDER, parseDurationWords } from '../src/lesson-words';
import { runOptions } from './generators';
import { genScore } from './lesson-generators';

const RUNS = 200;

function lessonRank(column: string): number {
  return LESSON_COLUMN_ORDER.indexOf(column as (typeof LESSON_COLUMN_ORDER)[number]);
}

/** Sorts symbols by start, then by the order in which `describe` writes them. */
function reading<T extends { start: number; column: string }>(symbols: readonly T[]): T[] {
  return [...symbols].sort((a, b) => a.start - b.start || lessonRank(a.column) - lessonRank(b.column));
}

describe('Requirement 4.1: lesson round trip', () => {
  it('parseLesson(describe(s)) equals the symbols of s (column, start, duration, direction, level, turn)', () => {
    fc.assert(
      fc.property(genScore, (score) => {
        const parsed = parseLesson(describeLesson(score));
        const expected = reading(score.symbols).map((s) =>
          s.kind === 'turn'
            ? {
                column: s.column,
                start: s.start,
                duration: s.duration,
                direction: null,
                level: null,
                turn: { rotation: s.rotation, amount: s.amount },
              }
            : {
                column: s.column,
                start: s.start,
                duration: s.duration,
                direction: s.direction,
                level: s.level,
                turn: null,
              },
        );
        expect(parsed).toEqual(expected);
      }),
      runOptions(RUNS),
    );
  });
});

// Words that name a direction, side, body part or level, as they appear in lesson text.
const TOKEN_RE = /\b(left|right|arms?|legs?|foot|forward|backward|high|middle|low)\b/g;
// Turn words: the rotation and the amount. `counter-clockwise` is listed first so it is not read as `clockwise`.
const TURN_TOKEN_RE = /\b(counter-clockwise|clockwise|a quarter|three quarters|a half|a full turn)\b/g;
const NUMBER_RE = /\b\d+(?:\.\d+)?\b/g;
// Durations as the lesson says them; they are checked as durations and removed before the word checks.
const DURATION_PHRASE_RE = /, over (half a count|a count and a half|\d+ and a half counts|\d+(?:\.\d+)? counts?)/g;

/** Turn words that a turn symbol with this rotation may contribute. */
const TURN_WORDS_OF_ROTATION: Record<'cw' | 'ccw', string[]> = { cw: ['clockwise'], ccw: ['counter-clockwise'] };
/** Turn words that a turn symbol with this amount may contribute. */
const TURN_WORDS_OF_AMOUNT: Record<number, string[]> = {
  0.25: ['a quarter'],
  0.5: ['a half'],
  0.75: ['three quarters'],
  1: ['a full turn'],
};

/** Tokens a score element may contribute to a line. Keys are the ids used in `symbolIds`. */
function allowedFor(score: Score, id: string): { tokens: Set<string>; numbers: Set<string> } {
  const tokens = new Set<string>();
  const numbers = new Set<string>();
  if (id === 'score') {
    numbers.add(String(score.beatsPerBar));
    numbers.add(String(score.tempo));
    return { tokens, numbers };
  }
  const addCell = (column: string, direction: string, level: string) => {
    const side = column.startsWith('left') ? 'left' : 'right';
    const part = column.endsWith('arm') ? 'arm' : column.endsWith('leg') ? 'leg' : 'foot';
    tokens.add(side);
    tokens.add(part);
    tokens.add(level);
    if (direction !== 'place') {
      for (const word of DIRECTION_WORDS[direction as keyof typeof DIRECTION_WORDS].split(' ')) {
        if (['forward', 'backward', 'left', 'right'].includes(word)) tokens.add(word);
      }
    }
  };
  if (id.startsWith('start:')) {
    const column = id.slice('start:'.length) as ColumnId;
    const cell = score.startPosition[column];
    if (cell) addCell(column, cell.direction, cell.level);
    return { tokens, numbers };
  }
  const s = score.symbols.find((x) => x.id === id);
  if (s?.kind === 'turn') {
    tokens.add(s.column.startsWith('left') ? 'left' : 'right');
    tokens.add('foot');
    TURN_WORDS_OF_ROTATION[s.rotation].forEach((w) => tokens.add(w));
    TURN_WORDS_OF_AMOUNT[s.amount]!.forEach((w) => tokens.add(w));
    numbers.add(String(s.duration));
  } else if (s) {
    addCell(s.column, s.direction, s.level);
    numbers.add(String(s.duration));
  }
  return { tokens, numbers };
}

describe('Requirement 4.2: every word comes from a symbol', () => {
  it('every direction, side, body part, level, turn word and count in a line belongs to the symbols in its symbolIds', () => {
    fc.assert(
      fc.property(genScore, (score) => {
        for (const line of describeLesson(score)) {
          checkLine(score, line);
        }
      }),
      runOptions(RUNS),
    );
  });
});

/** Checks one line. Words are matched as whole words and numbers as whole numbers, so "forward" never matches "for". */
function checkLine(score: Score, line: LessonLine): void {
  const tokens = new Set<string>();
  const numbers = new Set<string>();
  for (const id of line.symbolIds) {
    const a = allowedFor(score, id);
    a.tokens.forEach((t) => tokens.add(t));
    a.numbers.forEach((n) => numbers.add(n));
  }
  if (line.beat !== null) {
    // The count and bar come from the line's own beat, so they are allowed.
    numbers.add(String(line.count));
    numbers.add(String(line.bar));
  }
  // Each duration must be the duration of a symbol in this line. Removing durations first keeps "a count and a half"
  // from being read as the turn amount "a half".
  const durations = new Set<number>();
  for (const id of line.symbolIds) {
    const s = score.symbols.find((x) => x.id === id);
    if (s) durations.add(s.duration);
  }
  const text = line.text.replace(DURATION_PHRASE_RE, (_all, words: string) => {
    const d = parseDurationWords(words);
    if (d === null || !durations.has(d)) throw new Error(`duration without a symbol "${words}" in "${line.text}"`);
    return '';
  });
  // Start and metre lines: the start text names only the start cells, and the metre line names only score fields.
  for (const m of text.matchAll(TOKEN_RE)) {
    const word = m[1]!.replace(/^arms$/, 'arm').replace(/^legs$/, 'leg');
    if (!tokens.has(word)) throw new Error(`word without a symbol "${word}" in "${line.text}" (symbolIds ${line.symbolIds.join(',')})`);
  }
  for (const m of text.matchAll(TURN_TOKEN_RE)) {
    if (!tokens.has(m[1]!)) throw new Error(`turn word without a symbol "${m[1]}" in "${line.text}" (symbolIds ${line.symbolIds.join(',')})`);
  }
  for (const m of text.matchAll(NUMBER_RE)) {
    if (!numbers.has(m[0])) throw new Error(`number without a symbol "${m[0]}" in "${line.text}" (symbolIds ${line.symbolIds.join(',')})`);
  }
}
