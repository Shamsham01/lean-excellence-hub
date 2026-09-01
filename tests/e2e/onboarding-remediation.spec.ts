import { expect, test, type Page } from "@playwright/test";

import { ensureOnboardingE2eOrganisation } from "./helpers/onboarding-auth";
import { expectPlatformOrganisationName } from "./helpers/platform-home";
import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";
import { platformNavigation } from "@/modules/platform-shell/navigation";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const mobileWidths = [390, 430];

async function loginAsDemoAdmin(page: Page) {
  const credentials = DEMO_USERS.admin;
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
  await expectPlatformOrganisationName(page, DEMO_ORGANISATION.name);
}

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

    test("menu drawer scroll reaches footer utilities", async ({ page }) => {
      await loginAsDemoAdmin(page);

      await page.getByRole("button", { name: "Open navigation menu" }).click();

      const nav = page.getByRole("navigation", { name: "Platform" });
      await expect(nav).toBeVisible();

      const settingsLink = page.getByRole("link", { name: "Settings" });
      await settingsLink.scrollIntoViewIfNeeded();
      await expect(settingsLink).toBeVisible();
    });

    test("navigation contains all platform sections", async ({ page }) => {
      await loginAsDemoAdmin(page);

      await page.getByRole("button", { name: "Open navigation menu" }).click();

      const nav = page.getByRole("navigation", { name: "Platform" });

      for (const section of [
        "Improvement",
        "People & capability",
        "Operations",
      ]) {
        await expect(nav.getByText(section, { exact: true })).toBeVisible();
      }

      for (const item of platformNavigation) {
        const link = nav.getByRole("link", { name: item.label, exact: true });
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
      }

      await expect(
        page.getByRole("link", { name: "Settings", exact: true }),
      ).toBeVisible();
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
