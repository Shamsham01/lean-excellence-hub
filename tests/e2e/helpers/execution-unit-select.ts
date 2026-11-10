import { expect, type Locator, type Page } from "@playwright/test";

import { openExecutionStartDialog } from "./form-dialogs";

type Box = { x: number; y: number; width: number; height: number };

export function boxesOverlap(left: Box, right: Box) {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

export function executionOpenTestId(submitTestId: string) {
  return `${submitTestId}-open`;
}

export async function ensureExecutionStartDialogOpen(
  page: Page,
  formTestId: "five-s-start-audit-form" | "gemba-start-walk-form",
) {
  const submitTestId = formTestId.replace(/-form$/, "");
  if ((await page.getByTestId(formTestId).count()) === 0) {
    await openExecutionStartDialog(
      page,
      executionOpenTestId(submitTestId),
      formTestId,
    );
  } else if (!(await page.getByTestId(formTestId).isVisible())) {
    await openExecutionStartDialog(
      page,
      executionOpenTestId(submitTestId),
      formTestId,
    );
  }
}

export async function selectFirstExecutionUnit(page: Page, testId: string) {
  const formTestId =
    testId === "five-s-unit-select"
      ? "five-s-start-audit-form"
      : testId === "gemba-unit-select"
        ? "gemba-start-walk-form"
        : null;
  if (formTestId) {
    await ensureExecutionStartDialogOpen(page, formTestId);
  }

  const locked = page.getByTestId(`${testId}-locked`);
  const select = page.getByTestId(testId);
  await expect(locked.or(select).first()).toBeVisible();

  if ((await locked.count()) > 0) {
    await expect(locked).toBeVisible();
    return;
  }

  await expect(select).toBeVisible();
  await select.selectOption({ index: 1 });
}

export async function clickExecutionStartSubmit(
  page: Page,
  submitTestId: "five-s-start-audit" | "gemba-start-walk",
) {
  const formTestId = `${submitTestId}-form` as
    "five-s-start-audit-form" | "gemba-start-walk-form";
  await ensureExecutionStartDialogOpen(page, formTestId);
  await page.getByTestId(submitTestId).click();
}

export async function expectExecutionHeaderLayout(
  page: Page,
  input: {
    managementTestId: string;
    executionTestId: string;
    unitSelectTestId: string;
    submitTestId: string;
  },
) {
  const title = page.getByRole("heading", { level: 1 });
  const execution = page.getByTestId(input.executionTestId);
  const openTrigger = page.getByTestId(executionOpenTestId(input.submitTestId));
  const management = page.getByTestId(input.managementTestId);

  await expect(title).toBeVisible();
  await expect(execution).toBeVisible();
  await expect(openTrigger).toBeVisible();

  const titleBox = await title.boundingBox();
  const executionBox = await execution.boundingBox();
  const openBox = await openTrigger.boundingBox();

  expect(titleBox).toBeTruthy();
  expect(executionBox).toBeTruthy();
  expect(openBox).toBeTruthy();
  expect(boxesOverlap(titleBox!, executionBox!)).toBe(false);

  if ((await management.count()) > 0) {
    await expect(management).toBeVisible();
    const managementBox = await management.boundingBox();
    expect(managementBox).toBeTruthy();
    expect(boxesOverlap(titleBox!, managementBox!)).toBe(false);
    expect(boxesOverlap(managementBox!, executionBox!)).toBe(false);
  }
}

export async function optionLabels(locator: Locator) {
  return locator
    .locator("option:not([value=''])")
    .evaluateAll((options) =>
      options.map((option) => option.textContent?.trim() ?? ""),
    );
}
