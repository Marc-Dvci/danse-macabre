import { describe, expect, it } from 'vitest';
import { bodyFrame, performGestures, WORLD_AXES, type Frame } from '../src/index';
import { cross, dot, length } from '../src/vec';

const restFrame = (): Frame => performGestures({
  version: 1,
  title: 't',
  tempo: 60,
  beatsPerBar: 4,
  grid: 0.5,
  startPosition: {},
  symbols: [],
}, { fps: 30 })[0]!;

describe('bodyFrame', () => {
  it('gives world axes for the standard rig facing +z, with right at -x', () => {
    const axes = bodyFrame(restFrame());
    expect(axes.right.x).toBeCloseTo(-1, 12);
    expect(axes.right.y).toBeCloseTo(0, 12);
    expect(axes.right.z).toBeCloseTo(0, 12);
    expect(axes.forward.x).toBeCloseTo(0, 12);
    expect(axes.forward.y).toBeCloseTo(0, 12);
    expect(axes.forward.z).toBeCloseTo(1, 12);
    expect(axes.up).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('returns orthonormal axes with forward = cross(up, right)', () => {
    const frame = restFrame();
    const j = frame.joints;
    // Turn the hips and shoulders by 60 degrees about +y.
    const turn = (p: { x: number; y: number; z: number }) => {
      const c = Math.cos(Math.PI / 3);
      const s = Math.sin(Math.PI / 3);
      return { x: c * p.x + s * p.z, y: p.y, z: -s * p.x + c * p.z };
    };
    const turned: Frame = {
      t: frame.t,
      joints: { ...j, 'left-hip': turn(j['left-hip']), 'right-hip': turn(j['right-hip']),
        'left-shoulder': turn(j['left-shoulder']), 'right-shoulder': turn(j['right-shoulder']) },
    };
    const axes = bodyFrame(turned);
    expect(length(axes.right)).toBeCloseTo(1, 12);
    expect(length(axes.forward)).toBeCloseTo(1, 12);
    expect(dot(axes.right, axes.forward)).toBeCloseTo(0, 12);
    const f = cross(axes.up, axes.right);
    expect(axes.forward.x).toBeCloseTo(f.x, 12);
    expect(axes.forward.z).toBeCloseTo(f.z, 12);
  });

  it('reuses the previous axes when the hip and shoulder line is under 1 cm', () => {
    const frame = restFrame();
    const collapsed: Frame = {
      t: frame.t,
      joints: { ...frame.joints, 'right-hip': frame.joints['left-hip'], 'right-shoulder': frame.joints['left-shoulder'] },
    };
    const previous = { up: WORLD_AXES.up, right: { x: 0, y: 0, z: 1 }, forward: { x: -1, y: 0, z: 0 } };
    expect(bodyFrame(collapsed, previous)).toBe(previous);
    expect(bodyFrame(collapsed)).toEqual(WORLD_AXES);
  });
});
