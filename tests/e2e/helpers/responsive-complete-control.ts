import { expect, type Locator, type Page } from "@playwright/test";

async function scrollPlatformViewportToTop(page: Page) {
  await page.evaluate(() => {
    const viewport = document.querySelector(".platform-main-viewport");
    if (viewport instanceof HTMLElement) {
      viewport.scrollTop = 0;
    }
  });
}

async function scrollPlatformWorkspaceForStickyFooter(page: Page) {
  await page.evaluate(() => {
    const viewport = document.querySelector(".platform-main-viewport");
    if (viewport instanceof HTMLElement) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  });
}

/** Scroll so the control sits inside `.platform-main-viewport`, not only the window. */
async function scrollLocatorWithinPlatformViewport(locator: Locator) {
  await locator.evaluate((el) => {
    const viewport =
      el.closest(".platform-main-viewport") ??
      document.querySelector(".platform-main-viewport");
    if (!(viewport instanceof HTMLElement) || !(el instanceof HTMLElement)) {
      el.scrollIntoView({ block: "center", inline: "nearest" });
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const padding = 24;
    if (elRect.bottom > viewportRect.bottom - padding) {
      viewport.scrollTop += elRect.bottom - viewportRect.bottom + padding;
    } else if (elRect.top < viewportRect.top + padding) {
      viewport.scrollTop -= viewportRect.top - elRect.top + padding;
    }
  });
}

async function clickVisibleResponsiveControl(
  page: Page,
  desktop: Locator,
  mobile: Locator,
) {
  const tryClick = async (
    locator: Locator,
    placement: "header" | "footer",
  ): Promise<boolean> => {
    if ((await locator.count()) === 0) {
      return false;
    }
    if (!(await locator.isVisible())) {
      return false;
    }
    if (placement === "footer") {
      await scrollPlatformWorkspaceForStickyFooter(page);
    } else {
      await scrollPlatformViewportToTop(page);
    }
    await scrollLocatorWithinPlatformViewport(locator);
    await locator.click();
    return true;
  };

  if (await tryClick(desktop, "header")) {
    return;
  }
  if (await tryClick(mobile, "footer")) {
    return;
  }

  const visible = desktop.or(mobile);
  await expect(visible).toBeVisible();
  await scrollLocatorWithinPlatformViewport(visible);
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
