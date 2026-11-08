import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Actions planner workspace", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("switches list, board, and tiles views and opens the detail sheet", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    await expect(page.getByTestId("actions-planner-shell")).toBeVisible();
    await expect(page.getByTestId("actions-view-switcher")).toBeVisible();

    await page.getByTestId("actions-view-board").click();
    await expect(page.getByTestId("actions-board")).toBeVisible();

    await page.getByTestId("actions-view-tiles").click();
    await expect(page.getByTestId("actions-tiles")).toBeVisible();

    await page.getByTestId("actions-view-list").click();
    await expect(page.getByTestId("actions-planner-list")).toBeVisible();

    const firstCard = page.getByTestId(/^action-planner-card-/).first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page.getByTestId("action-detail-sheet")).toBeVisible();
    await expect(page.getByTestId("action-detail-sheet-body")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("persists the selected view in localStorage", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    await page.getByTestId("actions-view-board").click();
    await page.reload();
    await expect(page.getByTestId("actions-board")).toBeVisible();
  });

  test("create dialog fits mobile viewport with internal scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    await page.getByTestId("actions-add-new").click();
    await expect(page.getByTestId("actions-create-dialog")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create action" }),
    ).toBeVisible();
    await page.screenshot({
      path: "/opt/cursor/artifacts/actions-create-dialog-mobile.png",
    });
    const dialog = page.getByTestId("actions-create-dialog");
    const overflow = await dialog.evaluate((el) => {
      const style = getComputedStyle(el);
      return { overflowY: style.overflowY, maxHeight: style.maxHeight };
    });
    expect(overflow.maxHeight).not.toBe("none");
  });

  test("creates an action from the Add new dialog", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    const title = `E2E planner create ${Date.now()}`;
    await page.getByTestId("actions-add-new").click();
    await expect(page.getByTestId("actions-create-dialog")).toBeVisible();
    await page.locator("#action-create-title").fill(title);
    await page.getByTestId("actions-create-submit").click();
    await expect(page.getByTestId("actions-create-dialog")).not.toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("action-detail-sheet")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("action-detail-sheet-body")).toContainText(
      title,
    );
  });

  test("shows sidebar initials when demo user has no avatar", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform");
    const avatar = page.getByTestId("platform-sidebar-avatar");
    await expect(avatar).toBeVisible();
    await expect(avatar).not.toBeEmpty();
  });
});
