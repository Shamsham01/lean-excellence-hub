import { expect, test } from "@playwright/test";

import {
  ensureOnboardingE2eOrganisation,
  onboardingE2eCredentials,
} from "./helpers/onboarding-auth";
import { platformNavigation } from "@/modules/platform-shell/navigation";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const mobileWidths = [390, 430];

for (const width of mobileWidths) {
  test.describe(`mobile navigation at ${width}px`, () => {
    test.use({ viewport: { width, height: 700 } });

    test.skip(
      !hasSupabaseE2e,
      "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
    );

    test.beforeAll(async () => {
      await ensureOnboardingE2eOrganisation();
    });

    test("menu drawer scroll reaches platform section items", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(onboardingE2eCredentials.email);
      await page.getByLabel("Password").fill(onboardingE2eCredentials.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/platform/);

      await page.getByRole("button", { name: "Menu" }).click();

      const nav = page.getByRole("navigation", { name: "Platform" });
      await expect(nav).toBeVisible();

      const settingsLink = page.getByRole("link", { name: "Settings" });
      await settingsLink.scrollIntoViewIfNeeded();
      await expect(settingsLink).toBeVisible();
    });

    test("navigation contains all platform sections", async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(onboardingE2eCredentials.email);
      await page.getByLabel("Password").fill(onboardingE2eCredentials.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/platform/);

      await page.getByRole("button", { name: "Menu" }).click();

      for (const section of [
        "Improvement system",
        "People & capability",
        "Platform",
      ]) {
        await expect(page.getByText(section, { exact: true })).toBeVisible();
      }

      for (const item of platformNavigation) {
        const link = page.getByRole("link", { name: item.label, exact: true });
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
      }
    });
  });
}

test.describe("responsive setup and people pages", () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test("setup page renders without horizontal overflow", async ({ page }) => {
    await page.goto("/platform/setup");
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("people settings page renders without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/platform/settings/people");
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
