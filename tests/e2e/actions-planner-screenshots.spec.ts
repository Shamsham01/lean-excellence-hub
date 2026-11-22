import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Actions planner screenshots", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("capture list, board, tiles, sheet, and sidebar avatar", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    await expect(page.getByTestId("actions-planner-shell")).toBeVisible();

    await page.screenshot({
      path: "test-results/actions-view-list.png",
      fullPage: true,
    });

    await page.getByTestId("actions-view-board").click();
    await expect(page.getByTestId("actions-board")).toBeVisible();
    await page.screenshot({
      path: "test-results/actions-view-board.png",
      fullPage: true,
    });

    await page.getByTestId("actions-view-tiles").click();
    await expect(page.getByTestId("actions-tiles")).toBeVisible();
    await page.screenshot({
      path: "test-results/actions-view-tiles.png",
      fullPage: true,
    });

    const firstCard = page.getByTestId(/^action-planner-card-/).first();
    await firstCard.click();
    await expect(page.getByTestId("action-detail-sheet-body")).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({
      path: "test-results/actions-detail-sheet.png",
      fullPage: true,
    });

    await page.keyboard.press("Escape");
    await page.screenshot({
      path: "test-results/sidebar-avatar-initials.png",
      fullPage: true,
    });
  });
});
