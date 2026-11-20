// Stop hook: typecheck every package and run every test, then print a short summary for the agent.
import { spawnSync } from "node:child_process";

const steps = [
  ["typecheck", "pnpm", ["-r", "--silent", "typecheck"]],
  ["tests", "pnpm", ["-r", "--silent", "test", "--", "--reporter=dot"]],
];

let failed = false;
for (const [name, cmd, args] of steps) {
  const run = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim().split("\n");
  const tail = out.slice(-12).join("\n");
  console.log(`== ${name}: ${run.status === 0 ? "ok" : "FAILED"}\n${tail}`);
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
