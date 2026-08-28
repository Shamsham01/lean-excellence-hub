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
      page.getByRole("heading", { name: "Core setup" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recommended next steps" }),
    ).toBeVisible();
  });

  test("organisation admin can create a root unit", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(onboardingE2eCredentials.email);
    await page.getByLabel("Password").fill(onboardingE2eCredentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/platform/);

    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await expect(page.getByTestId("unit-create-form")).toBeVisible();

    const unitCode = `e2e-site-${Date.now()}`;
    await page.getByLabel("Unit code").fill(unitCode);
    await page.getByLabel("Unit name").fill("E2E Site");
    await page.getByLabel("Unit type").fill("site");
    await page.getByRole("button", { name: "Create unit" }).click();

    await expect(page.getByText("Unit created.")).toBeVisible();
    await expect(
      page
        .getByTestId("structure-settings-page")
        .locator("li")
        .filter({ hasText: "E2E Site" }),
    ).toBeVisible();
  });

  test("public landing page is commercial quality", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /Continuous improvement/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Application baseline")).toHaveCount(0);
  });
});
