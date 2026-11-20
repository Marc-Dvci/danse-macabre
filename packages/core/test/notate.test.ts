import { describe, expect, it } from 'vitest';
import { notateGestures, performGestures, validateScore, type Score } from '../src/index';

const options = { tempo: 60, beatsPerBar: 4, grid: 0.5, title: 'example' };

function score(symbols: Score['symbols'], startPosition: Score['startPosition']): Score {
  return { version: 1, title: 'example', tempo: 60, beatsPerBar: 4, grid: 0.5, startPosition, symbols };
}

describe('notateGestures', () => {
  it('writes one symbol for one arm move, with the move timing and cell', () => {
    const input = score(
      [{ id: 'r0', column: 'right-arm', start: 1, duration: 2, direction: 'right', level: 'middle' }],
      { 'right-arm': { direction: 'place', level: 'low' } },
    );
    const out = notateGestures(performGestures(input), options);
    expect(validateScore(out)).toEqual({ ok: true });
    expect(out.symbols).toHaveLength(1);
    const s = out.symbols[0]!;
    expect([s.column, s.start, s.duration, s.direction, s.level]).toEqual(['right-arm', 1, 2, 'right', 'middle']);
    expect(out.startPosition['right-arm']).toEqual({ direction: 'place', level: 'low' });
  });

  it('writes no symbol for a limb that stays in one cell', () => {
    const input = score([], { 'left-arm': { direction: 'forward', level: 'high' } });
    const out = notateGestures(performGestures(input), options);
    expect(out.symbols).toEqual([]);
  });

  it('does not write a leg move whose ankle stays on the floor', () => {
    // The leg goes from place high to place low. The lowest ankle is the floor, so the foot never lifts.
    const input = score(
      [{ id: 'l0', column: 'left-leg', start: 1, duration: 2, direction: 'place', level: 'low' }],
      { 'left-leg': { direction: 'place', level: 'high' } },
    );
    const out = notateGestures(performGestures(input), options);
    expect(out.symbols.filter((s) => s.column === 'left-leg')).toEqual([]);
  });
});
