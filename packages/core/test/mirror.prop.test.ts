import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canonicalScore,
  mirrorFrames,
  mirrorScore,
  notateGestures,
  performGestures,
  type NotateOptions,
  type Score,
} from '../src/index';
import { genGestureScore } from './generators';

const RUNS = { numRuns: 200 };

function notateOptions(s: Score): NotateOptions {
  return { tempo: s.tempo, beatsPerBar: s.beatsPerBar, grid: s.grid, title: s.title };
}

describe('property 7.3: mirror is an involution', () => {
  it('mirrorScore(mirrorScore(s)) equals s', () => {
    fc.assert(
      fc.property(genGestureScore, (s) => {
        expect(mirrorScore(mirrorScore(s))).toEqual(s);
      }),
      RUNS,
    );
  });
});

describe('property 7.4: mirror commutes with notation', () => {
  it('notating mirrored frames equals mirroring the notated score', () => {
    fc.assert(
      fc.property(genGestureScore, (s) => {
        const frames = performGestures(s);
        const options = notateOptions(s);
        const lhs = canonicalScore(notateGestures(mirrorFrames(frames), options));
        const rhs = canonicalScore(mirrorScore(notateGestures(frames, options)));
        expect(lhs).toEqual(rhs);
      }),
      RUNS,
    );
  });
});
