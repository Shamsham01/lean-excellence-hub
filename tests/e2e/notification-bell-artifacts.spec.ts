import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Notification bell artifacts (#341)", () => {
  test.skip(!hasSupabaseE2e, "Requires E2E_WITH_SUPABASE=1 and demo seed");

  test("captures desktop panel screenshots", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopBell = page
      .getByTestId("platform-desktop-sidebar")
      .getByTestId("platform-notification-bell");
    await desktopBell.click();
    await expect(page.getByTestId("platform-notification-list")).toBeVisible();
    await page.screenshot({
      path: "/opt/cursor/artifacts/notification-bell-desktop-light.png",
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({
      path: "/opt/cursor/artifacts/notification-bell-desktop-dark.png",
    });
  });

  test("captures mobile drawer bell panel", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Platform navigation" });
    const mobileBell = drawer.getByTestId("platform-notification-bell");
    await mobileBell.focus();
    await page.keyboard.press("Enter");
    await expect(mobileBell).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("platform-notification-list")).toBeVisible();
    await page.screenshot({
      path: "/opt/cursor/artifacts/notification-bell-mobile-light.png",
    });
  });
});
