import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { performGestures, replayFidelity, type Frame, type JointName, type Vec3 } from '../src/index';
import { genGestureScore, runOptions } from './generators';

const RUNS = runOptions(100);

/** Rotates a point about the vertical axis by `deg` degrees, then moves it by `d`. */
function moveFrame(f: Frame, deg: number, d: Vec3): Frame {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const joints = {} as Record<JointName, Vec3>;
  for (const name of Object.keys(f.joints) as JointName[]) {
    const p = f.joints[name];
    joints[name] = { x: c * p.x + s * p.z + d.x, y: p.y + d.y, z: -s * p.x + c * p.z + d.z };
  }
  return { t: f.t, joints };
}

describe('fidelity properties', () => {
  // Property F1, Requirement 1.4: a score performed by its own generator measures below 1 degree.
  it('F1: replayFidelity(performGestures(s), s) is below 1 degree (Req 1.4)', () => {
    fc.assert(
      fc.property(genGestureScore, (s) => {
        const r = replayFidelity(performGestures(s), s);
        expect(r.meanDegrees).toBeLessThan(1);
        expect(r.p90Degrees).toBeLessThan(1);
      }),
      RUNS,
    );
  });

  // Property F2, Requirement 1.1: position and facing of the recording do not count.
  it('F2: a recording rotated about the vertical axis and moved gives the same result', () => {
    fc.assert(
      fc.property(
        genGestureScore,
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.double({ min: -5, max: 5, noNaN: true }),
        (s, deg, dx, dz) => {
          const rec = performGestures(s);
          const moved = rec.map((f) => moveFrame(f, deg, { x: dx, y: 0, z: dz }));
          const a = replayFidelity(rec, s);
          const b = replayFidelity(moved, s);
          expect(b.meanDegrees).toBeCloseTo(a.meanDegrees, 6);
          expect(b.medianDegrees).toBeCloseTo(a.medianDegrees, 6);
          expect(b.p90Degrees).toBeCloseTo(a.p90Degrees, 6);
        },
      ),
      RUNS,
    );
  });

  // Property F3, Requirement 1.2: the statistics are angles in [0, 180] and the median is not above the 90th percentile.
  it('F3: mean, median and p90 are in [0, 180] and median <= p90', () => {
    fc.assert(
      fc.property(genGestureScore, genGestureScore, (s, other) => {
        // Two different generated scores: the replay of `s` is compared with the recording of `other`.
        const rec = performGestures(other);
        const r = replayFidelity(rec, s);
        for (const v of [r.meanDegrees, r.medianDegrees, r.p90Degrees]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(180);
        }
        expect(r.medianDegrees).toBeLessThanOrEqual(r.p90Degrees + 1e-9);
      }),
      RUNS,
    );
  });

  // Property F5: frames compared never exceed the recording.
  it('F5: frames compared is at most the recording length', () => {
    fc.assert(
      fc.property(genGestureScore, (s) => {
        const rec = performGestures(s);
        expect(replayFidelity(rec, s).frames).toBeLessThanOrEqual(rec.length);
      }),
      RUNS,
    );
  });
});
