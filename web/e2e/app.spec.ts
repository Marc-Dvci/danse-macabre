import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }, info) => {
  if (info.title.startsWith("prologue")) return;
  await page.addInitScript(() => window.localStorage.setItem("danse-macabre:prologue-seen", "1"));
});

test("prologue: shown on a first visit, gone after Enter, and free of axe violations", async ({ page }) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Danse Macabre" });
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Enter the dance" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Danse Macabre" })).toBeHidden();
});

test("watch: a dance loads, its score is written, and playback moves the count", async ({ page }) => {
  await page.goto("/#watch");
  const scoreSvg = page.locator("svg[aria-label^='Labanotation score']");
  await expect(scoreSvg).toBeVisible();
  const label = await scoreSvg.getAttribute("aria-label");
  const symbols = Number(label?.match(/(\d+) symbols/)?.[1] ?? 0);
  expect(symbols).toBeGreaterThan(5);

  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(2500);
  await expect(page.locator(".clock")).not.toHaveText("Bar 1 · count 1");
  await page.getByRole("button", { name: "Pause" }).click();
});

test("watch: every dance in the list writes a score", async ({ page }) => {
  await page.goto("/#watch");
  const dances = page.locator("nav.dances button.dance");
  const n = await dances.count();
  expect(n).toBeGreaterThanOrEqual(9);
  for (let i = 0; i < n; i++) {
    await dances.nth(i).click();
    await expect(page.locator("svg[aria-label^='Labanotation score']")).toBeVisible();
  }
});

test("watch: editing a symbol changes the lesson line", async ({ page }) => {
  await page.goto("/#watch");
  const glyph = page.locator("g[data-symbol-id]:not([data-symbol-id^='start:'])").first();
  await glyph.click({ force: true });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("group", { name: "Level" }).getByRole("button", { name: "low" }).click();
  await page.getByRole("tab", { name: "Lesson" }).click();
  await expect(page.locator(".lesson-list")).toContainText("low");
});

test("lesson tab lists the lesson lines", async ({ page }) => {
  await page.goto("/#watch");
  await page.getByRole("tab", { name: "Lesson" }).click();
  const items = page.locator(".lesson-list li");
  expect(await items.count()).toBeGreaterThan(3);
});

for (const hash of ["#watch", "#video", "#about"]) {
  test(`accessibility: no axe violations on ${hash}`, async ({ page }) => {
    await page.goto(`/${hash}`);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page }).exclude("canvas").analyze();
    const found = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(" ")} ${n.any[0]?.message ?? ""}`));
    expect(found).toEqual([]);
  });
}

test("search: a phrase cut from the Macarena is found elsewhere in it, not at its own place", async ({ page }) => {
  await page.goto("/#search");
  await page.getByRole("button", { name: /Search \d+ dances/ }).click();
  const status = page.locator(".status");
  await expect(status).toContainText(/\d+ match/);
  await expect(page.locator(".hits li").first()).toBeVisible();
  await expect(page.locator(".hits")).not.toContainText("Macarena, bar 1, count 2");
});
