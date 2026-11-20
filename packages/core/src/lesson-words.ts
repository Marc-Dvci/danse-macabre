import type { Cell, ColumnId, Direction, Level, Symbol, TurnSymbol } from './types';

/** Words for each direction. `place` has no direction word; see `gesturePhrase` and `supportPhrase`. */
export const DIRECTION_WORDS: Record<Exclude<Direction, 'place'>, string> = {
  forward: 'forward',
  backward: 'backward',
  left: 'to your left',
  right: 'to your right',
  'left-forward': 'forward and to your left',
  'right-forward': 'forward and to your right',
  'left-backward': 'backward and to your left',
  'right-backward': 'backward and to your right',
};

export const LEVEL_WORDS: Record<Level, string> = { high: 'high', middle: 'middle', low: 'low' };

/**
 * Support level in words. A support at middle level is a normal step, so it has no level words (requirement 1.5).
 */
export const SUPPORT_LEVEL_WORDS: Record<'low' | 'high', string> = {
  low: 'knees bent',
  high: 'on the balls of your feet',
};

/** Amount of a turn in words. */
export const TURN_AMOUNT_WORDS: Record<TurnSymbol['amount'], string> = {
  0.25: 'a quarter',
  0.5: 'a half',
  0.75: 'three quarters',
  1: 'a full turn',
};

/** Rotation of a turn in words, seen from above. */
export const TURN_ROTATION_WORDS: Record<TurnSymbol['rotation'], string> = { cw: 'clockwise', ccw: 'counter-clockwise' };

/** Order of symbols that start on the same beat: supports, legs, then arms; left before right. */
export const LESSON_COLUMN_ORDER: readonly ColumnId[] = [
  'left-support',
  'right-support',
  'left-leg',
  'right-leg',
  'left-arm',
  'right-arm',
];

/** Body part in words: `left-arm` becomes `left arm`, `right-support` becomes `right foot`. */
export function bodyPart(column: ColumnId): string {
  return column.replace('support', 'foot').replace('-', ' ');
}

function isArmColumn(column: ColumnId): boolean {
  return column.endsWith('-arm');
}

/** Phrase for a gesture cell (arm or leg column). Throws for `place middle`, which is not a gesture. */
function gesturePhrase(column: ColumnId, cell: Cell): string {
  const part = bodyPart(column);
  if (cell.direction === 'place') {
    if (cell.level === 'high') return `${part} moves straight up`;
    if (cell.level === 'low') return isArmColumn(column) ? `${part} moves down by your side` : `${part} moves straight down`;
    throw new RangeError(`lesson: "place middle" is not a gesture (${column})`);
  }
  const verb = isArmColumn(column) ? 'moves' : 'lifts';
  return `${part} ${verb} ${DIRECTION_WORDS[cell.direction]}, ${LEVEL_WORDS[cell.level]}`;
}

/** Phrase for a support cell (a step onto one foot). Middle level has no level words. */
function supportPhrase(column: ColumnId, cell: Cell): string {
  const side = column.startsWith('left') ? 'left' : 'right';
  const move = cell.direction === 'place' ? 'in place' : DIRECTION_WORDS[cell.direction];
  const level = cell.level === 'middle' ? '' : `, ${SUPPORT_LEVEL_WORDS[cell.level]}`;
  return `step ${move} on the ${side} foot${level}`;
}

/**
 * Phrase for one cell in one column, without the duration. Used for symbols and for the starting position.
 * @param column Column the cell is written in.
 * @param cell Direction and level.
 * @returns Words such as `right arm moves forward, high` or `step forward on the left foot, knees bent`.
 */
export function cellPhrase(column: ColumnId, cell: Cell): string {
  return column.endsWith('support') ? supportPhrase(column, cell) : gesturePhrase(column, cell);
}

/**
 * Phrase for a turn sign, without the duration: `turn a quarter clockwise on the right foot`.
 * @param symbol Turn symbol. Its column gives the foot.
 */
export function turnPhrase(symbol: TurnSymbol): string {
  const side = symbol.column.startsWith('left') ? 'left' : 'right';
  return `turn ${TURN_AMOUNT_WORDS[symbol.amount]} ${TURN_ROTATION_WORDS[symbol.rotation]} on the ${side} foot`;
}

/**
 * Duration in words, as a dancer says it: `over half a count`, `over 1 count`, `over a count and a half`,
 * `over 2 counts`, `over 2 and a half counts`. Durations are whole or half counts.
 */
export function durationPhrase(beats: number): string {
  if (beats === 0.5) return 'over half a count';
  if (beats === 1) return 'over 1 count';
  if (beats === 1.5) return 'over a count and a half';
  const whole = Math.floor(beats);
  if (beats - whole === 0.5) return `over ${whole} and a half counts`;
  return `over ${beats} counts`;
}

/** Inverse of `durationPhrase` for its text after "over ". Returns null when the words are not a duration. */
export function parseDurationWords(words: string): number | null {
  if (words === 'half a count') return 0.5;
  if (words === 'a count and a half') return 1.5;
  let m = /^(\d+) and a half counts$/.exec(words);
  if (m) return Number(m[1]) + 0.5;
  m = /^(\d+(?:\.\d+)?) counts?$/.exec(words);
  return m ? Number(m[1]) : null;
}

/**
 * Phrase for a symbol with its duration, for example `right arm moves forward, high, over 2 counts`.
 * @param symbol Direction or turn symbol to describe.
 */
export function symbolPhrase(symbol: Symbol): string {
  const body =
    symbol.kind === 'turn'
      ? turnPhrase(symbol)
      : cellPhrase(symbol.column, { direction: symbol.direction, level: symbol.level });
  return `${body}, ${durationPhrase(symbol.duration)}`;
}
