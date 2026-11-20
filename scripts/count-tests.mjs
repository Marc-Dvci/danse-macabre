// Run the test suites and record their counts in docs/measure/tests.json, for docs/RESULTS.md.
//   node scripts/count-tests.mjs            (core and MCP tests with coverage, and the browser tests)
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(import.meta.dirname, "..");
// The property tests run at the fixed seed CI uses, so the counts and the coverage here match CI's.
const env = { ...process.env, FC_SEED: process.env.FC_SEED ?? "1928" };
const run = (cmd, cwd = root) => execSync(cmd, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true });

const json = join(tmpdir(), `danse-core-${Date.now()}.json`);
try {
  run(`pnpm --filter @danse/core exec vitest run --coverage --reporter=json --outputFile="${json}"`);
} catch {
  /* failures are counted below */
}
const core = JSON.parse(readFileSync(json, "utf8"));
rmSync(json, { force: true });
const files = core.testResults ?? [];
const props = files.filter((f) => /\.prop\.test\.ts$/.test(f.name)).reduce((n, f) => n + (f.assertionResults?.length ?? 0), 0);

const mcpJson = join(tmpdir(), `danse-mcp-${Date.now()}.json`);
try {
  run(`pnpm --filter @danse/mcp exec vitest run --coverage --reporter=json --outputFile="${mcpJson}"`);
} catch {
  /* failures are counted below */
}
const mcp = JSON.parse(readFileSync(mcpJson, "utf8"));
rmSync(mcpJson, { force: true });

const e2eJson = join(tmpdir(), `danse-e2e-${Date.now()}.json`);
let e2e = { passed: 0, failed: 0 };
try {
  run(`pnpm exec playwright test --grep-invert measure --reporter=json > "${e2eJson}"`, join(root, "web"));
} catch {
  /* failures are counted below */
}
try {
  const report = JSON.parse(readFileSync(e2eJson, "utf8"));
  e2e = { passed: report.stats?.expected ?? 0, failed: report.stats?.unexpected ?? 0 };
} catch {
  /* no report */
}
rmSync(e2eJson, { force: true });

const out = {
  "Core tests passed": core.numPassedTests,
  "Core tests failed": core.numFailedTests,
  "Core test files": files.length,
  "Core property tests (fast-check)": props,
  "MCP server tests passed": mcp.numPassedTests,
  "MCP server tests failed": mcp.numFailedTests,
  "Browser tests passed (Playwright, with axe)": e2e.passed,
  "Browser tests failed": e2e.failed,
};
// Coverage of each package's src/, from the json-summary reporter (vitest.config.ts in each package).
const coverage = {};
for (const [name, dir] of [["Notation engine (packages/core)", "packages/core"], ["MCP server (packages/mcp)", "packages/mcp"]]) {
  const total = JSON.parse(readFileSync(join(root, dir, "coverage", "coverage-summary.json"), "utf8")).total;
  coverage[name] = { lines: total.lines.pct, branches: total.branches.pct, functions: total.functions.pct, statements: total.statements.pct };
}
mkdirSync(join(root, "docs", "measure"), { recursive: true });
writeFileSync(join(root, "docs", "measure", "coverage.json"), JSON.stringify(coverage, null, 1));
writeFileSync(join(root, "docs", "measure", "tests.json"), JSON.stringify(out, null, 1));
console.log(out, coverage);
