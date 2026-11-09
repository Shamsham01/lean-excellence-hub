import { expect, test, type TestInfo } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  expectHtmlTheme,
  expectReadableTooltipContrast,
  expectSubtleCursorFill,
  hoverComparisonBarChart,
  readCursorFill,
  readTooltipContrast,
} from "./helpers/chart-hover-metrics";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function setTheme(
  page: import("@playwright/test").Page,
  mode: "light" | "dark",
) {
  const toggle = page
    .getByTestId("platform-topbar")
    .getByTestId("platform-theme-toggle");
  const isDark = await page
    .locator("html")
    .evaluate((root) => root.classList.contains("dark"));
  if ((mode === "dark") !== isDark) {
    await toggle.click();
  }
  await expectHtmlTheme(page, mode);
}

async function attachCardScreenshot(
  card: import("@playwright/test").Locator,
  testInfo: TestInfo,
  name: string,
) {
  const path = testInfo.outputPath(`${name}.png`);
  await card.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test.describe("Analytics chart tooltip theme", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("comparison bar hover tooltip and cursor in light, dark, then light", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/problem-solving");
    await expect(page.getByTestId("pps-analytics")).toBeVisible({
      timeout: 30_000,
    });

    for (const mode of ["light", "dark", "light"] as const) {
      await setTheme(page, mode);
      const { card, tooltip, cursor } = await hoverComparisonBarChart(page);

      const { ratio, fg, bg } = await readTooltipContrast(tooltip);
      expectReadableTooltipContrast(ratio, { fg, bg });
      if (mode === "dark") {
        expect(fg, "dark tooltip label should not use pure black").not.toBe(
          "rgb(0, 0, 0)",
        );
      }
      expect(bg).not.toBe("rgba(0, 0, 0, 0)");

      const fill = await readCursorFill(cursor);
      expectSubtleCursorFill(fill);

      await attachCardScreenshot(card, testInfo, `chart-hover-${mode}`);
    }
  });
});
