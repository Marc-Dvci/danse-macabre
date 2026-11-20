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
  // Contrast is measured once the woodcut and the words have fully faded in (the fade waits for the web fonts).
  await expect(page.locator(".prologue-text")).toHaveCSS("opacity", "1", { timeout: 15_000 });
  await expect(page.locator(".prologue > img")).toHaveCSS("opacity", "1");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Enter the dance" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Danse Macabre" })).toBeHidden();
});

test("prologue: covers the page from its first frame, before the woodcut and the words fade in", async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" });
  const prologue = page.locator(".prologue");
  await prologue.waitFor({ state: "attached" });
  // The backdrop is opaque at once, so the page loading behind it never shows through.
  expect(await prologue.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(13, 11, 10)");
  await expect(prologue).toHaveClass(/\bin\b/);
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
  // The editor says where the symbol is the way the lesson does: bar, count, and a duration in words.
  await expect(page.getByRole("dialog")).toContainText(/bar \d+, count \d+( and)?, (half a count|1 count|a count and a half|\d+( and a half)? counts)/);
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

test("transport: the controls stay still while the count label changes length", async ({ page }) => {
  await page.goto("/?dance=salsa#watch");
  const position = page.getByRole("slider", { name: "Position" });
  const tempo = page.locator(".transport .field input[type='range']");
  const before = [(await position.boundingBox())!.x, (await tempo.boundingBox())!.x];
  await expect(page.locator(".clock")).toHaveText("Bar 1 · count 1");
  // Twenty-two counts on: "Bar 6 · count 3", then half a count more by playing: "Bar 6 · count 3 and" and beyond.
  for (let i = 0; i < 22; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator(".clock")).not.toHaveText("Bar 1 · count 1");
  const after = [(await position.boundingBox())!.x, (await tempo.boundingBox())!.x];
  expect(after).toEqual(before);
});

test("candle: it flares on every count, harder on the first count of a bar", async ({ page }) => {
  await page.goto("/?dance=macarena#watch");
  const flame = page.locator(".playhead .flame");
  await expect(flame).toHaveClass(/down/);
  await page.keyboard.press("ArrowRight");
  await expect(flame).not.toHaveClass(/down/);
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator(".clock")).toHaveText("Bar 2 · count 1");
  await expect(flame).toHaveClass(/down/);
});

test("a press on a control leaves a pale wisp that fades away", async ({ page }) => {
  await page.goto("/#watch");
  await page.getByRole("tab", { name: "Search" }).click();
  await expect(page.locator(".wisp")).toHaveCount(1);
  await expect(page.locator(".wisp")).toHaveCount(0, { timeout: 3000 });
});

test("reduced motion: a press leaves no wisp", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#watch");
  await page.getByRole("tab", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "Find a phrase in every dance" })).toBeVisible();
  await expect(page.locator(".wisp")).toHaveCount(0);
});
