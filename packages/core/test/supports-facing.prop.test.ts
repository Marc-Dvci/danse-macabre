// Property test for supports-and-turns Requirement 4.4: turning every frame about the vertical axis leaves the support
// symbols unchanged. Inputs are generated step-and-turn scores (property-test inputs).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { notateSupports, perform, type Frame, type Vec3 } from '../src/index';
import { arbYaw, runOptions } from './generators';
import { genStepTurnScore, supportTuples } from './supports-generators';

const RUNS = runOptions(200);

/** Rotates a vector about the vertical axis by `yawDeg`, counter-clockwise seen from above. */
function rotateY(v: Vec3, yawDeg: number): Vec3 {
  const a = (yawDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

function rotateFrames(frames: Frame[], yawDeg: number): Frame[] {
  return frames.map((f) => {
    const joints = {} as Frame['joints'];
    for (const name of Object.keys(f.joints) as (keyof Frame['joints'])[]) {
      joints[name] = rotateY(f.joints[name], yawDeg);
    }
    return { t: f.t, joints };
  });
}

describe('Requirement 4.4: facing', () => {
  it('rotating every frame about the vertical axis leaves the support symbols unchanged', () => {
    fc.assert(
      fc.property(genStepTurnScore, arbYaw, (s, yaw) => {
        const frames = perform(s);
        const params = { tempo: s.tempo, grid: s.grid };
        const before = notateSupports(frames, params);
        const after = notateSupports(rotateFrames(frames, yaw), params);
        expect(supportTuples(after)).toEqual(supportTuples(before));
      }),
      RUNS,
    );
  });
});
