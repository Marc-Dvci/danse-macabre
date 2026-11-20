// Fails when a tracked text file uses wording this project keeps out: data described by what it is not, instead of
// where it comes from. Run in CI: node scripts/check-words.mjs
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BANNED = [/\bsynthetic\b/i, /\bfictional\b/i, /\bfake\b/i, /\bmade[- ]up\b/i, /\binvented\b/i];
const SKIP = /(^|\/)(pnpm-lock\.yaml|LICENSE|scripts\/check-words\.mjs)$|\.(png|jpg|webp|webm|opus|wasm|glb|ico)$/;

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter((f) => f && !SKIP.test(f));
const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    for (const re of BANNED) if (re.test(line)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
}
if (hits.length) {
  console.error(`Wording check failed in ${hits.length} place(s):\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`Wording check passed on ${files.length} files.`);
