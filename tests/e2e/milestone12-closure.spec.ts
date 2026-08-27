import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_PROBLEM_SOLVING_CASE,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function loginAs(page: Page, user: keyof typeof DEMO_USERS) {
  const credentials = DEMO_USERS[user];
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Email sign in" }).click();
  await expect(page).toHaveURL(/\/platform/, { timeout: 15_000 });
}

test.describe("Milestone 12 closure", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("manager opens Lean AI on seeded case", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await page.getByTestId("tab-lean-ai").click();
    await expect(page.getByTestId("lean-ai-panel")).toBeVisible();
  });

  test("challenge mode distinguishes assumptions using fake provider", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await page.getByTestId("tab-lean-ai").click();
    await page.getByTestId("lean-ai-mode").selectOption("challenge");
    await page
      .getByTestId("lean-ai-input")
      .fill("Please review assumptions in this case.");
    await page.getByTestId("lean-ai-send").click();
    await expect(page.getByText("assumption", { exact: false })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("operator cannot access Lean AI settings", async ({ page }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/settings/ai");
    await expect(page.getByTestId("ai-settings-page")).toHaveCount(0);
  });
});
