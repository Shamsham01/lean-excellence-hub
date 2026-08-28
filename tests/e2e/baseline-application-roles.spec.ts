import { expect, test, type Page } from "@playwright/test";

import {
  ensureOnboardingE2eOrganisation,
  onboardingE2eCredentials,
} from "./helpers/onboarding-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const BASELINE_ROLE_LABELS = [
  "Organisation Owner",
  "Organisation Administrator",
  "Manager",
  "Team Member",
  "Finance Validator",
] as const;

async function loginAsOnboardingOwner(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(onboardingE2eCredentials.email);
  await page.getByLabel("Password").fill(onboardingE2eCredentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
}

test.describe("Baseline application role catalogue", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a freshly provisioned onboarding organisation",
  );

  test.beforeAll(async () => {
    await ensureOnboardingE2eOrganisation();
  });

  test("people invitations list each baseline application role exactly once", async ({
    page,
  }) => {
    await loginAsOnboardingOwner(page);
    await page.goto("/platform/settings/people");
    await expect(page.getByTestId("people-settings-page")).toBeVisible();

    const roleSelect = page.locator("#invite-role");
    await expect(roleSelect).toBeVisible();

    const optionLabels = await roleSelect
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => option.textContent?.trim() ?? "")
          .filter((label) => label.length > 0),
      );

    for (const label of BASELINE_ROLE_LABELS) {
      expect(optionLabels.filter((option) => option === label)).toHaveLength(1);
    }
  });

  test("manager, team member, and finance validator expose valid access scopes", async ({
    page,
  }) => {
    await loginAsOnboardingOwner(page);
    await page.goto("/platform/settings/people");
    await expect(page.getByTestId("invite-colleague-form")).toBeVisible();

    const roleSelect = page.locator("#invite-role");
    const scopeSelect = page.locator("#invite-scope");

    await roleSelect.selectOption({ label: "Manager" });
    await scopeSelect.selectOption({ label: "Entire organisation" });
    await expect(scopeSelect).toHaveValue(/organisation::null/);

    await roleSelect.selectOption({ label: "Team Member" });
    await expect(scopeSelect).toHaveValue("");
    await scopeSelect.selectOption({ label: "Entire organisation" });
    await expect(scopeSelect).toHaveValue(/organisation::null/);

    await roleSelect.selectOption({ label: "Finance Validator" });
    await expect(scopeSelect).toHaveValue("");
    await scopeSelect.selectOption({ label: "Entire organisation" });
    await expect(scopeSelect).toHaveValue(/organisation::null/);
  });
});
