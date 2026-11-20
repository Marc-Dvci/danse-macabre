// Requirement 8: the engine on a real CMU clip. Source: CMU Graphics Lab Motion Capture Database, subject 143, trial 35
// ("Macarena Dance"). Format of data/clips/macarena.json: { fps, joints, frames: number[frame][joint][xyz] }, metres.
import { describe, expect, it } from 'vitest';
import clip from '../../../data/clips/macarena.json';
import { bodyFrame, notateGestures, quantizeGesture, type Frame, type JointName, type Vec3 } from '../src/index';

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
  it('reports the first eight arm symbols and opens with right-arm forward middle, then left-arm forward middle', () => {
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

    const score = notateGestures(frames, { tempo: 100, beatsPerBar: 4, grid: 0.5, title: 'Macarena' });
    const arms = score.symbols
      .filter((s) => s.column === 'left-arm' || s.column === 'right-arm')
      .sort((a, b) => a.start - b.start || (a.column < b.column ? -1 : 1));
    const first = arms.slice(0, 8);
    console.log('macarena first eight arm symbols (column, start in beats, direction, level):');
    for (const s of first) console.log(`  ${s.column}  start ${s.start}  ${s.direction}  ${s.level}`);

    expect(first.slice(0, 2).map((s) => [s.column, s.direction, s.level])).toEqual([
      ['right-arm', 'forward', 'middle'],
      ['left-arm', 'forward', 'middle'],
    ]);
  });
});
