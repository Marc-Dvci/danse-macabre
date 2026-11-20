// The CI run page as a report: test counts, coverage per module, and the measured figures.
//   node scripts/ci-summary.mjs >> "$GITHUB_STEP_SUMMARY"
// Reads the vitest JSON reports and coverage summaries written by the CI test steps, the Playwright JSON report, and
// docs/RESULTS.md for the evaluation figures.
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), "utf8")) : null);
const out = [];
const pct = (x) => `${x.toFixed(2)}%`;

out.push("## Danse Macabre: tests and measurements", "");

const suites = [
  ["Notation engine (`packages/core`)", read("reports/core.json")],
  ["MCP server (`packages/mcp`)", read("reports/mcp.json")],
];
const e2e = read("reports/e2e.json");
out.push("| Suite | Passed | Failed | Skipped |", "|---|---|---|---|");
for (const [name, r] of suites) {
  if (r) out.push(`| ${name} | ${r.numPassedTests} | ${r.numFailedTests} | ${r.numPendingTests + r.numTodoTests} |`);
}
if (e2e) out.push(`| Browser, with axe (\`web/e2e\`) | ${e2e.stats.expected} | ${e2e.stats.unexpected} | ${e2e.stats.skipped} |`);
const core = suites[0][1];
if (core) {
  const props = core.testResults.filter((f) => /\.prop\.test\.ts$/.test(f.name)).reduce((n, f) => n + f.assertionResults.length, 0);
  out.push("", `Property tests (fast-check, 100 to 500 cases each, seed ${process.env.FC_SEED ?? "random"}): ${props}. Both vitest suites ran in random order.`);
}

for (const [name, dir] of [
  ["Notation engine", "packages/core"],
  ["MCP server", "packages/mcp"],
]) {
  const cov = read(`${dir}/coverage/coverage-summary.json`);
  if (!cov) continue;
  out.push("", `### Coverage: ${name}`, "", "| Module | Lines | Branches | Functions |", "|---|---|---|---|");
  for (const [file, c] of Object.entries(cov)) {
    const label = file === "total" ? "**Total**" : `\`${relative(join(root, dir), file).replaceAll("\\", "/")}\``;
    out.push(`| ${label} | ${pct(c.lines.pct)} | ${pct(c.branches.pct)} | ${pct(c.functions.pct)} |`);
  }
}

const results = existsSync(join(root, "docs/RESULTS.md")) ? readFileSync(join(root, "docs/RESULTS.md"), "utf8") : "";
const pick = (re) => results.match(re)?.[0];
const figures = [
  pick(/Total: \d+ symbols from [\d.]+ seconds of dance\./),
  pick(/Average of the nine means: [\d.]+ degrees\./),
  pick(/Mirror search: in \d+ of \d+ dances[^.]*\./),
].filter(Boolean);
if (figures.length) out.push("", "### Measured (docs/RESULTS.md)", "", ...figures.map((f) => `- ${f}`));

console.log(out.join("\n"));
