import { describe, expect, it } from 'vitest';
import { mirrorFrames, mirrorScore, performGestures, retime, type Score } from '../src/index';

const score: Score = {
  version: 1,
  title: 'mirror',
  tempo: 60,
  beatsPerBar: 4,
  grid: 0.5,
  startPosition: { 'left-arm': { direction: 'left-forward', level: 'high' } },
  symbols: [
    { id: 'left-arm-0', column: 'left-arm', start: 1, duration: 1, direction: 'left', level: 'low' },
    { id: 'right-arm-0', column: 'right-arm', start: 3, duration: 1, direction: 'right-backward', level: 'middle' },
  ],
};

describe('mirrorScore', () => {
  it('swaps columns, direction names and id prefixes, and keeps timing and levels', () => {
    const m = mirrorScore(score);
    expect(m.startPosition['right-arm']).toEqual({ direction: 'right-forward', level: 'high' });
    expect(m.symbols).toEqual([
      { id: 'right-arm-0', column: 'right-arm', start: 1, duration: 1, direction: 'right', level: 'low' },
      { id: 'left-arm-0', column: 'left-arm', start: 3, duration: 1, direction: 'left-backward', level: 'middle' },
    ]);
  });
});

describe('mirrorFrames', () => {
  it('negates x and swaps left and right joints', () => {
    const f = performGestures(score)[0]!;
    const m = mirrorFrames([f])[0]!;
    expect(m.joints['left-wrist']).toEqual({ ...f.joints['right-wrist'], x: -f.joints['right-wrist'].x });
    expect(m.joints.pelvis).toEqual({ ...f.joints.pelvis, x: -f.joints.pelvis.x });
  });
});

describe('retime', () => {
  it('multiplies the tempo and keeps the beats', () => {
    const r = retime(score, 2);
    expect(r.tempo).toBe(120);
    expect(r.symbols).toEqual(score.symbols);
    expect(() => retime(score, 0)).toThrow(RangeError);
  });
});
