import { expect, test, type Page } from "@playwright/test";

import {
  ensureOnboardingE2eOrganisation,
  onboardingE2eCredentials,
  onboardingE2eRootUnit,
  onboardingOrgAdminCredentials,
} from "./helpers/onboarding-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const BASELINE_ROLE_LABELS = [
  "Organisation Owner",
  "Organisation Administrator",
  "Manager",
  "Team Member",
  "Finance Validator",
] as const;

const ORG_ADMIN_DELEGATABLE_ROLE_LABELS = [
  "Organisation Administrator",
  "Manager",
  "Team Member",
] as const;

async function loginAs(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
}

async function loginAsOnboardingOwner(page: Page) {
  await loginAs(page, onboardingE2eCredentials);
}

async function loginAsOnboardingOrgAdmin(page: Page) {
  await loginAs(page, onboardingOrgAdminCredentials);
}

async function readScopeOptionLabels(page: Page) {
  const scopeSelect = page.locator("#invite-scope");
  return scopeSelect
    .locator("option")
    .evaluateAll((options) =>
      options
        .map((option) => option.textContent?.trim() ?? "")
        .filter((label) => label.length > 0 && label !== "Select scope"),
    );
}

test.describe("Baseline application role catalogue", () => {
  test.describe.configure({ mode: "serial" });

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

  test("owner invitation picker exposes authoritative scope options per baseline role", async ({
    page,
  }) => {
    await loginAsOnboardingOwner(page);
    await page.goto("/platform/settings/people");
    await expect(page.getByTestId("invite-colleague-form")).toBeVisible();

    const roleSelect = page.locator("#invite-role");
    const scopeSelect = page.locator("#invite-scope");

    for (const roleLabel of [
      "Organisation Owner",
      "Organisation Administrator",
      "Finance Validator",
    ] as const) {
      await roleSelect.selectOption({ label: roleLabel });
      await expect(scopeSelect).toHaveValue("");
      const scopeLabels = await readScopeOptionLabels(page);
      expect(scopeLabels).toEqual(["Entire organisation"]);
      await scopeSelect.selectOption({ label: "Entire organisation" });
      await expect(scopeSelect).toHaveValue(/organisation::null/);
    }

    for (const roleLabel of ["Manager", "Team Member"] as const) {
      await roleSelect.selectOption({ label: roleLabel });
      await expect(scopeSelect).toHaveValue("");
      const scopeLabels = await readScopeOptionLabels(page);
      expect(scopeLabels).toContain(onboardingE2eRootUnit.name);
      expect(scopeLabels).not.toContain("Entire organisation");
      await scopeSelect.selectOption({ label: onboardingE2eRootUnit.name });
      await expect(scopeSelect).toHaveValue(/unit_subtree::/);
    }
  });

  test("organisation administrator invitation picker allows workforce onboarding roles only", async ({
    page,
  }) => {
    await loginAsOnboardingOrgAdmin(page);
    await page.goto("/platform/settings/people");
    await expect(page.getByTestId("invite-colleague-form")).toBeVisible();

    const roleSelect = page.locator("#invite-role");
    const scopeSelect = page.locator("#invite-scope");

    const optionLabels = await roleSelect
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => option.textContent?.trim() ?? "")
          .filter((label) => label.length > 0),
      );

    for (const label of ORG_ADMIN_DELEGATABLE_ROLE_LABELS) {
      expect(optionLabels).toContain(label);
    }

    expect(optionLabels).not.toContain("Organisation Owner");
    expect(optionLabels).not.toContain("Finance Validator");

    await roleSelect.selectOption({ label: "Organisation Administrator" });
    const adminScopeLabels = await readScopeOptionLabels(page);
    expect(adminScopeLabels).toEqual(["Entire organisation"]);

    await roleSelect.selectOption({ label: "Manager" });
    const managerScopeLabels = await readScopeOptionLabels(page);
    expect(managerScopeLabels).toContain(onboardingE2eRootUnit.name);
    expect(managerScopeLabels).not.toContain("Entire organisation");

    await roleSelect.selectOption({ label: "Team Member" });
    const memberScopeLabels = await readScopeOptionLabels(page);
    expect(memberScopeLabels).toContain(onboardingE2eRootUnit.name);
    expect(memberScopeLabels).not.toContain("Entire organisation");
    await scopeSelect.selectOption({ label: onboardingE2eRootUnit.name });
    await expect(scopeSelect).toHaveValue(/unit_subtree::/);
  });
});
