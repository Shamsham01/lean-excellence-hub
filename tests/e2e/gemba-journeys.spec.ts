import { expectPlatformOrganisationName } from "./helpers/platform-home";
import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_GEMBA_DEFINITION,
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

test.describe("Milestone 6 Gemba journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: overview and definition detail", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/gemba");

    await expect(
      page.getByRole("heading", { name: "Gemba walks" }),
    ).toBeVisible();
    await expect(page.getByText("Completed walks")).toBeVisible();

    await page.getByRole("link", { name: "Definitions" }).click();
    await expect(page).toHaveURL(/\/platform\/gemba\/definitions/);
    await expect(page.getByText(DEMO_GEMBA_DEFINITION.name)).toBeVisible();

    await page.getByRole("link", { name: DEMO_GEMBA_DEFINITION.name }).click();
    await expect(
      page.getByRole("heading", { name: DEMO_GEMBA_DEFINITION.name }),
    ).toBeVisible();
  });

  test("admin: walk history shows completed demo walk", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/gemba/history");
    await expect(
      page.getByRole("heading", { name: "Gemba history" }),
    ).toBeVisible();
    await expect(page.getByText(DEMO_GEMBA_DEFINITION.name)).toBeVisible();
  });
});
