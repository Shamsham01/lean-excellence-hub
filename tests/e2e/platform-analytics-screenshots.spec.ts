import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { signInAsDemoUser } from "./helpers/demo-auth";

const capture = process.env.CAPTURE_ANALYTICS_SCREENSHOTS === "1";
const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const outDir =
  process.env.ANALYTICS_SCREENSHOT_DIR ?? "/opt/cursor/artifacts/tailadmin-polish";

async function setTheme(
  page: import("@playwright/test").Page,
  mode: "light" | "dark",
) {
  await page.evaluate((m) => {
    document.documentElement.classList.toggle("dark", m === "dark");
    localStorage.setItem("theme", m);
  }, mode);
  await page.waitForTimeout(200);
}

test.describe("Platform analytics screenshots", () => {
  test.skip(
    !capture || !hasSupabaseE2e,
    "Set CAPTURE_ANALYTICS_SCREENSHOTS=1 and E2E_WITH_SUPABASE=1",
  );

  test.beforeAll(() => {
    mkdirSync(outDir, { recursive: true });
  });

  test("capture home and actions analytics", async ({ page }) => {
    await signInAsDemoUser(page, "manager");

    for (const viewport of [
      { width: 1280, height: 900, tag: "desktop" },
      { width: 390, height: 844, tag: "mobile" },
    ]) {
      await page.setViewportSize(viewport);
      for (const mode of ["light", "dark"] as const) {
        await setTheme(page, mode);
        await page.goto("/platform?range=30");
        await expect(page.getByTestId("platform-home-analytics")).toBeVisible();
        await page.screenshot({
          path: join(outDir, `platform-home-analytics-${mode}-${viewport.tag}.png`),
          fullPage: false,
        });

        await page.goto("/platform/actions?range=30");
        await expect(page.getByTestId("actions-analytics")).toBeVisible();
        await page.screenshot({
          path: join(
            outDir,
            `actions-analytics-${mode}-${viewport.tag}.png`,
          ),
          fullPage: false,
        });
      }
    }
  });
});
