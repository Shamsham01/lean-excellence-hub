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

async function addCustomSite(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.getByTestId("add-unit-button").click();
  await expect(page.getByTestId("add-unit-drawer")).toBeVisible();
  await page.locator("#unit-name").fill(name);
  await page.getByTestId("unit-type-choice").selectOption("custom");
  await page.getByTestId("unit-type").fill("site");
  await page.getByTestId("unit-create-submit").click();
}

test.describe("trialing subscription site upgrade journey", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: FoundingE2eUser;

  test.beforeAll(async () => {
    user = await provisionFoundingE2eUser();
  });

  test("trial Essentials org hits site limit and is prompted to increase capacity on Billing", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await loginAsFoundingUser(page, user);
    await completeFoundingCheckout(page, user, 1, "not_sure", "Essentials");
    await setOrganisationSubscriptionTrialing(user);

    await page.reload();
    await completeStructureFirstSetupToPlatform(page);

    await page.goto("/platform/settings/billing");
    await expect(page.getByTestId("billing-settings-page")).toBeVisible();
    await expect(page.getByTestId("billing-trial-notice")).toBeVisible();
    await expect(page.getByTestId("billing-site-capacity-headline")).toHaveText(
      "1 of 1 active",
    );

    await page.goto("/platform/settings/structure");
    await addCustomSite(page, "Expansion Site");
    await expect(page.getByTestId("site-capacity-error")).toBeVisible();
    await expect(page.getByTestId("site-capacity-open-billing")).toBeVisible();
    await page.getByTestId("site-capacity-open-billing").click();

    await expect(page.getByTestId("billing-settings-page")).toBeVisible();
    await expect(page.getByTestId("billing-trial-notice")).toBeVisible();
    await expect(page.getByTestId("add-site-capacity-dialog")).toBeVisible();
    await expect(page.getByTestId("desired-site-quantity")).toHaveValue("2");
    await expect(page.getByTestId("add-site-capacity")).toBeVisible();
  });
});
