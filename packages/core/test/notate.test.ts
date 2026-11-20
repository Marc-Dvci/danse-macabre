import { describe, expect, it } from 'vitest';
import { notateGestures, performGestures, validateScore, type Frame, type Score } from '../src/index';

const options = { tempo: 60, beatsPerBar: 4, grid: 0.5, title: 'example' };

function score(symbols: Score['symbols'], startPosition: Score['startPosition']): Score {
  return { version: 1, title: 'example', tempo: 60, beatsPerBar: 4, grid: 0.5, startPosition, symbols };
}

describe('notateGestures', () => {
  it('writes a symbol for each cell the arm enters for at least minHold (Known limit 1)', () => {
    // place low to right middle sweeps through right low (elevation -67.5 to -22.5), which holds for well over 0.12 s.
    const input = score(
      [{ id: 'r0', column: 'right-arm', start: 1, duration: 2, direction: 'right', level: 'middle' }],
      { 'right-arm': { direction: 'place', level: 'low' } },
    );
    const out = notateGestures(performGestures(input), options);
    expect(validateScore(out)).toEqual({ ok: true });
    const arm = out.symbols.filter((s) => s.column === 'right-arm');
    expect(arm.map((s) => [s.direction, s.level])).toEqual([
      ['right', 'low'],
      ['right', 'middle'],
    ]);
    expect(out.startPosition['right-arm']).toEqual({ direction: 'place', level: 'low' });
  });

  it('writes no symbol for a limb that stays in one cell', () => {
    const input = score([], { 'left-arm': { direction: 'forward', level: 'high' } });
    const out = notateGestures(performGestures(input), options);
    expect(out.symbols).toEqual([]);
  });

  it('does not write a place-low leg symbol for a move that ends on the floor (Requirement 4.7)', () => {
    // The left leg goes from place high down to place low. Cells in the air (forward high, forward middle) are written,
    // because the ankle is above the other ankle. The final place-low cell is on the floor, so it is not written.
    const input = score(
      [{ id: 'l0', column: 'left-leg', start: 1, duration: 2, direction: 'place', level: 'low' }],
      { 'left-leg': { direction: 'place', level: 'high' } },
    );
    const out = notateGestures(performGestures(input), options);
    const legs = out.symbols.filter((s) => s.column === 'left-leg');
    expect(legs.some((s) => s.direction === 'place' && s.level === 'low')).toBe(false);
  });

  it('ignores a cell that holds for less than minHold and keeps the held cell (Requirement 4.3)', () => {
    // The right wrist is at forward high for 3 s. For one frame (1/30 s, under 0.12 s) it is at right middle.
    const base = performGestures(
      score(
        // A left-arm move at beat 8 makes the clip long enough for the blips below. Only right-arm symbols are checked.
        [{ id: 'l0', column: 'left-arm', start: 8, duration: 2, direction: 'left', level: 'high' }],
        {
          'right-arm': { direction: 'forward', level: 'high' },
          'left-arm': { direction: 'forward', level: 'high' },
        },
      ),
      { fps: 30 },
    );
    const blip = (from: number, to: number): Frame[] =>
      base.map((f, k) => {
        if (k < from || k >= to) return f;
        const shoulder = f.joints['right-shoulder'];
        // Right is -x. Wrist at right middle is shoulder plus 0.6 m toward -x.
        const wrist = { x: shoulder.x - 0.6, y: shoulder.y, z: shoulder.z };
        return { t: f.t, joints: { ...f.joints, 'right-wrist': wrist } };
      });

    const oneFrame = notateGestures(blip(30, 31), options);
    expect(oneFrame.symbols.filter((s) => s.column === 'right-arm')).toEqual([]);

    // The same cell held for 0.5 s (15 frames) is longer than minHold, so it is written.
    const held = notateGestures(blip(30, 45), options);
    expect(held.symbols.filter((s) => s.column === 'right-arm')).toHaveLength(2);
  });
});
