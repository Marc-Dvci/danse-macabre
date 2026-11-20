// Property tests for supports-and-turns: mirroring (Requirement 4.3) and the mirror involution for scores with turns.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mirrorFrames, mirrorScore, notateSupports, perform } from '../src/index';
import { runOptions } from './generators';
import { genStepScore, genStepTurnScore, supportTuples } from './supports-generators';

const RUNS = runOptions(200);

describe('Requirement 4.3: mirror of steps', () => {
  it('notateSupports(mirrorFrames(perform(s))) has the support symbols of mirrorScore(s)', () => {
    fc.assert(
      fc.property(genStepScore, (s) => {
        const got = notateSupports(mirrorFrames(perform(s)), { tempo: s.tempo, grid: s.grid });
        expect(supportTuples(got)).toEqual(supportTuples(mirrorScore(s).symbols));
      }),
      RUNS,
    );
  });

  it('the same holds for scores with turns, where a cw turn becomes ccw', () => {
    fc.assert(
      fc.property(genStepTurnScore, (s) => {
        const got = notateSupports(mirrorFrames(perform(s)), { tempo: s.tempo, grid: s.grid });
        expect(supportTuples(got)).toEqual(supportTuples(mirrorScore(s).symbols));
      }),
      RUNS,
    );
  });

  it('without the level, the mirrored steps and turns match', () => {
    fc.assert(
      fc.property(genStepTurnScore, (s) => {
        const got = notateSupports(mirrorFrames(perform(s)), { tempo: s.tempo, grid: s.grid });
        expect(supportTuples(got, false)).toEqual(supportTuples(mirrorScore(s).symbols, false));
      }),
      RUNS,
    );
  });
});

describe('mirror is an involution for scores with turns', () => {
  it('mirrorScore(mirrorScore(s)) equals s', () => {
    fc.assert(
      fc.property(genStepTurnScore, (s) => {
        expect(mirrorScore(mirrorScore(s))).toEqual(s);
      }),
      RUNS,
    );
  });
});
