import type { Page } from "@playwright/test";

/** Sign out in the sidebar account block (desktop + mobile drawer). */
export function platformSidebarSignOut(page: Page) {
  return page
    .locator('[data-testid="platform-sidebar-account"]:visible')
    .getByTestId("platform-chrome-sign-out");
}
