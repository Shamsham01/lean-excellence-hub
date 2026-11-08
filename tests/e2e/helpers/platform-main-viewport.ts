import type { Page } from "@playwright/test";

export async function platformMainViewportScrollTop(page: Page) {
  return page.evaluate(() => {
    const viewport = document.querySelector(
      ".platform-main-viewport",
    ) as HTMLElement | null;
    return viewport?.scrollTop ?? window.scrollY;
  });
}
