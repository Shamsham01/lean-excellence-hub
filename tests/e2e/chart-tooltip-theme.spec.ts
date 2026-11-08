import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Analytics chart tooltip theme", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("comparison bar chart uses theme tooltip tokens in dark mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/problem-solving");
    await expect(page.getByText("Comparison")).toBeVisible({ timeout: 30_000 });

    await page
      .getByTestId("platform-topbar")
      .getByTestId("platform-theme-toggle")
      .click();

    const chart = page.getByRole("img", { name: "Comparison bar chart" });
    await expect(chart).toBeVisible({ timeout: 30_000 });

    const bar = chart.locator(".recharts-rectangle").first();
    await expect(bar).toBeVisible({ timeout: 15_000 });
    const box = await bar.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

    await page.screenshot({
      path: "/opt/cursor/artifacts/chart-hover-after-dark.png",
      fullPage: false,
    });
  });
});
