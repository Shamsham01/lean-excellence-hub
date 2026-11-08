import { expect, type Page } from "@playwright/test";

export async function openMobileDrawer(page: Page) {
  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  const nav = drawer.getByRole("navigation", { name: "Platform" });
  await expect(nav).toBeVisible();
  return { drawer, nav };
}
