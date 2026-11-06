import type { Page } from "@playwright/test";

/** Visible platform shell content (avoids strict-mode duplicates during reload). */
export function platformMain(page: Page) {
  return page.getByTestId("platform-main");
}
