import { expect, test, type TestInfo } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function attachDialogScreenshot(
  page: import("@playwright/test").Page,
  testInfo: TestInfo,
  name: string,
) {
  const dialog = page.getByTestId("actions-create-dialog");
  const path = testInfo.outputPath(`${name}.png`);
  await dialog.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

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

    await page.getByTestId("actions-filter-button").click();
    await expect(page.getByTestId("actions-filters")).toBeVisible();
    await page.keyboard.press("Escape");

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
    await expect(page.getByTestId("action-planner-checklist")).toBeVisible();
    await expect(page.getByTestId("action-planner-labels")).toBeVisible();
    await expect(page.locator('[data-planner-task-dialog=""]')).toBeVisible();
  });

  test("persists the selected view in localStorage", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    await page.getByTestId("actions-view-board").click();
    await page.reload();
    await expect(page.getByTestId("actions-board")).toBeVisible();
  });

  test("create dialog traps focus and returns it to Add new after clean cancel", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    const addNew = page.getByTestId("actions-add-new");
    await addNew.click();
    const dialog = page.getByTestId("actions-create-dialog");
    await expect(dialog).toBeVisible();
    await page.locator("#action-create-title").click();
    await page.keyboard.press("Tab");
    const focusInDialog = await dialog.evaluate((el) =>
      el.contains(document.activeElement),
    );
    expect(focusInDialog).toBe(true);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(addNew).toBeFocused();
  });

  test("dirty dismiss paths show discard confirmation and keep draft until confirmed", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    await page.getByTestId("actions-add-new").click();
    const dialog = page.getByTestId("actions-create-dialog");
    await page.locator("#action-create-title").fill("Keep open");
    await page.keyboard.press("Escape");
    await expect(
      page.getByTestId("actions-create-discard-dialog"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x - 12, box!.y + box!.height / 2);
    await expect(
      page.getByTestId("actions-create-discard-dialog"),
    ).toBeVisible();
    await page.getByTestId("actions-create-discard-confirm").click();
    await expect(dialog).not.toBeVisible();
    await page.getByTestId("actions-add-new").click();
    await expect(page.locator("#action-create-title")).toHaveValue("");
  });

  test("create dialog scrolls on mobile when content exceeds viewport", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 520 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    await page.getByTestId("actions-add-new").click();
    await expect(page.getByTestId("actions-create-dialog")).toBeVisible();
    await page
      .locator("#action-create-description")
      .fill("Observation note.\n".repeat(80));
    const scroller = page.locator(
      '[data-testid="actions-create-dialog"] [data-dialog-scroll]',
    );
    const overflow = await scroller.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight + 4);
    const before = await scroller.evaluate((el) => el.scrollTop);
    await page.getByTestId("actions-create-submit").scrollIntoViewIfNeeded();
    const after = await scroller.evaluate((el) => el.scrollTop);
    expect(after).toBeGreaterThan(before);
    await attachDialogScreenshot(
      page,
      testInfo,
      "actions-create-dialog-mobile",
    );
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

  test("opens create dialog from empty state", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    const empty = page.getByTestId("actions-empty-state");
    if (await empty.isVisible()) {
      await empty.getByRole("button", { name: "Add new action" }).click();
      await expect(page.getByTestId("actions-create-dialog")).toBeVisible();
    }
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
