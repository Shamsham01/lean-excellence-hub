import { expect, type Page } from "@playwright/test";

/** Opens the planner create dialog from Add new or empty-state CTA. */
export async function openActionsCreateDialog(page: Page) {
  const addNew = page.getByTestId("actions-add-new");
  if (await addNew.isVisible()) {
    await addNew.click();
  } else {
    await page
      .getByTestId("actions-empty-state")
      .getByRole("button", { name: "Add new action" })
      .click();
  }
  await expect(page.getByTestId("actions-create-dialog")).toBeVisible();
}

/** Creates an action via the Add new dialog and waits for the detail sheet. */
export async function createActionViaPlannerDialog(
  page: Page,
  title: string,
  description: string,
) {
  await openActionsCreateDialog(page);
  await page.locator("#action-create-title").fill(title);
  await page.locator("#action-create-description").fill(description);
  await page.getByTestId("actions-create-submit").click();
  await expect(page.getByTestId("actions-create-dialog")).not.toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("action-detail-sheet")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("action-detail-page")).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Navigates to the stable full-page action workspace route (`/platform/actions/:id`).
 * Call after create when the planner only sets `?action=` on the list URL.
 */
export async function openActionDetailPageFromPlanner(page: Page) {
  let actionId: string | null = null;
  await expect
    .poll(() => {
      actionId = new URL(page.url()).searchParams.get("action");
      return actionId;
    })
    .toBeTruthy();
  const path = `/platform/actions/${actionId}`;
  await page.goto(path);
  await expect(page.getByTestId("action-detail-page")).toBeVisible({
    timeout: 30_000,
  });
  return path;
}
