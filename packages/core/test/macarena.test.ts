// Requirement 8: the engine on a real CMU clip. Source: CMU Graphics Lab Motion Capture Database, subject 143, trial 35
// ("Macarena Dance"). Format of data/clips/macarena.json: { fps, joints, frames: number[frame][joint][xyz] }, metres.
import { describe, expect, it } from 'vitest';
import clip from '../../../data/clips/macarena.json';
import { bodyFrame, notateGestures, quantizeGesture, type Frame, type JointName, type Vec3 } from '../src/index';
import { hysteresisCells, heldCells } from '../src/held-cells';
import { angularSpeeds, holdFrames, moveEdges, restFrames, smooth } from '../src/segment';
import { sub } from '../src/vec';

type RawClip = { fps: number; joints: JointName[]; frames: number[][][] };

function toFrames(c: RawClip): Frame[] {
  return c.frames.map((rows, i) => {
    const joints = {} as Record<JointName, Vec3>;
    c.joints.forEach((name, j) => {
      const p = rows[j]!;
      joints[name] = { x: p[0]!, y: p[1]!, z: p[2]! };
    });
    return { t: i / c.fps, joints };
  });
}

const raw = clip as unknown as RawClip;
const frames = toFrames(raw);

describe('Requirement 8.1: body frame of the Macarena (CMU subject 143, trial 35)', () => {
  it('frame 0 faces along the expected forward direction, close to (-0.48, 0, -0.88)', () => {
    const axes = bodyFrame(frames[0]!);
    console.log(
      `macarena frame 0 forward: (${axes.forward.x.toFixed(3)}, ${axes.forward.y.toFixed(3)}, ${axes.forward.z.toFixed(3)})`,
    );
    expect(axes.forward.x).toBeCloseTo(-0.48, 1);
    expect(axes.forward.y).toBeCloseTo(0, 1);
    expect(axes.forward.z).toBeCloseTo(-0.88, 1);
  });
});

describe('Requirement 8.2: notation of the Macarena at 100 bpm', () => {
  it('reports the first eight arm symbols and checks that each arm starts forward middle within two beats', () => {
    // Raw cells of the first 4 s, from the wrist minus the shoulder, before any rule of Requirement 4 is applied.
    for (const col of ['left', 'right'] as const) {
      const runs: string[] = [];
      let prev = '';
      let start = 0;
      for (let k = 0; k < 120; k++) {
        const j = frames[k]!.joints;
        const v = {
          x: j[`${col}-wrist`].x - j[`${col}-shoulder`].x,
          y: j[`${col}-wrist`].y - j[`${col}-shoulder`].y,
          z: j[`${col}-wrist`].z - j[`${col}-shoulder`].z,
        };
        const c = quantizeGesture(v, bodyFrame(frames[k]!));
        const key = `${c.direction} ${c.level}`;
        if (key !== prev) {
          if (prev) runs.push(`${prev} [${(start / 30).toFixed(2)}-${(k / 30).toFixed(2)} s]`);
          prev = key;
          start = k;
        }
      }
      runs.push(`${prev} [${(start / 30).toFixed(2)}-4.00 s]`);
      console.log(`macarena raw ${col}-arm cells:\n  ${runs.join('\n  ')}`);
    }

    for (const col of ['left', 'right'] as const) {
      const vectors = frames.map((f) => sub(f.joints[`${col}-wrist`], f.joints[`${col}-shoulder`]));
      const axes: ReturnType<typeof bodyFrame>[] = [];
      for (const f of frames) axes.push(bodyFrame(f, axes[axes.length - 1]));
      const times = frames.map((f) => f.t);
      const held = heldCells(hysteresisCells(vectors, axes, 4), times, 0.12, times[times.length - 1]! + 1 / 30);
      const raw = angularSpeeds(vectors, times);
      const rests = [
        ...new Set([...restFrames(smooth(raw, times, 0.2), 3), ...holdFrames(vectors, times, 0.35, 8)]),
      ].sort((a, b) => a - b);
      console.log(`macarena ${col}-arm rests incl. holds (s): ${rests.slice(0, 14).map((r) => (r / 30).toFixed(2)).join(' ')}`);
      for (let i = 0; i + 1 < rests.length && i < 6; i++) {
        const e = moveEdges(raw, rests[i]!, rests[i + 1]!);
        if (!e) continue;
        const a = held[e.start]!;
        const b = held[e.end]!;
        console.log(
          `  move ${(rests[i]! / 30).toFixed(2)}-${(rests[i + 1]! / 30).toFixed(2)} s, motion ${times[e.start]!.toFixed(3)}-${times[e.end]!.toFixed(3)} s, start cell ${a.direction} ${a.level}, settled ${b.direction} ${b.level}`,
        );
      }
    }

    const score = notateGestures(frames, { tempo: 100, beatsPerBar: 4, grid: 0.5, title: 'Macarena' });
    const arms = score.symbols
      .filter((s) => s.column === 'left-arm' || s.column === 'right-arm')
      .sort((a, b) => a.start - b.start || (a.column < b.column ? -1 : 1));
    const first = arms.slice(0, 8);
    console.log(`macarena arm symbols, total: ${arms.length}`);
    console.log('macarena first eight arm symbols (column, start in beats, direction, level):');
    for (const s of first) console.log(`  ${s.column}  start ${s.start}  ${s.direction}  ${s.level}`);

    // Requirement 8.2: the first symbol of each arm is forward middle within the first two beats. The order of the two
    // arms is not asserted.
    for (const col of ['left-arm', 'right-arm'] as const) {
      const firstOfArm = arms.find((s) => s.column === col);
      expect(firstOfArm && [firstOfArm.direction, firstOfArm.level]).toEqual(['forward', 'middle']);
      expect(firstOfArm!.start).toBeLessThanOrEqual(2);
    }
  });
});
