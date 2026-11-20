import { describe, expect, it } from 'vitest';
import { cellCenter, performGestures, WORLD_AXES, type Score } from '../src/index';

const score: Score = {
  version: 1,
  title: 'one move',
  tempo: 60,
  beatsPerBar: 4,
  grid: 0.5,
  startPosition: { 'right-arm': { direction: 'place', level: 'low' } },
  symbols: [{ id: 'r0', column: 'right-arm', start: 1, duration: 2, direction: 'right', level: 'middle' }],
};

describe('performGestures', () => {
  const frames = performGestures(score, { fps: 30 });

  it('runs from beat 0 to the end of the last symbol plus one beat', () => {
    // At 60 bpm one beat is one second. The last symbol ends at 3 s, so the clip ends at 4 s.
    expect(frames[0]!.t).toBe(0);
    expect(frames[frames.length - 1]!.t).toBeCloseTo(4, 9);
    expect(frames).toHaveLength(121);
  });

  it('holds the start cell before the symbol and the target cell after it', () => {
    const shoulder = frames[0]!.joints['right-shoulder'];
    const armLength = 0.6;
    const wristAt = (i: number) => frames[i]!.joints['right-wrist'];
    const down = cellCenter({ direction: 'place', level: 'low' }, WORLD_AXES);
    const right = cellCenter({ direction: 'right', level: 'middle' }, WORLD_AXES);
    // Frame 15 is at 0.5 s, before the move starts at 1 s.
    expect(wristAt(15).y).toBeCloseTo(shoulder.y + armLength * down.y, 9);
    // Frame 90 is at 3 s, the end of the move.
    expect(wristAt(90).x).toBeCloseTo(shoulder.x + armLength * right.x, 9);
    expect(wristAt(90).y).toBeCloseTo(shoulder.y + armLength * right.y, 9);
    expect(wristAt(120).x).toBeCloseTo(shoulder.x + armLength * right.x, 9);
  });

  it('moves the limb at the midpoint of the symbol halfway along the arc', () => {
    // The arc from straight down to right (-x) is 90 degrees, so its midpoint is at 45 degrees: (-sin 45, -cos 45).
    const mid = frames[60]!.joints['right-wrist'];
    const shoulder = frames[0]!.joints['right-shoulder'];
    const s = Math.SQRT1_2;
    expect(mid.x - shoulder.x).toBeCloseTo(-0.6 * s, 9);
    expect(mid.y - shoulder.y).toBeCloseTo(-0.6 * s, 9);
  });
});
