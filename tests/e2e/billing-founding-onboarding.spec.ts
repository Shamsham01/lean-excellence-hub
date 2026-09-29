import { expect, test } from "@playwright/test";

import {
  loginAsFoundingUser,
  provisionFoundingE2eUser,
  type FoundingE2eUser,
} from "./helpers/founding-onboarding";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("founding organisation onboarding", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: FoundingE2eUser;

  test.beforeAll(async () => {
    user = await provisionFoundingE2eUser();
  });

  test("creates a provisioning organisation, waits for billing, then enters the platform", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAsFoundingUser(page, user);

    await expect(page.getByTestId("create-organisation-page")).toBeVisible();
    await page.getByLabel("Organisation name").fill(user.organisationName);
    await page.getByLabel("First site").fill(user.firstSiteName);
    await page.getByLabel("Paid site quantity").fill("1");
    await page.getByRole("button", { name: "Continue to plan" }).click();

    await expect(page).toHaveURL(/\/onboarding(?:\?|$)/);
    await expect(page.getByTestId("onboarding-plan")).toBeVisible();
    await expect(page.getByTestId("onboarding-plan-form")).toContainText(
      "Enterprise is Contact Sales only",
    );
    await expect(page.getByTestId("onboarding-plan")).toContainText(
      "Founder Pilot is not public",
    );
    await page.getByRole("radio", { name: /Professional/ }).check();
    await page.getByRole("button", { name: "Continue to Checkout" }).click();

    await expect(page.getByTestId("onboarding-wait")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText("Checkout return is not treated as success"),
    ).toBeVisible();

    await page.goto("/platform");
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByTestId("onboarding-wait")).toBeVisible();

    await page
      .getByRole("button", { name: "Complete sandbox payment" })
      .click();

    await expect(page.getByTestId("onboarding-setup")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: "Set up Lean Excellence Hub" }),
    ).toBeVisible();

    await page.goto("/platform");
    await expect(page).toHaveURL(/\/onboarding\/setup/);

    await page
      .getByRole("button", { name: "Finish and enter workspace" })
      .click();
    await expect(page).toHaveURL(/\/platform(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByTestId("core-setup-banner")).toBeVisible();

    await page.goto("/platform/settings");
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    await page
      .getByTestId("settings-hub-open-platform-settings-billing")
      .click();
    await expect(page.getByTestId("billing-settings-page")).toBeVisible();
    await expect(page.getByTestId("billing-settings-page")).toContainText(
      "professional",
    );
  });
});
