// Writes examples/macarena.svg and examples/macarena-lesson.txt from data/clips/macarena.json.
// Source of the clip: CMU Graphics Lab Motion Capture Database, subject 143, trial 35 ("Macarena Dance").
// Run from the repository root (see README of this spec): esbuild bundles this file, then node runs the bundle.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import clip from '../../../data/clips/macarena.json';
import { describe, notateGestures, renderStaffSvg, type Frame, type JointName, type Vec3 } from '../src/index';

type RawClip = { fps: number; joints: JointName[]; frames: number[][][] };
const raw = clip as unknown as RawClip;

const frames: Frame[] = raw.frames.map((rows, i) => {
  const joints = {} as Record<JointName, Vec3>;
  raw.joints.forEach((name, j) => {
    const p = rows[j]!;
    joints[name] = { x: p[0]!, y: p[1]!, z: p[2]! };
  });
  return { t: i / raw.fps, joints };
});

const title = 'Macarena (CMU Graphics Lab Motion Capture Database, subject 143, trial 35)';
const score = notateGestures(frames, { tempo: 100, beatsPerBar: 4, grid: 0.5, title });

const svg = renderStaffSvg(score, { beatHeight: 24, columnWidth: 16 });
const lines = describe(score);
const source = 'Source: CMU Graphics Lab Motion Capture Database, subject 143, trial 35 (Macarena Dance).';
const lessonText = [source, ...lines.map((l) => l.text)].join('\n') + '\n';

writeFileSync(resolve('examples', 'macarena.svg'), svg + '\n', 'utf8');
writeFileSync(resolve('examples', 'macarena-lesson.txt'), lessonText, 'utf8');

console.log(`symbols: ${score.symbols.length}`);
console.log(`lesson lines (beat lines and intro): ${lines.length}`);
console.log(`svg bytes: ${svg.length}`);
