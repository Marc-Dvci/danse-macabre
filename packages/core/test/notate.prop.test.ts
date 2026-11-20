import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { notateGestures, performGestures, validateScore, type NotateOptions, type Score } from '../src/index';
import { genArmSprintScore, genGestureScore, genRandomFrames } from './generators';

const RUNS = { numRuns: 200 };

function notateOptions(s: Score): NotateOptions {
  return { tempo: s.tempo, beatsPerBar: s.beatsPerBar, grid: s.grid, title: s.title };
}

describe('generators produce valid scores (precondition of 7.5)', () => {
  it('genGestureScore and genArmSprintScore pass validateScore', () => {
    fc.assert(
      fc.property(fc.oneof(genGestureScore, genArmSprintScore), (s) => {
        expect(validateScore(s)).toEqual({ ok: true });
      }),
      RUNS,
    );
  });
});

describe('property 7.7: every notated score is valid', () => {
  it('validateScore(notateGestures(performGestures(s))) is ok', () => {
    fc.assert(
      fc.property(genGestureScore, (s) => {
        const out = notateGestures(performGestures(s), notateOptions(s));
        expect(validateScore(out)).toEqual({ ok: true });
      }),
      RUNS,
    );
  });

  it('validateScore(notateGestures(frames)) is ok for arbitrary frames', () => {
    fc.assert(
      fc.property(genRandomFrames, (frames) => {
        const out = notateGestures(frames, { tempo: 90, beatsPerBar: 4, grid: 0.5, title: 'random' });
        expect(validateScore(out)).toEqual({ ok: true });
      }),
      RUNS,
    );
  });
});
