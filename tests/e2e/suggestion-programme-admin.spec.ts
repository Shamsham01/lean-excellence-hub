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

test.describe("S1 suggestions programme administration", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("admin sees two-column configuration with collapsed create actions", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/suggestions/programmes");

    await expect(page.getByTestId("suggestion-programmes-page")).toBeVisible();
    await expect(
      page.getByTestId("programme-management-columns"),
    ).toBeVisible();
    await expect(page.getByTestId("programmes-section")).toBeVisible();
    await expect(page.getByTestId("categories-section")).toBeVisible();
    await expect(page.getByTestId("programme-create-panel")).not.toBeVisible();
    await expect(page.getByTestId("category-create-panel")).not.toBeVisible();
    await expect(
      page.getByLabel("Status", { exact: true }).first(),
    ).toHaveValue("active");
  });

  test("operator cannot access programme management actions", async ({
    page,
  }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/suggestions/programmes");

    await expect(
      page.getByText("Programme management is not available for your role."),
    ).toBeVisible();
    await expect(page.getByTestId("programme-management")).not.toBeVisible();
  });
});
