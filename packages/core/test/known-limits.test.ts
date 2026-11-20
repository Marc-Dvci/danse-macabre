import { describe, expect, it } from 'vitest';
import { notateGestures, performGestures, type Score } from '../src/index';

/**
 * Pins a limit of the current rules, so the test fails when the rule changes. See design.md, "Known limits".
 *
 * A move that crosses cells. Requirement 4.4 writes one symbol per cell change that holds for minHold, so the transit
 * cells get symbols too. The symbol boundaries are speed minima between two cell changes. In a sweep with no rest
 * between those changes, the minimum lands on an edge of the range. Requirement 7.5 fails for this reason.
 */
const options = { tempo: 60, beatsPerBar: 4, grid: 0.5, title: 'limit' };

const sweep: Score = {
  version: 1,
  title: 'sweep',
  tempo: 60,
  beatsPerBar: 4,
  grid: 0.5,
  startPosition: { 'right-arm': { direction: 'place', level: 'low' } },
  symbols: [{ id: 'right-arm-0', column: 'right-arm', start: 1, duration: 2, direction: 'right', level: 'middle' }],
};

describe('known limit: a move that crosses cells', () => {
  it('writes a symbol for the transit cell right low, then for the target right middle', () => {
    const out = notateGestures(performGestures(sweep, { fps: 30 }), options);
    const arm = out.symbols.filter((s) => s.column === 'right-arm');
    expect(arm.map((s) => `${s.direction} ${s.level}`)).toEqual(['right low', 'right middle']);
  });

  it('places the target symbol at beat 2.5 for 0.5 beats, not at beat 1 for 2 beats', () => {
    const out = notateGestures(performGestures(sweep, { fps: 30 }), options);
    const target = out.symbols.filter((s) => s.column === 'right-arm')[1]!;
    expect([target.start, target.duration]).toEqual([2.5, 0.5]);
  });
});
