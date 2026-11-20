// The live site, checked on a schedule (.github/workflows/live.yml): it loads, writes a dance down, and plays the finale.
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("danse-macabre:prologue-seen", "1"));
});

test("live: the Macarena is written down and plays", async ({ page }) => {
  await page.goto("?dance=macarena#watch");
  await expect(page).toHaveTitle(/Danse Macabre/);
  const score = page.locator("svg[aria-label^='Labanotation score']");
  await expect(score).toBeVisible();
  expect(Number((await score.getAttribute("aria-label"))?.match(/(\d+) symbols/)?.[1])).toBeGreaterThan(20);
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.locator(".clock")).not.toHaveText("Bar 1 · count 1", { timeout: 10_000 });
});

test("live: the finale's score and its 1953 recording load", async ({ page, request }) => {
  await page.goto("?dance=finale#watch");
  await expect(page.locator("svg[aria-label^='Labanotation score']")).toBeVisible();
  const audio = await request.get("audio/danse-macabre-fourestier-1953.opus");
  expect(audio.status()).toBe(200);
});
