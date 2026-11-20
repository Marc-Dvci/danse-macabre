// Measurement, not a pass/fail test: read each reference video in the real app and record how well the score from
// video agrees with the score from motion capture of the same take. Run with: pnpm e2e -g measure
import { test } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SAMPLES = ["Modern dance: arms held high", "Modern dance: expressive arms, pirouette"];

test("measure: video against motion capture", async ({ page }) => {
  test.setTimeout(600_000);
  const results: Array<Record<string, string | number>> = [];
  for (const name of SAMPLES) {
    await page.goto("/#video");
    await page.getByRole("radio", { name }).check();
    const started = Date.now();
    await page.getByRole("button", { name: "Read the dance" }).click();
    const status = page.locator(".status");
    await status.getByText("Written:").waitFor({ timeout: 180_000 });
    await status.getByText("Against the motion capture").waitFor({ timeout: 30_000 });
    const text = (await status.innerText()).replace(/\s+/g, " ");
    const symbols = Number(text.match(/Written: (\d+) symbols/)?.[1]);
    const exact = Number(text.match(/level in (\d+)%/)?.[1]);
    const near = Number(text.match(/neighbouring one in (\d+)%/)?.[1]);
    const checks = Number(text.match(/of (\d+) checks/)?.[1]);
    const offset = Number(text.match(/lined up by (-?[\d.]+) s/)?.[1]);
    const delegate = await page.evaluate(() => (window as unknown as { __poseDelegate?: string }).__poseDelegate ?? "unknown");
    results.push({ video: name, delegate, symbols, exactPercent: exact, nearPercent: near, checks, offsetSeconds: offset, readSeconds: Math.round((Date.now() - started) / 1000) });
    console.log(JSON.stringify(results[results.length - 1]));
  }
  const out = join(import.meta.dirname, "..", "..", "docs", "measure");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "video-vs-mocap.json"), JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 1));
});
