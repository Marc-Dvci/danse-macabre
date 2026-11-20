// Build the README figures: the architecture diagram from architecture.html, and screenshots of the live app at 2x.
//   node docs/figures/render.mjs [base-url] [--only-architecture]   (base URL defaults to the live site)
// The GIFs beside them are cut from Playwright screen recordings of the same site.
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(new URL("../../web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const here = import.meta.dirname;
const BASE = process.argv.slice(2).find((a) => a.startsWith("http")) ?? "https://marc-dvci.github.io/danse-macabre/";
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });

async function page(viewport = { width: 1440, height: 860 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await context.addInitScript(() => window.localStorage.setItem("danse-macabre:prologue-seen", "1"));
  return context.newPage();
}

// Architecture: white ground, about 860 px wide on the README.
{
  const p = await page({ width: 860, height: 600 });
  await p.goto(pathToFileURL(join(here, "architecture.html")).href);
  await p.waitForLoadState("networkidle");
  await p.evaluate(() => document.fonts.ready);
  await p.locator("body").screenshot({ path: join(here, "architecture.png") });
}

if (process.argv.includes("--only-architecture")) { await browser.close(); process.exit(0); }

// Watch: the Macarena two bars in, the skeleton, the ghost, the staff and the line being danced.
{
  const p = await page();
  await p.goto(`${BASE}?dance=macarena&at=6.5#watch`);
  await p.locator("svg[aria-label^='Labanotation score']").waitFor();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: join(here, "watch.png") });
}

// The symbol editor, open on an arm symbol.
{
  const p = await page();
  await p.goto(`${BASE}?dance=macarena&at=6.5#watch`);
  await p.locator("g[data-symbol-id^='left-arm']").nth(3).dispatchEvent("click");
  await p.getByRole("dialog").waitFor();
  await p.waitForTimeout(1500);
  await p.locator(".score-panel").screenshot({ path: join(here, "symbol-editor.png") });
}

// Search: the phrase, and where it was found, once as a mirror image.
{
  const p = await page();
  await p.goto(`${BASE}#search`);
  await p.getByRole("button", { name: /Search \d+ dances/ }).click();
  await p.locator(".hits li").first().waitFor();
  await p.waitForTimeout(500);
  await p.locator(".search-grid").screenshot({ path: join(here, "search.png") });
}

// How to read the score: the legend on the About page.
{
  const p = await page({ width: 1000, height: 860 });
  await p.goto(`${BASE}#about`);
  const legend = p.locator(".legend-grid");
  await legend.scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  await legend.screenshot({ path: join(here, "legend.png") });
}

await browser.close();
console.log("figures written to docs/figures");
