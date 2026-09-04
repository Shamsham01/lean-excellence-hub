import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("S1 suggestions programme administration", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("admin sees two-column configuration with collapsed create actions", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
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
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/programmes");

    await expect(
      page.getByText("Programme management is not available for your role."),
    ).toBeVisible();
    await expect(page.getByTestId("programme-management")).not.toBeVisible();
  });
});
