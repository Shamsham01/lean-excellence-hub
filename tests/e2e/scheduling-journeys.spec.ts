import { expectPlatformOrganisationName } from "./helpers/platform-home";
import { expect, test, type Page } from "@playwright/test";

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

test.describe("Milestone 6 scheduling journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: schedule page lists demo occurrences", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/schedule");

    await expect(
      page.getByRole("heading", { name: "Schedule", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Weekly Production 5S").first()).toBeVisible();
    await expect(
      page.getByText("Weekly Operations Gemba").first(),
    ).toBeVisible();
  });

  test("admin: 5S overview links to schedule", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/5s");
    await page.getByRole("link", { name: "Upcoming" }).click();
    await expect(page).toHaveURL(/\/platform\/schedule/);
  });
});
