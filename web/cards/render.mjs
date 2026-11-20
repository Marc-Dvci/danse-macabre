// Render web/cards/og.html to web/public/og.png (1200 x 630), the link preview card.
import { chromium } from "@playwright/test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const here = import.meta.dirname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(join(here, "og.html")).href);
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(here, "..", "public", "og.png") });
await browser.close();
console.log("og.png written");
