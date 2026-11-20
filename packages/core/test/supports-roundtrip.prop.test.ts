// Property tests for supports-and-turns, Requirement 4.1 (steps) and 4.2 (steps and turns): notateSupports(perform(s))
// has the support and turn symbols of s. The inputs are generated scores (see supports-generators.ts).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { notateSupports, perform } from '../src/index';
import { runOptions } from './generators';
import { genStepScore, genStepTurnScore, supportTuples } from './supports-generators';

const RUNS = runOptions(200);

describe('Requirement 4.1: steps round trip', () => {
  it('notateSupports(perform(s)) has the same step symbols as s', () => {
    fc.assert(
      fc.property(genStepScore, (s) => {
        const got = notateSupports(perform(s), { tempo: s.tempo, grid: s.grid });
        expect(supportTuples(got)).toEqual(supportTuples(s.symbols));
      }),
      RUNS,
    );
  });

  it('without the level, the step symbols (column, start, duration, direction) round trip', () => {
    fc.assert(
      fc.property(genStepScore, (s) => {
        const got = notateSupports(perform(s), { tempo: s.tempo, grid: s.grid });
        expect(supportTuples(got, false)).toEqual(supportTuples(s.symbols, false));
      }),
      RUNS,
    );
  });
});

describe('Requirement 4.2: turns round trip', () => {
  it('notateSupports(perform(s)) has the same step and turn symbols as s', () => {
    fc.assert(
      fc.property(genStepTurnScore, (s) => {
        const got = notateSupports(perform(s), { tempo: s.tempo, grid: s.grid });
        expect(supportTuples(got)).toEqual(supportTuples(s.symbols));
      }),
      RUNS,
    );
  });

  it('without the level, the steps and turns round trip', () => {
    fc.assert(
      fc.property(genStepTurnScore, (s) => {
        const got = notateSupports(perform(s), { tempo: s.tempo, grid: s.grid });
        expect(supportTuples(got, false)).toEqual(supportTuples(s.symbols, false));
      }),
      RUNS,
    );
  });
});
