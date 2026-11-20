import { describe, expect, it } from 'vitest';
import { directionSymbols, notateGestures, performGestures, validateScore, type Frame, type Score } from '../src/index';

const options = { tempo: 60, beatsPerBar: 4, grid: 0.5, title: 'example' };

function score(symbols: Score['symbols'], startPosition: Score['startPosition']): Score {
  return { version: 1, title: 'example', tempo: 60, beatsPerBar: 4, grid: 0.5, startPosition, symbols };
}

describe('notateGestures', () => {
  it('writes one symbol for the cell the arm settles in, not for the cells it passes through (Requirement 4.4)', () => {
    // place low to right middle passes through right low (elevation -67.5 to -22.5). Only the settled cell is written,
    // from the start of the move to its end.
    const input = score(
      [{ id: 'r0', column: 'right-arm', start: 1, duration: 2, direction: 'right', level: 'middle' }],
      { 'right-arm': { direction: 'place', level: 'low' } },
    );
    const out = notateGestures(performGestures(input), options);
    expect(validateScore(out)).toEqual({ ok: true });
    const arm = directionSymbols(out).filter((s) => s.column === 'right-arm');
    expect(arm.map((s) => [s.direction, s.level, s.start, s.duration])).toEqual([['right', 'middle', 1, 2]]);
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
    const legs = directionSymbols(out).filter((s) => s.column === 'left-leg');
    expect(legs.some((s) => s.direction === 'place' && s.level === 'low')).toBe(false);
  });

  it('writes a leg symbol when the foot leaves the floor and is in the air at the end of the move (Requirement 2.1)', () => {
    // The left leg starts on the floor (place low) and moves to forward high, a kick. The rising part is near the floor,
    // so the old rule (every frame of the move lifted) dropped the symbol. The end of the move is in the air, so the
    // symbol is written.
    const input = score(
      [{ id: 'l0', column: 'left-leg', start: 1, duration: 2, direction: 'forward', level: 'high' }],
      { 'left-leg': { direction: 'place', level: 'low' } },
    );
    const out = notateGestures(performGestures(input), options);
    const legs = directionSymbols(out).filter((s) => s.column === 'left-leg');
    expect(legs.map((s) => [s.direction, s.level])).toEqual([['forward', 'high']]);
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

/** Frames for a dancer whose right wrist is at forward, at the elevation given per frame. Other joints are fixed. */
function armAtElevation(elevationOf: (k: number) => number, count: number): Frame[] {
  const frames: Frame[] = [];
  for (let k = 0; k < count; k++) {
    const e = (elevationOf(k) * Math.PI) / 180;
    const rightShoulder = { x: -0.2, y: 1.42, z: 0 };
    const rightWrist = { x: -0.2, y: 1.42 + 0.6 * Math.sin(e), z: 0.6 * Math.cos(e) };
    frames.push({
      t: k / 30,
      joints: {
        pelvis: { x: 0, y: 0.95, z: 0 },
        'left-hip': { x: 0.1, y: 0.95, z: 0 },
        'right-hip': { x: -0.1, y: 0.95, z: 0 },
        'left-knee': { x: 0.1, y: 0.5, z: 0 },
        'right-knee': { x: -0.1, y: 0.5, z: 0 },
        'left-ankle': { x: 0.1, y: 0.05, z: 0 },
        'right-ankle': { x: -0.1, y: 0.05, z: 0 },
        'left-shoulder': { x: 0.2, y: 1.42, z: 0 },
        'right-shoulder': rightShoulder,
        'left-elbow': { x: 0.4, y: 1.2, z: 0 },
        'right-elbow': { x: -0.4, y: 1.2, z: 0 },
        'left-wrist': { x: 0.2, y: 0.82, z: 0 },
        'right-wrist': rightWrist,
        neck: { x: 0, y: 1.45, z: 0 },
        head: { x: 0, y: 1.6, z: 0 },
      },
    });
  }
  return frames;
}

describe('notateGestures hysteresis (Requirement 4.8)', () => {
  // The right wrist alternates every 0.5 s between 21 and 24 degrees of elevation. The middle/high boundary is at 22.5.
  // Both readings are within 4 degrees of it, so a limb held there keeps its cell.
  const frames = armAtElevation((k) => (Math.floor(k / 15) % 2 === 0 ? 21 : 24), 180);

  it('keeps the held cell for a limb resting within the hysteresis width of a boundary', () => {
    const out = notateGestures(frames, { ...options, hysteresis: 4 });
    expect(validateScore(out)).toEqual({ ok: true });
    expect(directionSymbols(out).filter((s) => s.column === 'right-arm')).toEqual([]);
    expect(out.startPosition['right-arm']).toEqual({ direction: 'forward', level: 'middle' });
  });

  it('writes the changes when the hysteresis is 0, so the test above depends on the rule', () => {
    const out = notateGestures(frames, { ...options, hysteresis: 0 });
    expect(directionSymbols(out).filter((s) => s.column === 'right-arm').length).toBeGreaterThan(0);
  });
});
