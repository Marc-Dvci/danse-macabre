// Example tests for supports-and-turns. Timing: tempo 60, so one beat is one second and one grid unit (0.5 beat) is
// half a second. Frames are sampled at 30 fps unless a test says otherwise.
import { describe, expect, it } from 'vitest';
import {
  bodyFrame,
  canonicalScore,
  mirrorScore,
  notateSupports,
  perform,
  validateScore,
  WORLD_AXES,
  type Frame,
  type Score,
  type Symbol,
  type TurnSymbol,
} from '../src/index';
import { footContacts, standingHeight } from '../src/contact';
import { buildFrame, standardRig } from '../src/rig';
import { bodyAxesFromYaw, horizontalVector } from '../src/support-axes';

const base: Score = {
  version: 1,
  title: 'example',
  tempo: 60,
  beatsPerBar: 4,
  grid: 0.5,
  startPosition: {},
  symbols: [],
};

/** A pose with arms and legs hanging, and the given ankle heights. */
function pose(t: number, leftAnkleY = 0, rightAnkleY = 0): Frame {
  const down = { x: 0, y: -1, z: 0 };
  const f = buildFrame(t, { 'left-arm': down, 'right-arm': down, 'left-leg': down, 'right-leg': down }, standardRig());
  const la = f.joints['left-ankle'];
  const ra = f.joints['right-ankle'];
  return {
    t,
    joints: {
      ...f.joints,
      'left-ankle': { x: la.x, y: leftAnkleY, z: la.z },
      'right-ankle': { x: ra.x, y: rightAnkleY, z: ra.z },
    },
  };
}

describe('Requirement 1.1: direction vectors of the support columns', () => {
  it('maps the eight horizontal names to unit vectors in the body axes, and place to zero', () => {
    const f = horizontalVector('forward', WORLD_AXES);
    expect(f.x).toBeCloseTo(0, 9);
    expect(f.z).toBeCloseTo(1, 9);
    const r = horizontalVector('right', WORLD_AXES);
    expect(r.x).toBeCloseTo(-1, 9);
    expect(r.z).toBeCloseTo(0, 9);
    const lf = horizontalVector('left-forward', WORLD_AXES);
    expect(lf.x).toBeCloseTo(Math.SQRT1_2, 9);
    expect(lf.z).toBeCloseTo(Math.SQRT1_2, 9);
    expect(horizontalVector('place', WORLD_AXES)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('turns the directions with the body: forward at yaw 90 is +x', () => {
    const v = horizontalVector('forward', bodyAxesFromYaw(90));
    expect(v.x).toBeCloseTo(1, 9);
    expect(v.z).toBeCloseTo(0, 9);
  });

  it('bodyAxesFromYaw(0) is the world frame of body-frame.ts', () => {
    const a = bodyAxesFromYaw(0);
    expect(a.right.x).toBeCloseTo(WORLD_AXES.right.x, 12);
    expect(a.right.z).toBeCloseTo(WORLD_AXES.right.z, 12);
    expect(a.forward.x).toBeCloseTo(WORLD_AXES.forward.x, 12);
    expect(a.forward.z).toBeCloseTo(WORLD_AXES.forward.z, 12);
  });
});

describe('Glossary: contact', () => {
  it('a foot is in contact on the floor and out of contact when lifted', () => {
    const frames = [pose(0), pose(1 / 30), pose(2 / 30, 0.3, 0)];
    const c = footContacts(frames);
    expect(c.left).toEqual([true, true, false]);
    expect(c.right).toEqual([true, true, true]);
  });

  it('standing height falls back to the rig height when no frame has both feet down', () => {
    const frames = [pose(0, 0.3, 0), pose(1 / 30, 0.3, 0)];
    expect(standingHeight(frames, footContacts(frames))).toBeCloseTo(0.95, 9);
  });

  it('standing height is the median over both-foot frames, so a clip that ends high sets a high standing height', () => {
    // Two place-high steps at 60 bpm: the lead-in is at the middle height and the end is at the high height. The
    // median of the two-foot frames sits at the high height, which is the value the Glossary definition gives.
    const s: Score = {
      ...base,
      symbols: [
        { id: 'left-support-0', column: 'left-support', start: 0.5, duration: 1, direction: 'place', level: 'high' },
        { id: 'right-support-0', column: 'right-support', start: 1.5, duration: 1, direction: 'place', level: 'high' },
      ],
    };
    const frames = perform(s);
    const h = standingHeight(frames, footContacts(frames));
    console.log(`standing height of a clip ending high: ${h.toFixed(4)} m (rig 0.95 m, high 0.9975 m)`);
    expect(h).toBeCloseTo(0.9975, 4);
  });
});

describe('Requirement 3: perform', () => {
  it('a forward step moves the pelvis 0.4 m, lifts the stepping foot, and leaves the other foot planted', () => {
    const s: Score = {
      ...base,
      symbols: [
        { id: 'left-support-0', column: 'left-support', start: 1, duration: 2, direction: 'forward', level: 'middle' },
      ],
    };
    const frames = perform(s);
    expect(frames[15]!.joints.pelvis.z).toBeCloseTo(0, 9);
    expect(frames[90]!.joints.pelvis.z).toBeCloseTo(0.4, 9);
    expect(frames[90]!.joints.pelvis.y).toBeCloseTo(0.95, 9);
    expect(frames[60]!.joints['left-ankle'].y).toBeCloseTo(0.2, 6);
    expect(frames[0]!.joints['left-ankle'].y).toBeCloseTo(0, 9);
    expect(frames[90]!.joints['left-ankle'].z).toBeCloseTo(0.4, 9);
    expect(frames[60]!.joints['right-ankle']).toEqual(frames[0]!.joints['right-ankle']);
  });

  it('a quarter turn cw on the right foot turns the body to face −x after two beats', () => {
    const s: Score = {
      ...base,
      symbols: [
        { id: 'right-support-0', kind: 'turn', column: 'right-support', start: 0, duration: 2, rotation: 'cw', amount: 0.25 },
      ],
    };
    const frames = perform(s);
    const forward = bodyFrame(frames[60]!).forward;
    expect(forward.x).toBeCloseTo(-1, 6);
    expect(forward.z).toBeCloseTo(0, 6);
  });
});

describe('Requirement 1: notateSupports', () => {
  it('writes a quarter turn between two touchdowns (the counterexample of the mirror property)', () => {
    for (const tempo of [60, 61]) {
      const s: Score = {
        ...base,
        tempo,
        symbols: [
          { id: 'left-support-0', column: 'left-support', start: 0.5, duration: 1, direction: 'place', level: 'high' },
          { id: 'left-support-1', kind: 'turn', column: 'left-support', start: 1.5, duration: 1, rotation: 'cw', amount: 0.25 },
          { id: 'right-support-0', column: 'right-support', start: 1.5, duration: 1, direction: 'place', level: 'high' },
          { id: 'left-support-2', column: 'left-support', start: 2.5, duration: 1, direction: 'place', level: 'high' },
        ],
      };
      const got = notateSupports(perform(s), { tempo, grid: 0.5 });
      expect(got.filter((x) => x.kind === 'turn')).toEqual([
        expect.objectContaining({ column: 'left-support', start: 1.5, duration: 1, rotation: 'cw', amount: 0.25 }),
      ]);
    }
  });

  it('writes one step for a foot that leaves the floor and lands', () => {
    const s: Score = {
      ...base,
      symbols: [
        { id: 'left-support-0', column: 'left-support', start: 1, duration: 2, direction: 'forward', level: 'middle' },
      ],
    };
    const got = notateSupports(perform(s), { tempo: 60, grid: 0.5 });
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ column: 'left-support', start: 1, duration: 2, direction: 'forward', level: 'middle' });
  });

  it('writes a turn sign in the pivot foot column, with amount and rotation from the yaw change', () => {
    // Left steps in place from beat 1 to 3. Right steps in place from beat 3 to 5. The left foot is the pivot between
    // its touchdown at beat 3 and the right touchdown at beat 5, and the body turns 180 degrees counter-clockwise.
    const s: Score = {
      ...base,
      symbols: [
        { id: 'left-support-0', column: 'left-support', start: 1, duration: 2, direction: 'place', level: 'middle' },
        { id: 'left-support-1', kind: 'turn', column: 'left-support', start: 3, duration: 2, rotation: 'ccw', amount: 0.5 },
        { id: 'right-support-0', column: 'right-support', start: 3, duration: 2, direction: 'place', level: 'middle' },
      ],
    };
    const got = notateSupports(perform(s), { tempo: 60, grid: 0.5 });
    expect(got).toContainEqual(
      expect.objectContaining({ kind: 'turn', column: 'left-support', start: 3, duration: 2, rotation: 'ccw', amount: 0.5 }),
    );
  });
});

describe('Requirement 2 and 3: validation, canonical form and mirror of turns', () => {
  const turn: TurnSymbol = {
    id: 'left-support-0',
    kind: 'turn',
    column: 'left-support',
    start: 1,
    duration: 1,
    rotation: 'cw',
    amount: 0.25,
  };

  it('accepts a turn in a support column and rejects one in a gesture column or with a bad amount', () => {
    expect(validateScore({ ...base, symbols: [turn] })).toEqual({ ok: true });
    const inArm = validateScore({ ...base, symbols: [{ ...turn, column: 'left-arm' } as unknown as Symbol] });
    expect(inArm.ok).toBe(false);
    const badAmount = validateScore({ ...base, symbols: [{ ...turn, amount: 0.3 } as unknown as Symbol] });
    expect(badAmount.ok).toBe(false);
  });

  it('writes direction symbols without a kind key and turn symbols with kind "turn"', () => {
    const s: Score = {
      ...base,
      symbols: [
        turn,
        { id: 'right-support-0', column: 'right-support', start: 0, duration: 1, direction: 'place', level: 'low' },
      ],
    };
    const out = canonicalScore(s);
    const stepOut = out.symbols.find((x) => x.column === 'right-support')!;
    expect('kind' in stepOut).toBe(false);
    expect(out.symbols.find((x) => x.column === 'left-support')).toEqual(turn);
  });

  it('mirror swaps the turn column and rotation, and mirroring twice gives the score back', () => {
    const s: Score = { ...base, symbols: [turn] };
    const m = mirrorScore(s);
    expect(m.symbols[0]).toEqual({ ...turn, id: 'right-support-0', column: 'right-support', rotation: 'ccw' });
    expect(mirrorScore(m)).toEqual(s);
  });
});
