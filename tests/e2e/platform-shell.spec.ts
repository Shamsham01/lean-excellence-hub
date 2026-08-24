import { expect, test } from "@playwright/test";

import {
  ensurePlatformE2eUser,
  platformE2eCredentials,
} from "./helpers/platform-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("authenticated platform shell", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test.beforeAll(async () => {
    await ensurePlatformE2eUser();
  });

  test("renders organisation context and permission-aware navigation", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(platformE2eCredentials.email);
    await page.getByLabel("Password").fill(platformE2eCredentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/platform/);
    await expect(
      page.getByText(platformE2eCredentials.organisationName),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Actions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Templates" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Platform home" }),
    ).toBeVisible();
  });

  test("actions page is reachable from the shell", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(platformE2eCredentials.email);
    await page.getByLabel("Password").fill(platformE2eCredentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("link", { name: "Actions" }).click();
    await expect(page).toHaveURL(/\/platform\/actions/);
    await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
  });
});
