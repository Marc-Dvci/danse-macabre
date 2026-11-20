// Requirement 3 of .kiro/specs/fidelity. For each clip in data/clips at 100 bpm and grid 0.5: the symbols per column,
// and replayFidelity of the score against the clip. Prints one markdown table on stdout.
// Usage: pnpm --filter @danse/core exec tsx scripts/fidelity-report.ts --label before
// The clips are from the CMU Graphics Lab Motion Capture Database (free for all uses, no resale; NSF EIA-0196217).
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notate, replayFidelity, type Frame, type JointName, type Vec3, type ColumnId } from '../src/index';

type RawClip = { fps: number; joints: JointName[]; frames: number[][][] };

const COLUMNS: ColumnId[] = ['left-support', 'right-support', 'left-leg', 'right-leg', 'left-arm', 'right-arm'];

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

function fmt(v: number): string {
  return Number.isNaN(v) ? 'n/a' : v.toFixed(2);
}

const label = process.argv[process.argv.indexOf('--label') + 1] ?? 'unlabelled';
const dir = fileURLToPath(new URL('../../../data/clips/', import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .sort();

const header = [
  'Clip',
  ...COLUMNS.map((c) => `symbols ${c}`),
  'mean deg',
  'median deg',
  'p90 deg',
  'left-arm deg',
  'right-arm deg',
  'left-leg deg',
  'right-leg deg',
  'frames compared',
];
const rows: string[] = [];
for (const file of files) {
  const id = basename(file, '.json');
  const clip = JSON.parse(readFileSync(join(dir, file), 'utf8')) as RawClip;
  const frames = toFrames(clip);
  const score = notate(frames, { tempo: 100, beatsPerBar: 4, grid: 0.5, title: id });
  const counts = COLUMNS.map((c) => score.symbols.filter((s) => s.column === c).length);
  const r = replayFidelity(frames, score);
  rows.push(
    [
      id,
      ...counts.map(String),
      fmt(r.meanDegrees),
      fmt(r.medianDegrees),
      fmt(r.p90Degrees),
      fmt(r.perLimb['left-arm']),
      fmt(r.perLimb['right-arm']),
      fmt(r.perLimb['left-leg']),
      fmt(r.perLimb['right-leg']),
      String(r.frames),
    ].join(' | '),
  );
}

console.log(`Label: ${label}`);
console.log(`| ${header.join(' | ')} |`);
console.log(`| ${header.map(() => '---').join(' | ')} |`);
for (const row of rows) console.log(`| ${row} |`);
