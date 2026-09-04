import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { DEMO_USERS } from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function expectMemberAdminPage(page: Page, memberDisplayName: string) {
  await expect(page).toHaveURL(/\/platform\/people\/[^/]+\/admin$/);
  await expect(page.getByTestId("member-admin-page")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: memberDisplayName }),
  ).toBeVisible();
  await expect(page.getByTestId("member-administration-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Identity" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Organisation" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Access" })).toBeVisible();
}

test.describe("Member administration", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: people directory manage opens member administration page", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/people");
    await expect(page.getByTestId("people-directory-page")).toBeVisible();

    const operatorProfileLink = page.getByRole("link", {
      name: `${DEMO_USERS.operator.displayName} Operator`,
    });
    await operatorProfileLink
      .locator("xpath=..")
      .getByRole("link", { name: "Manage" })
      .click();

    await expectMemberAdminPage(page, DEMO_USERS.operator.displayName);
  });

  test("admin: profile settings administration link opens member admin page", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/settings/profile");
    await expect(page.getByTestId("profile-settings-page")).toBeVisible();

    await page
      .getByRole("link", { name: "your administration profile" })
      .click();

    await expectMemberAdminPage(page, DEMO_USERS.admin.displayName);
  });
});
