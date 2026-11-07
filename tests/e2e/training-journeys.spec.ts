import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  expectExactHeading,
  expectModulePageHeading,
} from "./helpers/module-page-heading";
import {
  DEMO_TRAINING_COURSES,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Milestone 7 training journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: training overview and matrix show demo courses", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/training");

    await expectModulePageHeading(page, "Training");
    await expect(page.getByText("Training compliance")).toBeVisible();
    await expect(
      page
        .getByTestId(/^training-hub-course-link-/)
        .filter({ hasText: DEMO_TRAINING_COURSES[0].name }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Training matrix" }).click();
    await expect(page).toHaveURL(/\/platform\/training\/matrix/);
    await expect(
      page.getByRole("heading", { name: "Training matrix" }),
    ).toBeVisible();
  });

  test("admin: people directory and capability profile", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/people");
    await expectExactHeading(page, "People");

    await page
      .getByRole("link", { name: DEMO_USERS.operator.displayName })
      .click();
    await expect(
      page.getByRole("heading", { name: DEMO_USERS.operator.displayName }),
    ).toBeVisible();
    await expectExactHeading(page, "Training");
    await expectExactHeading(page, "Skills");
  });
});

test.describe("Milestone 7 skills journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("manager: skills matrix loads", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/skills/matrix");
    await expect(
      page.getByRole("heading", { name: "Skills matrix" }),
    ).toBeVisible();
  });
});
