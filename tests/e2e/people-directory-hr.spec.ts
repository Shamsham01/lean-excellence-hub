import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { DEMO_USERS } from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("People directory HR layout", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: directory card filters, table, and profile navigation", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/people");

    await expect(page.getByTestId("people-directory-page")).toBeVisible();
    await expect(page.getByTestId("people-directory-card")).toBeVisible();
    await expect(page.getByTestId("people-directory-table")).toBeVisible();
    await expect(page.getByTestId("people-directory-search")).toBeVisible();
    await expect(
      page.getByTestId("people-directory-unit-filter"),
    ).toBeVisible();
    await expect(
      page.getByTestId("people-directory-status-filter"),
    ).toBeVisible();
    await expect(page.getByTestId("people-directory-pagination")).toBeVisible();

    await page
      .getByTestId("people-directory-search")
      .fill(DEMO_USERS.operator.displayName);
    await page.getByTestId("people-directory-apply-filters").click();

    await expect(
      page.getByRole("link", { name: DEMO_USERS.operator.displayName }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: DEMO_USERS.operator.displayName })
      .click();
    await expect(page.getByTestId("capability-profile-page")).toBeVisible();
  });

  test("admin: mobile stacked cards", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/platform/people");

    await expect(page.getByTestId("people-directory-table")).toBeHidden();
    await expect(
      page.locator('[data-testid^="people-directory-mobile-card-"]').first(),
    ).toBeVisible();
  });
});
