// Offline check of the links in the README and docs: every relative link names a file that exists, and every
// #anchor names a heading in its target. External links are opened in a browser before release.
//   node scripts/check-links.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const files = ["README.md", ...walk(join(root, "docs")), ...walk(join(root, "power")), ...walk(join(root, ".kiro"))].map((f) =>
  f.startsWith(root) ? f : join(root, f),
);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to hyphens. */
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

function anchors(file) {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  const seen = new Map();
  const out = new Set();
  for (const m of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = slug(m[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n ? `${base}-${n}` : base);
  }
  for (const m of text.matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) out.add(m[1]);
  return out;
}

const problems = [];
let checked = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  const links = [...text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g), ...text.matchAll(/(?:href|src|srcset)="([^"]+)"/g)].map((m) => m[1]);
  for (const link of links) {
    if (/^(https?:|mailto:)/.test(link)) continue;
    checked++;
    const [path, anchor] = link.split("#");
    const target = path ? join(dirname(file), decodeURIComponent(path)) : file;
    if (!existsSync(target)) {
      problems.push(`${relative(root, file)}: ${link} (no such file)`);
      continue;
    }
    if (anchor && target.endsWith(".md") && !anchors(target).has(anchor)) {
      problems.push(`${relative(root, file)}: ${link} (no heading #${anchor})`);
    }
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Local links and anchors: ${checked} checked in ${files.length} files, all resolve.`);
