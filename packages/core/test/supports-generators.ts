// Generators for the supports-and-turns property tests. Not a test file (no ".test." in the name).
// A generated score alternates feet. Step k lasts `dur` grid units and starts `gap` units after step k − 1 ends. A turn
// sign in the column of step k runs from the end of step k to the end of step k + 1, so the foot of step k stays down
// while the other foot steps. Scores are valid by construction: no two symbols in one column overlap.
import fc from 'fast-check';
import {
  DIRECTIONS,
  LEVELS,
  type ColumnId,
  type DirectionSymbol,
  type Direction,
  type Level,
  type Score,
  type Symbol,
  type TurnSymbol,
} from '../src/index';

/** Grid unit of the generated scores, in beats. */
export const SUPPORT_GRID = 0.5;

type Rotation = 'cw' | 'ccw';
type Amount = 0.25 | 0.5 | 0.75 | 1;

type StepSpec = {
  dur: number;
  gap: number;
  direction: Direction;
  level: Level;
  turn: { rotation: Rotation; amount: Amount } | null;
};

const arbAmount: fc.Arbitrary<Amount> = fc.constantFrom(0.25 as Amount, 0.5 as Amount, 0.75 as Amount, 1 as Amount);

function arbStep(withTurns: boolean): fc.Arbitrary<StepSpec> {
  const turn = withTurns
    ? fc.option(
        fc.record({ rotation: fc.constantFrom<Rotation>('cw', 'ccw'), amount: arbAmount }),
        { nil: null },
      )
    : fc.constant(null);
  return fc.record({
    dur: fc.integer({ min: 2, max: 6 }),
    gap: fc.integer({ min: 0, max: 2 }),
    direction: fc.constantFrom(...DIRECTIONS),
    level: fc.constantFrom(...LEVELS),
    turn,
  });
}

/** Builds the score from the plan. Ids are `${column}-${n}` in time order within each column. */
function build(tempo: number, lead: number, firstFoot: 'left' | 'right', steps: StepSpec[]): Score {
  const other = (f: 'left' | 'right') => (f === 'left' ? 'right' : 'left');
  const placed: { foot: 'left' | 'right'; start: number; end: number; spec: StepSpec }[] = [];
  let cursor = lead;
  steps.forEach((spec, i) => {
    if (i > 0) cursor += spec.gap;
    const foot = i % 2 === 0 ? firstFoot : other(firstFoot);
    const start = cursor;
    cursor += spec.dur;
    placed.push({ foot, start, end: cursor, spec });
  });

  const raw: Symbol[] = [];
  placed.forEach((p, i) => {
    raw.push({
      id: '',
      column: `${p.foot}-support`,
      start: p.start * SUPPORT_GRID,
      duration: (p.end - p.start) * SUPPORT_GRID,
      direction: p.spec.direction,
      level: p.spec.level,
    } as DirectionSymbol);
    const next = placed[i + 1];
    if (p.spec.turn && next) {
      raw.push({
        id: '',
        kind: 'turn',
        column: `${p.foot}-support`,
        start: p.end * SUPPORT_GRID,
        duration: (next.end - p.end) * SUPPORT_GRID,
        rotation: p.spec.turn.rotation,
        amount: p.spec.turn.amount,
      } as TurnSymbol);
    }
  });

  const counters = new Map<ColumnId, number>();
  const symbols = raw
    .sort((a, b) => a.start - b.start || (a.column < b.column ? -1 : 1))
    .map((s): Symbol => {
      const n = counters.get(s.column) ?? 0;
      counters.set(s.column, n + 1);
      return { ...s, id: `${s.column}-${n}` } as Symbol;
    });

  return { version: 1, title: 'generated supports', tempo, beatsPerBar: 4, grid: SUPPORT_GRID, startPosition: {}, symbols };
}

function arbScore(withTurns: boolean): fc.Arbitrary<Score> {
  return fc
    .record({
      tempo: fc.integer({ min: 60, max: 180 }),
      lead: fc.integer({ min: 1, max: 3 }),
      firstFoot: fc.constantFrom<'left' | 'right'>('left', 'right'),
      steps: fc.array(arbStep(withTurns), { minLength: 2, maxLength: 8 }),
    })
    .map(({ tempo, lead, firstFoot, steps }) => build(tempo, lead, firstFoot, steps));
}

/** Step scores with no turn signs: alternating feet, every direction, every level (property-test inputs). */
export const genStepScore: fc.Arbitrary<Score> = arbScore(false);

/** Step scores that also carry turn signs in the pivot foot's column (property-test inputs). */
export const genStepTurnScore: fc.Arbitrary<Score> = arbScore(true);

/**
 * Comparable form of a symbol: column, start, duration and content, without the id. Two symbol lists are equal when
 * their sorted tuples are equal.
 */
export function supportTuples(symbols: readonly Symbol[], withLevel = true): string[] {
  return symbols
    .filter((s) => s.column === 'left-support' || s.column === 'right-support')
    .map((s) =>
      s.kind === 'turn'
        ? `${s.column}|${s.start}|${s.duration}|turn|${s.rotation}|${s.amount}`
        : withLevel
          ? `${s.column}|${s.start}|${s.duration}|${s.direction}|${s.level}`
          : `${s.column}|${s.start}|${s.duration}|${s.direction}`,
    )
    .sort();
}
