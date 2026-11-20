import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canonicalScore,
  cellCenter,
  notateGestures,
  performGestures,
  WORLD_AXES,
  type Frame,
  type Score,
} from '../src/index';
import { angleDeg } from '../src/vec';
import { genGestureScoreWith, symbolTuples } from './generators';

/** Peak angular speed of one limb (base joint to end joint), from frames at their own spacing. */
function peakSpeed(frames: Frame[], base: 'right-shoulder' | 'right-hip', end: 'right-wrist' | 'right-ankle'): number {
  let peak = 0;
  for (let k = 1; k < frames.length; k++) {
    const dt = frames[k]!.t - frames[k - 1]!.t;
    const p0 = frames[k - 1]!.joints;
    const p1 = frames[k]!.joints;
    const d0 = { x: p0[end].x - p0[base].x, y: p0[end].y - p0[base].y, z: p0[end].z - p0[base].z };
    const d1 = { x: p1[end].x - p1[base].x, y: p1[end].y - p1[base].y, z: p1[end].z - p1[base].z };
    peak = Math.max(peak, angleDeg(d0, d1) / dt);
  }
  return peak;
}

/**
 * Documents the limit found by property 7.5 in two places. These tests pin the current behaviour. If Requirements 4.4
 * or 4.7 change, update them.
 */
describe('known limit of Requirement 4.4 (speed threshold)', () => {
  const counterexample: Score = {
    version: 1,
    title: 'counterexample',
    tempo: 60,
    beatsPerBar: 4,
    grid: 0.5,
    startPosition: { 'right-arm': { direction: 'forward', level: 'high' } },
    symbols: [{ id: 'right-arm-0', column: 'right-arm', start: 0, duration: 1, direction: 'right-forward', level: 'high' }],
  };

  it('the move is 31.4 degrees between the two cell centres', () => {
    const a = cellCenter({ direction: 'forward', level: 'high' }, WORLD_AXES);
    const b = cellCenter({ direction: 'right-forward', level: 'high' }, WORLD_AXES);
    const angle = angleDeg(a, b);
    console.log(`counterexample angle: ${angle.toFixed(2)} degrees`);
    expect(angle).toBeCloseTo(31.4, 1);
  });

  it('the peak angular speed of the playback is below 60 deg/s, so notation writes no symbol', () => {
    const frames = performGestures(counterexample, { fps: 30 });
    const peak = peakSpeed(frames, 'right-shoulder', 'right-wrist');
    console.log(`counterexample peak angular speed (30 fps frames): ${peak.toFixed(2)} deg/s`);
    expect(peak).toBeLessThan(60);
    const out = canonicalScore(notateGestures(frames, { tempo: 60, beatsPerBar: 4, grid: 0.5, title: 'x' }));
    expect(symbolTuples(out)).toEqual([]);
  });
});

describe('known limit of Requirement 4.7 (lift rule uses the clip minimum)', () => {
  const legCase: Score = {
    version: 1,
    title: 'leg counterexample',
    tempo: 120,
    beatsPerBar: 4,
    grid: 0.5,
    startPosition: {
      'left-leg': { direction: 'forward', level: 'high' },
      'right-leg': { direction: 'forward', level: 'high' },
      'left-arm': { direction: 'forward', level: 'high' },
      'right-arm': { direction: 'forward', level: 'high' },
    },
    symbols: [{ id: 'right-leg-0', column: 'right-leg', start: 0, duration: 1, direction: 'right-forward', level: 'high' }],
  };

  it('the right ankle stays within 0.10 m of the clip minimum, so Requirement 4.7 counts the foot as on the floor', () => {
    const frames = performGestures(legCase, { fps: 30 });
    let min = Infinity;
    let max = -Infinity;
    for (const f of frames) {
      min = Math.min(min, f.joints['left-ankle'].y, f.joints['right-ankle'].y);
      max = Math.max(max, f.joints['right-ankle'].y);
    }
    console.log(`leg counterexample: clip min ankle y ${min.toFixed(3)} m, right ankle y ${max.toFixed(3)} m, margin ${(max - min).toFixed(3)} m`);
    expect(max - min).toBeLessThan(0.1);
    const out = canonicalScore(notateGestures(frames, { tempo: 120, beatsPerBar: 4, grid: 0.5, title: 'x' }));
    expect(symbolTuples(out).filter((s) => s.startsWith('right-leg'))).toEqual([]);
  });
});

describe('diagnostic: full gesture domain at fast tempos (logs only, not an assertion)', () => {
  it('reports the round-trip result for 100 generated cases at 120 to 180 bpm', () => {
    const domain = genGestureScoreWith({ tempos: fc.constantFrom(120, 150, 180), durations: [2], maxSymbols: 4 });
    const result = fc.check(
      fc.property(domain, (s) => {
        const out = canonicalScore(
          notateGestures(performGestures(s), { tempo: s.tempo, beatsPerBar: 4, grid: 0.5, title: 'x' }),
        );
        return JSON.stringify(symbolTuples(out)) === JSON.stringify(symbolTuples(canonicalScore(s)));
      }),
      { numRuns: 100 },
    );
    console.log(`fast-tempo full-domain round trip: failed=${result.failed}; numRuns=${result.numRuns}`);
  });
});
