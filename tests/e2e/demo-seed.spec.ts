import { expect, test } from "@playwright/test";

import { expectPlatformOrganisationName } from "./helpers/platform-home";
import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Apex demo seed", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack with demo seed applied",
  );

  test("demo admin reaches the authenticated platform shell", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DEMO_USERS.admin.email);
    await page.getByLabel("Password").fill(DEMO_USERS.admin.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/platform/);
    await expectPlatformOrganisationName(page, DEMO_ORGANISATION.name);
    await expect(page.getByRole("link", { name: "Actions" })).toBeVisible();
  });

  test("demo admin can open Actions and Templates", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DEMO_USERS.admin.email);
    await page.getByLabel("Password").fill(DEMO_USERS.admin.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("link", { name: "Actions" }).click();
    await expect(page).toHaveURL(/\/platform\/actions/);
    await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();

    await page.getByRole("link", { name: "Templates" }).click();
    await expect(page).toHaveURL(/\/platform\/templates/);
    await expect(
      page.getByRole("heading", { name: "Templates" }),
    ).toBeVisible();
  });
});
