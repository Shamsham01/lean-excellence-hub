import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("UX PR2 form dialog deep links", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("suggestions /new route renders the full-page form", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-page")).toBeVisible();
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
  });

  test("maturity assessments /new route renders start assessment form", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/maturity/assessments/new");
    await expect(page.getByTestId("start-assessment-page")).toBeVisible();
    await expect(page.getByTestId("start-assessment-form")).toBeVisible();
  });

  test("training courses ?new=1 opens the create course dialog", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/training/courses?new=1");
    await expect(
      page.getByTestId("training-course-create-dialog"),
    ).toBeVisible();
    await expect(page.getByTestId("training-course-create-form")).toBeVisible();
  });

  test("skills catalog ?new=1 opens the new skill dialog", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/skills/catalog?new=1");
    await expect(
      page.getByTestId("skills-catalog-create-dialog"),
    ).toBeVisible();
    await expect(page.getByTestId("skill-create-form")).toBeVisible();
  });

  test("recognition /new route renders award form", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/recognition/new");
    await expect(page.getByTestId("award-recognition-page")).toBeVisible();
    await expect(page.getByTestId("award-recognition-form")).toBeVisible();
  });

  test("skills scales /new page renders scale create form", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/skills/scales/new");
    await expect(page.getByTestId("skills-scale-new-page")).toBeVisible();
    await expect(page.getByTestId("scale-create-form")).toBeVisible();
  });

  test("skills standards /new page renders standard create form", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/skills/standards/new");
    await expect(page.getByTestId("skills-standard-new-page")).toBeVisible();
    await expect(page.getByTestId("standard-create-form")).toBeVisible();
  });
});
