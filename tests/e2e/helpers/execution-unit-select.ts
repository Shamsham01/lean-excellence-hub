import { expect, type Locator, type Page } from "@playwright/test";

type Box = { x: number; y: number; width: number; height: number };

export function boxesOverlap(left: Box, right: Box) {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

export async function selectFirstExecutionUnit(page: Page, testId: string) {
  const select = page.getByTestId(testId);
  await expect(select).toBeVisible();
  await select.selectOption({ index: 1 });
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
  const submit = page.getByTestId(input.submitTestId);
  const select = page.getByTestId(input.unitSelectTestId);
  const management = page.getByTestId(input.managementTestId);

  await expect(title).toBeVisible();
  await expect(execution).toBeVisible();
  await expect(submit).toBeVisible();
  await expect(select).toBeVisible();

  const titleBox = await title.boundingBox();
  const executionBox = await execution.boundingBox();
  const submitBox = await submit.boundingBox();
  const selectBox = await select.boundingBox();

  expect(titleBox).toBeTruthy();
  expect(executionBox).toBeTruthy();
  expect(submitBox).toBeTruthy();
  expect(selectBox).toBeTruthy();
  expect(boxesOverlap(titleBox!, executionBox!)).toBe(false);
  expect(boxesOverlap(selectBox!, submitBox!)).toBe(false);

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
