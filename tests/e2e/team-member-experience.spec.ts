import { expect, test, type Page } from "@playwright/test";

import { expectPlatformOrganisationName } from "./helpers/platform-home";
import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function loginAs(page: Page, user: keyof typeof DEMO_USERS) {
  const credentials = DEMO_USERS[user];
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
  await expectPlatformOrganisationName(page, DEMO_ORGANISATION.name);
}

test.describe("M1 team member experience closure", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("operator sees employee navigation without organisation setup", async ({
    page,
  }) => {
    await loginAs(page, "operator");
    await expect(
      page.getByRole("link", { name: "Setup", exact: true }),
    ).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Actions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Suggestions" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
  });

  test("operator profile shows active application access", async ({ page }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/settings/profile");
    await expect(page.getByTestId("profile-settings-page")).toBeVisible();
    await expect(page.getByTestId("profile-application-role")).not.toHaveText(
      "No active access grants",
    );
    await expect(page.getByTestId("profile-access-scope")).not.toHaveText(
      "Not assigned",
    );
  });

  test("operator actions page is read-only", async ({ page }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/actions");
    await expect(page.getByTestId("actions-page")).toBeVisible();
    await expect(page.getByTestId("actions-create-form")).not.toBeVisible();
  });

  test("admin actions page still renders create form", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/actions");
    await expect(page.getByTestId("actions-create-form")).toBeVisible();
  });

  test("problem-solving contributor sees portfolio without create CTA", async ({
    page,
  }) => {
    await loginAs(page, "psContributor");
    await page.goto("/platform/problem-solving");
    await expect(
      page.getByTestId("problem-solving-portfolio-page"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "New case" }),
    ).not.toBeVisible();

    const emptyState = page.getByTestId("problem-solving-empty-state");
    if (await emptyState.isVisible()) {
      await expect(emptyState).toContainText(
        "currently available in your scope",
      );
    }
  });

  test("operator can submit suggestion when programme and categories exist", async ({
    page,
  }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await expect(
      page.getByTestId("suggestion-configuration-block"),
    ).not.toBeVisible();
    await page
      .locator("textarea")
      .first()
      .fill("Loose cable routing on Line 2");
    await page
      .locator("textarea")
      .nth(1)
      .fill("Route cables through dedicated trunking");
    await page.getByRole("button", { name: "Submit idea" }).click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
  });
});
