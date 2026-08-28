import { expect, test, type Page } from "@playwright/test";

import { expectPlatformOrganisationName } from "./helpers/platform-home";
import {
  DEMO_ORGANISATION,
  DEMO_ROLES,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function loginAsAdmin(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEMO_USERS.admin.email);
  await page.getByLabel("Password").fill(DEMO_USERS.admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
  await expectPlatformOrganisationName(page, DEMO_ORGANISATION.name);
}

test.describe("Invitation application role picker", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("people settings shows distinct application roles without duplicate owner labels", async ({
    page,
  }) => {
    await loginAsAdmin(page);
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

    expect(optionLabels.length).toBeGreaterThan(1);

    const uniqueLabels = new Set(optionLabels);
    expect(uniqueLabels.size).toBe(optionLabels.length);

    const ownerLabels = optionLabels.filter(
      (label) => label === "Organisation Owner",
    );
    expect(ownerLabels).toHaveLength(1);

    for (const role of Object.values(DEMO_ROLES)) {
      expect(optionLabels).toContain(role.displayName);
    }
  });

  test("changing application role resets scope and offers role-appropriate scopes", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/platform/settings/people");
    await expect(page.getByTestId("invite-colleague-form")).toBeVisible();

    const roleSelect = page.locator("#invite-role");
    const scopeSelect = page.locator("#invite-scope");

    await roleSelect.selectOption({ label: DEMO_ROLES.manager.displayName });
    await scopeSelect.selectOption({ label: "Cornwall Plant" });
    await expect(scopeSelect).not.toHaveValue("");

    await roleSelect.selectOption({ label: DEMO_ROLES.operator.displayName });
    await expect(scopeSelect).toHaveValue("");

    await scopeSelect.selectOption({ label: "Entire organisation" });
    await expect(scopeSelect).toHaveValue(/organisation::null/);
  });
});
