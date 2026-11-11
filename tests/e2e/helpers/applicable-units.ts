import { expect, type Locator, type Page } from "@playwright/test";

type ChooseApplicableUnitOptions = {
  root?: Locator;
  /** When multiple units exist, select the last visible checkbox in the picker. */
  pickLast?: boolean;
};

export async function chooseApplicableUnit(
  page: Page,
  options: ChooseApplicableUnitOptions = {},
) {
  const root = options.root ?? page;
  const editLocations = root.getByTestId("applicable-units-edit-locations");

  if (await editLocations.isVisible().catch(() => false)) {
    await editLocations.click();
    await expect(
      page.getByTestId("applicable-units-picker-dialog"),
    ).toBeVisible();
    const checkbox = options.pickLast
      ? page.getByTestId("applicable-unit-checkbox").last()
      : page.getByTestId("applicable-unit-checkbox").first();
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.check();
    await page.getByTestId("applicable-units-picker-save").click();
    return;
  }

  const legacy = options.pickLast
    ? root.getByTestId("applicable-unit-checkbox").last()
    : root.getByTestId("applicable-unit-checkbox").first();
  await legacy.scrollIntoViewIfNeeded();
  await legacy.check();
}

export async function chooseFirstApplicableUnit(
  page: Page,
  options: Omit<ChooseApplicableUnitOptions, "pickLast"> = {},
) {
  await chooseApplicableUnit(page, options);
}
