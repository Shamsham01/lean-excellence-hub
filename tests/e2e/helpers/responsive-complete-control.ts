import { expect, type Locator, type Page } from "@playwright/test";

async function scrollPlatformWorkspaceForStickyFooter(page: Page) {
  await page.evaluate(() => {
    const viewport = document.querySelector(".platform-main-viewport");
    if (viewport instanceof HTMLElement) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  });
}

async function clickVisibleResponsiveControl(
  page: Page,
  desktop: Locator,
  mobile: Locator,
) {
  const candidates = [mobile, desktop];
  for (const locator of candidates) {
    if ((await locator.count()) === 0) {
      continue;
    }
    await scrollPlatformWorkspaceForStickyFooter(page);
    await locator.scrollIntoViewIfNeeded();
    if (await locator.isVisible()) {
      await locator.click();
      return;
    }
  }

  await scrollPlatformWorkspaceForStickyFooter(page);
  const visible = mobile.or(desktop);
  await expect(visible).toBeVisible();
  await visible.click();
}

export async function clickGembaCompleteWalk(page: Page) {
  await clickVisibleResponsiveControl(
    page,
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
    page,
    page.getByTestId("five-s-complete-audit"),
    page.getByTestId("five-s-complete-audit-mobile"),
  );
}

export async function expectNoFiveSCompleteAudit(page: Page) {
  await expect(page.getByTestId("five-s-complete-audit")).toHaveCount(0);
  await expect(page.getByTestId("five-s-complete-audit-mobile")).toHaveCount(0);
}
