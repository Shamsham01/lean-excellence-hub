import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("5S scoring scale", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a local demo database. Scoring rules are covered by unit and pgTAP tests.",
  );

  test("standard setup explains the scale separately from the pass threshold", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s/standards");
    await expect(page.getByTestId("five-s-scoring-scale-fields")).toBeVisible();
    await expect(page.getByLabel("Pass threshold (%)")).toBeVisible();
    await expect(page.getByTestId("five-s-scale-preview")).toContainText(
      "1 is 0%",
    );
    await expect(page.getByTestId("five-s-scale-preview")).toContainText(
      "5 is 100%",
    );

    await page.goto("/platform/5s/setup/quick-start");
    await expect(page.getByText("Scoring scale")).toBeVisible();
    await expect(page.getByText("1 to 5")).toBeVisible();
    await expect(page.getByText("Starting threshold")).toBeVisible();
  });
});
