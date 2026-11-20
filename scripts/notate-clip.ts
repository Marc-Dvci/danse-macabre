// Write a dance clip down: its score (JSON), its staff (SVG) and its spoken lesson (text), into examples/.
//   pnpm exec tsx scripts/notate-clip.ts data/clips/macarena.json
// As a Kiro hook (PostFileSave on data/clips/*.json) it reads the saved path from the hook event on stdin.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { describe, notate, renderStaffSvg, validateScore, type Frame, type JointName } from "../packages/core/src/index";

interface ClipFile {
  id: string;
  title: string;
  fps: number;
  joints: JointName[];
  frames: number[][][];
  source?: { subject?: string; trial?: string; description?: string };
}

function clipPathFromArgsOrStdin(): string | null {
  const arg = process.argv[2];
  if (arg) return arg;
  try {
    const event = JSON.parse(readFileSync(0, "utf8")) as { file_path?: string; tool_input?: { path?: string } };
    return event.file_path ?? event.tool_input?.path ?? null;
  } catch {
    return null;
  }
}

const path = clipPathFromArgsOrStdin();
if (!path || !/data[/\\]clips[/\\][^/\\]+\.json$/.test(path) || basename(path) === "index.json") {
  console.log("notate-clip: not a clip file, nothing to do");
  process.exit(0);
}

const clip = JSON.parse(readFileSync(path, "utf8")) as ClipFile;
const frames: Frame[] = clip.frames.map((row, i) => {
  const joints = {} as Frame["joints"];
  clip.joints.forEach((name, k) => {
    const v = row[k] ?? [0, 0, 0];
    joints[name] = { x: v[0] ?? 0, y: v[1] ?? 0, z: v[2] ?? 0 };
  });
  return { t: i / clip.fps, joints };
});

const score = notate(frames, { tempo: 100, beatsPerBar: 4, grid: 0.5, title: clip.title });
const check = validateScore(score);
if (!check.ok) {
  console.error(`notate-clip: the score for ${clip.id} is not valid:\n${check.errors.join("\n")}`);
  process.exit(1);
}
const out = resolve(join(import.meta.dirname, "..", "examples"));
mkdirSync(out, { recursive: true });
const credit = clip.source?.subject ? `CMU Graphics Lab Motion Capture Database, subject ${clip.source.subject}, trial ${clip.source.trial}` : "";
writeFileSync(join(out, `${clip.id}.score.json`), JSON.stringify({ ...score, source: credit || score.source }, null, 1));
writeFileSync(join(out, `${clip.id}.svg`), renderStaffSvg(score));
writeFileSync(join(out, `${clip.id}-lesson.txt`), [credit, ...describe(score).map((l) => l.text)].filter(Boolean).join("\n") + "\n");
console.log(`notate-clip: ${clip.id}: ${score.symbols.length} symbols written to examples/${clip.id}.*`);
