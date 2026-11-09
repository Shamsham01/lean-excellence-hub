import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  expectReadableTooltipContrast,
  readTooltipContrast,
} from "./helpers/chart-hover-metrics";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Benefits forecast versus actual tooltip", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("multi-series tooltip keeps distinct series name colours", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/benefits");
    await page.getByRole("link", { name: /Changeover Time Savings/i }).click();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();
    await page.getByRole("tab", { name: "Realisation" }).click();
    const panel = page.getByTestId("benefit-realisation-panel");
    await expect(panel).toBeVisible();

    const chart = panel.getByRole("img", {
      name: "Forecast versus validated actual chart",
    });
    await chart.scrollIntoViewIfNeeded();
    const bar = chart.locator(".recharts-rectangle").first();
    await expect(bar).toBeVisible({ timeout: 15_000 });
    await bar.hover({ force: true });

    const tooltip = page
      .locator(".recharts-default-tooltip.leh-recharts-tooltip")
      .first();
    await expect(tooltip).toBeVisible({ timeout: 10_000 });
    await expect(
      tooltip.locator(".recharts-tooltip-item-name").first(),
    ).toBeVisible();

    const nameStyles = await tooltip
      .locator(".recharts-tooltip-item-name")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          text: node.textContent?.trim() ?? "",
          color: getComputedStyle(node).color,
        })),
      );
    expect(nameStyles.length).toBeGreaterThanOrEqual(2);
    const colors = new Set(nameStyles.map((row) => row.color));
    expect(colors.size).toBeGreaterThan(1);

    const { ratio } = await readTooltipContrast(tooltip);
    expectReadableTooltipContrast(ratio);
  });
});
