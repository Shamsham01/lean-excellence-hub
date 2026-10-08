import { expect, test } from "@playwright/test";

import {
  ensureOnboardingE2eOrganisation,
  onboardingE2eCredentials,
} from "./helpers/onboarding-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("organisation onboarding", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test.beforeAll(async () => {
    await ensureOnboardingE2eOrganisation();
  });

  test("brand-new organisation shows core setup on home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(onboardingE2eCredentials.email);
    await page.getByLabel("Password").fill(onboardingE2eCredentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/platform/);
    await expect(page.getByTestId("core-setup-banner")).toBeVisible();
    await expect(
      page
        .getByTestId("core-setup-banner")
        .getByText("Core setup", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("quick-actions")).toBeVisible();
  });

  test("setup page shows core and recommended sections", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(onboardingE2eCredentials.email);
    await page.getByLabel("Password").fill(onboardingE2eCredentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("link", { name: "Setup", exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/setup/);
    await expect(page.getByTestId("setup-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Get the first site ready" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Before this site can run" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Choose what to configure next" }),
    ).toBeVisible();
    await expect(page.getByText("Core setup", { exact: true })).toBeVisible();
  });

  test("organisation admin can create a root unit", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(onboardingE2eCredentials.email);
    await page.getByLabel("Password").fill(onboardingE2eCredentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/platform/);

    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await page.getByTestId("add-unit-button").click();
    await expect(page.getByTestId("unit-create-form")).toBeVisible();

    const unitName = `E2E Site ${Date.now()}`;
    const unitCode = `e2e-site-${Date.now()}`;
    await page.locator("#unit-name").fill(unitName);
    await page.getByTestId("unit-type-choice").selectOption("custom");
    await expect(page.getByTestId("unit-type")).toBeVisible();
    await page.getByTestId("unit-type").fill("site");
    await page.getByTestId("unit-code-edit").click();
    await page.locator("#unit-code").fill(unitCode);
    await page.getByRole("button", { name: "Create unit" }).click();

    await expect(
      page
        .getByTestId("structure-settings-page")
        .locator('[data-testid^="org-unit-node-"]')
        .filter({ hasText: unitName }),
    ).toBeVisible();
  });

  test("public landing page is commercial quality", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Operational excellence. Connected.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
    await expect(page.getByText("Application baseline")).toHaveCount(0);
  });
});
