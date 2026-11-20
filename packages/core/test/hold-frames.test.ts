import { describe, expect, it } from 'vitest';
import { angularSpeeds, holdFrames } from '../src/segment';
import type { Vec3 } from '../src/types';

// Requirement 4.4 rule (b): a hold's first frame must have a raw angular speed below 5% of the peak speed of the move
// before it. Limb directions are hand-built in the x-z plane, so the angle between two of them is the difference of
// their yaw angles.
const FPS = 30;
const times = (n: number): number[] => Array.from({ length: n }, (_, k) => k / FPS);
const yaw = (deg: number): Vec3 => {
  const r = (deg * Math.PI) / 180;
  return { x: Math.sin(r), y: 0, z: Math.cos(r) };
};

describe('holdFrames (Requirement 4.4 rule b)', () => {
  // Frames 0 to 9 face 0 degrees. Frame 10 jumps to 90 degrees in one frame (the arrival). Frames 10 to 40 drift by
  // 0.05 degrees per frame, so every frame stays within 8 degrees of frame 10.
  const vectors: Vec3[] = [];
  for (let k = 0; k <= 40; k++) {
    if (k < 10) vectors.push(yaw(0));
    else vectors.push(yaw(90 + 0.05 * (k - 10)));
  }
  const t = times(vectors.length);
  const raw = angularSpeeds(vectors, t);
  // Rests from the speed rule: the still start and the end. Frame 10 is not a speed rest.
  const speedRests = [0, 40];

  it('does not start a hold on the arrival frame, where the move is still fast', () => {
    const holds = holdFrames(vectors, t, raw, speedRests, 0.35, 8);
    expect(holds).not.toContain(10);
  });

  it('starts the hold on the first frame after the arrival, once the speed is below 5% of the move peak', () => {
    const holds = holdFrames(vectors, t, raw, speedRests, 0.35, 8);
    expect(holds[0]).toBe(11);
    expect(holds).toEqual(Array.from({ length: 30 }, (_, k) => 11 + k));
  });
});
