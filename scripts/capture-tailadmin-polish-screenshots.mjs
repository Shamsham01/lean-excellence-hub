#!/usr/bin/env node
/**
 * Capture auth/chart/alert screenshots for TailAdmin polish PR.
 * Usage: node scripts/capture-tailadmin-polish-screenshots.mjs
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";
const outDir = "/opt/cursor/artifacts/tailadmin-polish";
mkdirSync(outDir, { recursive: true });

async function applyTheme(page, theme) {
  await page.emulateMedia({
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  await page.evaluate((t) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
    document.documentElement.style.colorScheme =
      t === "dark" ? "dark" : "light";
  }, theme);
}

async function capture(page, name, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(outDir, name), fullPage: true });
}

const browser = await chromium.launch();
const contexts = [];

for (const viewport of [
  { width: 1280, height: 900, tag: "desktop" },
  { width: 390, height: 844, tag: "mobile" },
]) {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await applyTheme(page, theme);
    const t = `${theme}-${viewport.tag}`;
    await capture(page, `sign-in-${t}.png`, "/login");
    await capture(page, `reset-password-${t}.png`, "/update-password");
    await capture(page, `recover-alert-info-${t}.png`, "/recover?sent=true");
    await capture(page, `sign-in-error-alert-${t}.png`, "/login?error=invalid");
    await context.close();
  }
}

await browser.close();
console.log(`Screenshots saved to ${outDir}`);
