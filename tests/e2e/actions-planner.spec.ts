import { expect, test, type TestInfo } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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
    await expect(page.getByTestId("action-planner-checklist")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("action-planner-labels")).toBeVisible({
      timeout: 15_000,
    });
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

  test("planner sheet: checklist, labels, comment, attachment, and full create", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(180_000);
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");

    const createTitle = `E2E planner full ${Date.now()}`;
    await page.getByTestId("actions-add-new").click();
    await expect(page.getByTestId("action-create-checklist")).toBeVisible();
    await page.locator("#action-create-title").fill(createTitle);

    const assigneeSelect = page.getByTestId("action-create-assignee");
    const assigneeOptions = assigneeSelect.locator("option");
    if ((await assigneeOptions.count()) > 1) {
      await assigneeSelect.selectOption({
        index: 1,
      });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const dueValue = tomorrow.toISOString().slice(0, 10);
    await page.getByTestId("action-create-due").fill(dueValue);

    await expect(page.getByTestId("action-create-labels")).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="action-create-labels"][data-labels-ready="ready"]',
      ),
    ).toBeVisible({ timeout: 20_000 });
    const createLabelToggle = page
      .locator('[data-testid^="action-create-label-"]')
      .first();
    if (await createLabelToggle.isVisible()) {
      if ((await createLabelToggle.getAttribute("aria-pressed")) === "false") {
        await createLabelToggle.click();
      }
    }

    await page
      .getByTestId("action-create-checklist-add")
      .fill("Ship checklist item");
    await page.getByTestId("action-create-checklist-add").press("Enter");
    await page.getByTestId("actions-create-submit").click();
    await expect(page.getByTestId("actions-create-dialog")).not.toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("action-detail-sheet-body")).toContainText(
      createTitle,
      { timeout: 30_000 },
    );
    const sheet = page.getByTestId("action-detail-sheet");
    await expect(page.getByTestId("action-planner-checklist")).toContainText(
      "Ship checklist item",
    );

    const checklist = page.getByTestId("action-planner-checklist");
    await checklist
      .getByTestId("action-planner-checklist-add")
      .fill("Second item");
    await checklist.getByRole("button", { name: "Add" }).click();

    const firstCheckbox = checklist.getByRole("checkbox").first();
    await firstCheckbox.click();
    await expect(firstCheckbox).toBeChecked();

    const deleteSecond = checklist
      .getByRole("listitem")
      .filter({ hasText: "Second item" })
      .getByRole("button", { name: /Delete/i });
    await deleteSecond.click();
    await expect(checklist).not.toContainText("Second item");

    const moveDown = checklist
      .getByRole("listitem")
      .filter({ hasText: "Ship checklist item" })
      .getByRole("button", { name: /Move.*down/i });
    if (await moveDown.isEnabled()) {
      await moveDown.click();
    }

    const labelToggle = page
      .getByTestId("action-planner-labels")
      .getByRole("button", { pressed: false })
      .first();
    await labelToggle.click();

    const newLabelName = `E2E label ${Date.now()}`;
    await sheet.getByTestId("action-planner-labels").scrollIntoViewIfNeeded();
    const newLabelBtn = page.getByTestId("action-label-create");
    await expect(newLabelBtn).toBeVisible();
    await newLabelBtn.click();
    await expect(page.getByTestId("action-label-manage-dialog")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("action-label-manage-name").fill(newLabelName);
    await page.getByTestId("action-label-manage-color").fill("#10B981");
    await page.getByTestId("action-label-manage-save").click();
    await expect(page.getByTestId("action-planner-labels")).toContainText(
      newLabelName,
      { timeout: 15_000 },
    );

    const renamed = `${newLabelName} renamed`;
    await page
      .getByTestId("action-planner-labels")
      .getByRole("button", { name: `Edit ${newLabelName}` })
      .click();
    await page.getByTestId("action-label-manage-name").fill(renamed);
    await page.getByTestId("action-label-manage-save").click();
    await expect(page.getByTestId("action-planner-labels")).toContainText(
      renamed,
      { timeout: 15_000 },
    );

    await page.getByRole("tab", { name: /Discussion/ }).click();
    await page.getByTestId("action-planner-comment-input").fill("E2E comment");
    await page.getByTestId("action-planner-comment-post").click();
    await expect(page.getByTestId("action-planner-comments")).toContainText(
      "E2E comment",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("action-tab-discussion")).toContainText("(");

    await page.getByRole("tab", { name: "Evidence" }).click();
    const fileInput = page.getByTestId("evidence-file-input");
    await fileInput.setInputFiles({
      name: "e2e-planner-note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Planner attachment"),
    });
    await expect(page.getByTestId("evidence-uploader")).toContainText(
      "e2e-planner-note.txt",
      { timeout: 30_000 },
    );

    await fileInput.setInputFiles({
      name: "e2e-cover.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(page.getByTestId("evidence-uploader")).toContainText(
      "e2e-cover.png",
      { timeout: 30_000 },
    );
    const setCover = page.locator('[data-testid^="action-set-cover-"]').first();
    await expect(setCover).toBeVisible({ timeout: 30_000 });
    await setCover.scrollIntoViewIfNeeded();
    await setCover.click();
    await expect(
      page
        .getByTestId("action-planner-attachments")
        .getByRole("button", { name: "Cover" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('[data-testid^="evidence-preview-"]').first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(page.getByTestId("action-card-cover-thumb")).toBeVisible({
      timeout: 30_000,
    });
  });
});
