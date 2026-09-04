import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Milestone 9 closure", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("operator submits a suggestion", async ({ page }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-page")).toBeVisible();
    await page.locator("textarea").first().fill("Loose labels on the line");
    await page
      .locator("textarea")
      .nth(1)
      .fill("Use colour-coded label holders");
    await page.getByRole("button", { name: "Submit idea" }).click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
  });

  test("manager sees recognition feed", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/recognition");
    await expect(page.getByTestId("recognition-feed")).toBeVisible();
    await expect(
      page.getByTestId("recognition-feed-item").first(),
    ).toBeVisible();
  });

  test("manager opens review queue", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/suggestions/review");
    await expect(page.getByTestId("suggestion-review-queue")).toBeVisible();
  });

  test("operator cannot open award recognition", async ({ page }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/recognition/new");
    await expect(page.getByTestId("award-recognition-page")).not.toBeVisible();
  });
});
