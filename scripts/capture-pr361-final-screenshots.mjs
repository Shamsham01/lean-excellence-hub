#!/usr/bin/env node
/**
 * Final PR #361 walkthrough captures: auth, alerts, analytics (when signed in).
 * Usage: PREVIEW_URL=... node scripts/capture-pr361-final-screenshots.mjs
 * Optional auth: set DEMO_EMAIL and DEMO_PASSWORD (defaults Apex manager).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl =
  process.env.PREVIEW_URL ??
  "https://deploy-preview-361--lean-excellence-hub.netlify.app";
const outDir = "/opt/cursor/artifacts/tailadmin-polish";
mkdirSync(outDir, { recursive: true });

const demoEmail = process.env.DEMO_EMAIL ?? "manager@apex.local";
const demoPassword = process.env.DEMO_PASSWORD ?? "Manager@Apex-Dev-2026!";

async function setTheme(page, mode) {
  await page.emulateMedia({ colorScheme: mode === "dark" ? "dark" : "light" });
  await page.evaluate((m) => {
    document.documentElement.classList.toggle("dark", m === "dark");
    localStorage.setItem("theme", m);
  }, mode);
  await page.waitForTimeout(200);
}

async function capture(page, fileName) {
  await page.screenshot({ path: join(outDir, fileName), fullPage: false });
}

async function trySignIn(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  const email = page.getByLabel("Email");
  if (!(await email.isVisible({ timeout: 8_000 }).catch(() => false))) {
    return false;
  }
  await email.fill(demoEmail);
  await page.getByLabel("Password").fill(demoPassword);
  await Promise.all([
    page.waitForURL(/\/platform/, { timeout: 45_000 }).catch(() => null),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  return /\/platform/.test(page.url());
}

const browser = await chromium.launch();

for (const viewport of [
  { width: 1280, height: 900, tag: "desktop" },
  { width: 390, height: 844, tag: "mobile" },
]) {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const tag = `${theme}-${viewport.tag}`;

    await page.goto(`${baseUrl}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await setTheme(page, theme);
    await capture(page, `final-sign-in-${tag}.png`);

    await page.goto(`${baseUrl}/update-password`, {
      waitUntil: "domcontentloaded",
    });
    await capture(page, `final-reset-password-${tag}.png`);

    await page.goto(`${baseUrl}/login?error=invalid`, {
      waitUntil: "domcontentloaded",
    });
    await capture(page, `final-sign-in-error-alert-${tag}.png`);

    await page.goto(`${baseUrl}/recover?sent=true`, {
      waitUntil: "domcontentloaded",
    });
    await capture(page, `final-recover-info-alert-${tag}.png`);

    const signedIn = await trySignIn(page);
    if (signedIn) {
      await setTheme(page, theme);
      await page.goto(`${baseUrl}/platform?range=30`, {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByTestId("platform-home-analytics")
        .waitFor({ state: "visible", timeout: 30_000 })
        .catch(() => {});
      await capture(page, `final-home-analytics-${tag}.png`);

      await page.goto(`${baseUrl}/platform/actions?range=30`, {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByTestId("actions-analytics")
        .waitFor({ state: "visible", timeout: 30_000 })
        .catch(() => {});
      await capture(page, `final-actions-analytics-${tag}.png`);
    }

    await context.close();
  }
}

await browser.close();
console.log(`Saved screenshots to ${outDir} (baseUrl=${baseUrl})`);
