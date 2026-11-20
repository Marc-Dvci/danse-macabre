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
  await page.waitForTimeout(1600); // let the fade-in finish, so contrast is measured at full opacity
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
  const glyph = page.locator("g[data-symbol-id^='right-arm']").first();
  await glyph.dispatchEvent("click");
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

for (const hash of ["#watch", "#video", "#search", "#about"]) {
  test(`accessibility: no axe violations on ${hash}`, async ({ page }) => {
    await page.goto(`/${hash}`);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page }).exclude("canvas").analyze();
    const found = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(" ")} ${n.any[0]?.message ?? ""}`));
    expect(found).toEqual([]);
  });
}

test("search: two arm moves from the Russian dance are found in three other dances, one of them mirrored", async ({ page }) => {
  await page.goto("/#search");
  await page.getByRole("button", { name: /Search \d+ dances/ }).click();
  await expect(page.locator(".status")).toContainText("3 matches for a phrase of 2 symbols");
  const hits = page.locator(".hits li");
  await expect(hits).toHaveCount(3);
  await expect(page.locator(".hits")).toContainText("Macarena, bar 4, count 4 and");
  await expect(hits.filter({ hasText: "Chicken Dance" })).toContainText("mirrored");
  // The phrase's own place in the Russian dance is not reported as a match.
  await expect(page.locator(".hits")).not.toContainText("Russian dance");
});

test("search: a match opens the dance at its bar and count", async ({ page }) => {
  await page.goto("/#search");
  await page.getByRole("button", { name: /Search \d+ dances/ }).click();
  await page.getByRole("button", { name: "Macarena, bar 4, count 4 and" }).click();
  await expect(page).toHaveURL(/#watch$/);
  await expect(page.locator(".dance[aria-current='true']")).toContainText("Macarena");
  await expect(page.locator(".clock")).toHaveText("Bar 4 · count 4 and");
});

test("lesson: the line being danced stays in view while the dance plays", async ({ page }) => {
  await page.goto("/?dance=salsa#watch");
  await page.getByRole("tab", { name: "Lesson" }).click();
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(8000);
  await page.getByRole("button", { name: "Pause" }).click();
  const list = await page.locator(".lesson-list").boundingBox();
  const line = await page.locator(".lesson-list li[aria-current='true']").boundingBox();
  expect(list && line).toBeTruthy();
  expect(line!.y).toBeGreaterThanOrEqual(list!.y);
  expect(line!.y + line!.height).toBeLessThanOrEqual(list!.y + list!.height);
});

test("phone: the dance list shows and the stage controls do not overlap at 390 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?dance=macarena#watch");
  await expect(page.locator("nav.dances button.dance").first()).toBeVisible();
  const camera = page.getByRole("group", { name: "Camera" }).getByRole("button");
  const show = page.getByRole("group", { name: "Show" }).getByRole("button");
  const boxes = async (l: typeof camera) => Promise.all((await l.all()).map((b) => b.boundingBox()));
  for (const a of await boxes(camera)) {
    for (const b of await boxes(show)) {
      const apart = a!.x + a!.width <= b!.x || b!.x + b!.width <= a!.x || a!.y + a!.height <= b!.y || b!.y + b!.height <= a!.y;
      expect(apart).toBe(true);
    }
  }
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});
