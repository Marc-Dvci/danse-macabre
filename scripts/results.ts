// Compute the figures quoted in the README and write docs/RESULTS.md.
//   pnpm exec tsx scripts/results.ts
// Inputs: every clip in data/clips, the finale score in data/scores, and docs/measure/video-vs-mocap.json (written by
// `pnpm --filter @danse/web measure`). Test counts come from running the suites and are passed in through
// docs/measure/tests.json (written by scripts/count-tests.mjs).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, findPhrase, mirrorScore, notate, parseLesson, perform, validateScore, type Frame, type JointName, type Score } from "../packages/core/src/index";

const root = join(import.meta.dirname, "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(root, p), "utf8")) as T;

interface ClipFile {
  id: string;
  title: string;
  fps: number;
  joints: JointName[];
  frames: number[][][];
  source: { subject: string; trial: string; description: string };
}

function framesOf(c: ClipFile): Frame[] {
  return c.frames.map((row, i) => {
    const joints = {} as Frame["joints"];
    c.joints.forEach((name, k) => {
      const v = row[k] ?? [0, 0, 0];
      joints[name] = { x: v[0] ?? 0, y: v[1] ?? 0, z: v[2] ?? 0 };
    });
    return { t: i / c.fps, joints };
  });
}

const kindOf = (column: string) => (column.endsWith("arm") ? "arm" : column.endsWith("leg") ? "leg" : "support");
const index = read<{ clips: Array<{ id: string }> }>("data/clips/index.json");
const rows: string[] = [];
let totalSymbols = 0;
let totalSeconds = 0;
const scores: Record<string, Score> = {};
for (const { id } of index.clips) {
  const clip = read<ClipFile>(`data/clips/${id}.json`);
  const frames = framesOf(clip);
  const t0 = performance.now();
  const score = notate(frames, { tempo: 100, beatsPerBar: 4, grid: 0.5, title: clip.title });
  const ms = performance.now() - t0;
  scores[id] = score;
  const valid = validateScore(score).ok;
  const counts = { arm: 0, leg: 0, support: 0, turn: 0 };
  for (const s of score.symbols) {
    if ("kind" in s && s.kind === "turn") counts.turn++;
    else counts[kindOf(s.column) as "arm" | "leg" | "support"]++;
  }
  const lesson = describe(score);
  const parsedBack = parseLesson(lesson).length;
  const seconds = frames.length / clip.fps;
  totalSymbols += score.symbols.length;
  totalSeconds += seconds;
  rows.push(
    `| ${clip.title} | ${clip.source.subject}/${clip.source.trial} | ${seconds.toFixed(1)} | ${counts.arm} | ${counts.leg} | ${counts.support} | ${counts.turn} | ${lesson.length} | ${parsedBack === score.symbols.length ? "yes" : `no (${parsedBack})`} | ${valid ? "yes" : "no"} | ${ms.toFixed(0)} |`,
  );
}

// Every dance played back from its own score and written down again.
let roundTrips = 0;
for (const [id, score] of Object.entries(scores)) {
  const again = notate(perform(score, { fps: 30 }), { tempo: score.tempo, beatsPerBar: score.beatsPerBar, grid: score.grid, title: id });
  const key = (s: Score) => JSON.stringify(s.symbols.map((x) => ({ ...x, id: undefined })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if (key(again) === key(score)) roundTrips++;
}

// Mirror search: each dance's mirror image is found at beat 0 in the mirrored dance.
let mirrorFound = 0;
for (const score of Object.values(scores)) {
  const phrase: Score = { ...score, symbols: score.symbols.filter((s) => s.start < score.beatsPerBar * 2) };
  if (phrase.symbols.length === 0) continue;
  const at = Math.min(...phrase.symbols.map((s) => s.start));
  const shifted = { ...phrase, symbols: phrase.symbols.map((s) => ({ ...s, start: s.start - at })) };
  if (findPhrase(mirrorScore(score), shifted, { mirror: true }).some((m) => m.mirrored && m.beat === at)) mirrorFound++;
}

const macarena = scores["macarena"]!;
const firstArms = macarena.symbols
  .filter((s) => s.column.endsWith("arm"))
  .sort((a, b) => a.start - b.start)
  .slice(0, 8)
  .map((s) => ("direction" in s ? `${s.column} ${s.direction} ${s.level} at beat ${s.start}` : `${s.column} turn at beat ${s.start}`));

const finale = read<Score>("examples/danse-macabre.score.json");
const video = existsSync(join(root, "docs/measure/video-vs-mocap.json"))
  ? read<{ measuredAt: string; results: Array<Record<string, string | number>> }>("docs/measure/video-vs-mocap.json")
  : null;
const tests = existsSync(join(root, "docs/measure/tests.json")) ? read<Record<string, number>>("docs/measure/tests.json") : null;

const md = [
  "# Results",
  "",
  `Written by \`pnpm exec tsx scripts/results.ts\` on ${new Date().toISOString().slice(0, 10)}. Every figure in the README comes from this file.`,
  "",
  "## The nine dances, written down",
  "",
  "Settings: 100 counts per minute, 4 counts per bar, half-count grid. Source: CMU Graphics Lab Motion Capture Database (subject/trial).",
  "",
  "| Dance | CMU | Seconds | Arm symbols | Leg symbols | Steps | Turns | Lesson lines | Lesson parses back | Valid score | Notation time (ms) |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
  ...rows,
  "",
  `Total: ${totalSymbols} symbols from ${totalSeconds.toFixed(1)} seconds of dance.`,
  "",
  `Played back from its own score and written down again, ${roundTrips} of ${Object.keys(scores).length} dances give the same score.`,
  "",
  `Mirror search: in ${mirrorFound} of ${Object.keys(scores).length} dances, the first two bars are found, mirrored, at their own beat in the mirrored dance.`,
  "",
  "First eight arm symbols of the Macarena (CMU 143/35):",
  "",
  ...firstArms.map((l) => `- ${l}`),
  "",
  "## The finale",
  "",
  `${finale.title}: ${finale.symbols.length} symbols, ${finale.beatsPerBar} counts per bar at ${finale.tempo} counts per minute. ${finale.source ?? ""}`,
  "",
  "## Video against motion capture",
  "",
  video
    ? [
        `Measured ${video.measuredAt.slice(0, 10)} by \`pnpm --filter @danse/web measure\` (the From video page in Chromium, headless). The CMU reference video of a take is read by the pose model and written down; its arm cells are compared, every half count, with the score written from the motion capture of the same take, after lining the two up by wrist height.`,
        "",
        "| Video | Symbols from video | Same direction and level | Same or neighbouring | Checks | Offset (s) |",
        "|---|---|---|---|---|---|",
        ...video.results.map((r) => `| ${r.video} | ${r.symbols} | ${r.exactPercent}% | ${r.nearPercent}% | ${r.checks} | ${r.offsetSeconds} |`),
      ].join("\n")
    : "Not measured yet.",
  "",
  "## Tests",
  "",
  tests ? Object.entries(tests).map(([k, v]) => `- ${k}: ${v}`).join("\n") : "Run `node scripts/count-tests.mjs`.",
  "",
].join("\n");

writeFileSync(join(root, "docs", "RESULTS.md"), md);
console.log(md);
