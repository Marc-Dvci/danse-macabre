// Draw a saved score and read it aloud: writes <name>.svg (the staff) and <name>-lesson.txt next to <name>.score.json.
//   pnpm exec tsx scripts/render-score.ts examples/danse-macabre.score.json
// As a Kiro hook (PostFileSave on examples/*.score.json) it reads the saved path from the hook event on stdin.
import { readFileSync, writeFileSync } from "node:fs";
import { describe, renderStaffSvg, validateScore, type Score } from "../packages/core/src/index";

function pathFromArgsOrStdin(): string | null {
  if (process.argv[2]) return process.argv[2];
  try {
    const event = JSON.parse(readFileSync(0, "utf8")) as { file_path?: string; tool_input?: { path?: string } };
    return event.file_path ?? event.tool_input?.path ?? null;
  } catch {
    return null;
  }
}

const path = pathFromArgsOrStdin();
if (!path || !/\.score\.json$/.test(path)) {
  console.log("render-score: not a score file, nothing to do");
  process.exit(0);
}
const score = JSON.parse(readFileSync(path, "utf8")) as Score;
const check = validateScore(score);
if (!check.ok) {
  console.error(`render-score: ${path} is not a valid score:\n${check.errors.join("\n")}`);
  process.exit(1);
}
const stem = path.replace(/\.score\.json$/, "");
writeFileSync(`${stem}.svg`, renderStaffSvg(score));
const lines = describe(score).map((l) => l.text);
writeFileSync(`${stem}-lesson.txt`, lines.join("\n") + "\n");
console.log(`render-score: ${score.symbols.length} symbols; staff written to ${stem}.svg; lesson (${lines.length} lines) to ${stem}-lesson.txt`);
console.log(lines.slice(0, 4).join("\n"));
