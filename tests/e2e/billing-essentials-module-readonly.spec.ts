import { expect, test } from "@playwright/test";

import {
  completeFoundingCheckout,
  completeStructureFirstSetupToPlatform,
  loginAsFoundingUser,
  provisionFoundingE2eUser,
  setOrganisationSubscriptionTrialing,
  type FoundingE2eUser,
} from "./helpers/founding-onboarding";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Essentials downgrade — read portfolio, deny new writes", () => {
  test.skip(!hasSupabaseE2e, "Requires E2E_WITH_SUPABASE=1 and local Supabase");

  let user: FoundingE2eUser;

  test.beforeAll(async () => {
    user = await provisionFoundingE2eUser();
  });

  test("shows upgrade affordance, disables new project, billing deep-link", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await loginAsFoundingUser(page, user);
    await completeFoundingCheckout(page, user, 1, "not_sure", "Essentials");
    await setOrganisationSubscriptionTrialing(user);
    await page.reload();
    await completeStructureFirstSetupToPlatform(page);

    await page.goto("/platform/projects");
    await expect(page.getByTestId("projects-portfolio")).toBeVisible();
    await expect(
      page.getByTestId("plan-module-upgrade-projects"),
    ).toBeVisible();
    await expect(
      page.locator("[data-module-write-allowed='false']"),
    ).toBeVisible();
    const newProject = page.getByTestId("projects-new-link");
    await expect(newProject).toBeVisible();
    await expect(newProject).toBeDisabled();

    await page.getByTestId("plan-module-upgrade-billing-link").click();
    await expect(page.getByTestId("billing-settings-page")).toBeVisible();
    await expect(
      page.getByTestId("billing-focused-module-upgrade"),
    ).toBeVisible();
  });
});
