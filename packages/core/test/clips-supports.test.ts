// Real data for supports-and-turns (task 9). Clips from the CMU Graphics Lab Motion Capture Database
// (http://mocap.cs.cmu.edu/, free for all uses, no resale; funded by NSF EIA-0196217):
//   russian-dance: subject 90, trial 30, "russian dance"
//   salsa:         subject 60, trial 01, "salsa dance"
// The test prints what the notator finds. It asserts only that the score is valid. Constants are not tuned.
import { describe, expect, it } from 'vitest';
import russian from '../../../data/clips/russian-dance.json';
import salsa from '../../../data/clips/salsa.json';
import { notate, validateScore, type Frame, type JointName, type Symbol, type Vec3 } from '../src/index';
import { footContacts, standingHeight } from '../src/contact';

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

function describeSupports(label: string, symbols: Symbol[]): void {
  const support = symbols.filter((s) => s.column === 'left-support' || s.column === 'right-support');
  const turns = support.filter((s) => s.kind === 'turn');
  const steps = support.filter((s) => s.kind !== 'turn');
  console.log(
    `${label}: ${steps.length} support symbols, ${turns.length} turn symbols (100 bpm, grid 0.5 beat)`,
  );
  const first = [...support].sort((a, b) => a.start - b.start || (a.column < b.column ? -1 : 1)).slice(0, 6);
  console.log(`${label}: first six support symbols (column, start, duration, direction, level or turn):`);
  for (const s of first) {
    const what =
      s.kind === 'turn' ? `turn ${s.rotation} ${s.amount}` : `${s.direction} ${s.level}`;
    console.log(`  ${s.column}  start ${s.start}  duration ${s.duration}  ${what}`);
  }
}

function contactStats(label: string, frames: Frame[]): void {
  const c = footContacts(frames);
  const count = (xs: boolean[]) => xs.filter((x) => !x).length;
  const lowFrames = (side: JointName) =>
    frames.filter((f) => f.joints[side].y - c.minY <= 0.12 + 1e-9).length;
  console.log(
    `${label}: ${frames.length} frames, lowest ankle ${c.minY.toFixed(3)} m, frames with left foot off the floor ${count(c.left)}, right foot off the floor ${count(c.right)}, standing height ${standingHeight(frames, c).toFixed(3)} m`,
  );
  console.log(
    `${label}: frames with the left ankle within 0.12 m of the lowest ankle ${lowFrames('left-ankle')}, right ankle ${lowFrames('right-ankle')}`,
  );
}

describe('task 9: supports and turns on real clips at 100 bpm', () => {
  it('russian-dance.json', () => {
    const c = russian as unknown as RawClip;
    const frames = toFrames(c);
    contactStats('russian-dance', frames);
    const sc = notate(frames, { tempo: 100, beatsPerBar: 4, grid: 0.5, title: 'Russian dance' });
    describeSupports('russian-dance', sc.symbols);
    expect(validateScore(sc)).toEqual({ ok: true });
  });

  it('salsa.json', () => {
    const c = salsa as unknown as RawClip;
    const frames = toFrames(c);
    contactStats('salsa', frames);
    const sc = notate(frames, { tempo: 100, beatsPerBar: 4, grid: 0.5, title: 'Salsa' });
    describeSupports('salsa', sc.symbols);
    expect(validateScore(sc)).toEqual({ ok: true });
  });
});
