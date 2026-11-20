import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalScore, notateGestures, performGestures, type NotateOptions, type Score } from '../src/index';
import { genGestureScore, symbolTuples } from './generators';

const RUNS = { numRuns: 200 };

function notateOptions(s: Score): NotateOptions {
  return { tempo: s.tempo, beatsPerBar: s.beatsPerBar, grid: s.grid, title: s.title };
}

describe('property 7.5: round trip notate(perform(s)) keeps the symbols of s', () => {
  it('canonical symbols of notate(perform(s)) equal the canonical symbols of s', () => {
    fc.assert(
      fc.property(genGestureScore, (s) => {
        const out = canonicalScore(notateGestures(performGestures(s), notateOptions(s)));
        expect(symbolTuples(out)).toEqual(symbolTuples(canonicalScore(s)));
      }),
      RUNS,
    );
  });
});
