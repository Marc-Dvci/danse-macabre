// Run the test suites and record their counts in docs/measure/tests.json, for docs/RESULTS.md.
//   node scripts/count-tests.mjs            (core unit and property tests, and the browser tests)
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(import.meta.dirname, "..");
const run = (cmd, cwd = root) => execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true });

const json = join(tmpdir(), `danse-core-${Date.now()}.json`);
try {
  run(`pnpm --filter @danse/core exec vitest run --reporter=json --outputFile="${json}"`);
} catch {
  /* failures are counted below */
}
const core = JSON.parse(readFileSync(json, "utf8"));
rmSync(json, { force: true });
const files = core.testResults ?? [];
const props = files.filter((f) => /\.prop\.test\.ts$/.test(f.name)).reduce((n, f) => n + (f.assertionResults?.length ?? 0), 0);

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
  "Browser tests passed (Playwright, with axe)": e2e.passed,
  "Browser tests failed": e2e.failed,
};
mkdirSync(join(root, "docs", "measure"), { recursive: true });
writeFileSync(join(root, "docs", "measure", "tests.json"), JSON.stringify(out, null, 1));
console.log(out);
