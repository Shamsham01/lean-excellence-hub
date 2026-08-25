import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_FIVE_S_STANDARD,
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
  await expect(
    page.getByRole("main").getByText(DEMO_ORGANISATION.name),
  ).toBeVisible();
}

test.describe("Milestone 6 5S journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: overview, standards, and audit workspace", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/5s");

    await expect(page.getByRole("heading", { name: "5S Audits" })).toBeVisible();
    await expect(page.getByText("Completed audits")).toBeVisible();

    await page.getByRole("link", { name: "Standards" }).click();
    await expect(page).toHaveURL(/\/platform\/5s\/standards/);
    await expect(page.getByText(DEMO_FIVE_S_STANDARD.name)).toBeVisible();

    await page.getByRole("link", { name: DEMO_FIVE_S_STANDARD.name }).click();
    await expect(page.getByRole("heading", { name: DEMO_FIVE_S_STANDARD.name })).toBeVisible();

    await page.getByRole("button", { name: "Start audit" }).click();
    await expect(page).toHaveURL(/\/platform\/5s\/audits\//);
    await expect(page.getByLabel("Audit progress")).toBeVisible();
  });

  test("admin: audit history shows completed demo audit", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/5s/history");
    await expect(page.getByRole("heading", { name: "5S history" })).toBeVisible();
    await expect(page.getByText("100%").first()).toBeVisible();
  });
});
