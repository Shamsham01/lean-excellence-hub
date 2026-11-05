import { expect, type Locator, type Page } from "@playwright/test";

async function clickVisibleResponsiveControl(
  desktop: Locator,
  mobile: Locator,
) {
  if (await mobile.isVisible()) {
    await mobile.click();
    return;
  }
  await expect(desktop).toBeVisible();
  await desktop.click();
}

export async function clickGembaCompleteWalk(page: Page) {
  await clickVisibleResponsiveControl(
    page.getByTestId("gemba-complete-walk"),
    page.getByTestId("gemba-complete-walk-mobile"),
  );
}

export async function expectNoGembaCompleteWalk(page: Page) {
  await expect(page.getByTestId("gemba-complete-walk")).toHaveCount(0);
  await expect(page.getByTestId("gemba-complete-walk-mobile")).toHaveCount(0);
}

export async function clickFiveSCompleteAudit(page: Page) {
  await clickVisibleResponsiveControl(
    page.getByTestId("five-s-complete-audit"),
    page.getByTestId("five-s-complete-audit-mobile"),
  );
}

export async function expectNoFiveSCompleteAudit(page: Page) {
  await expect(page.getByTestId("five-s-complete-audit")).toHaveCount(0);
  await expect(page.getByTestId("five-s-complete-audit-mobile")).toHaveCount(0);
}
