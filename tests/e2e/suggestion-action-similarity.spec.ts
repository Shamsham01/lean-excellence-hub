import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const sharedPhrase = "sealing jaw regulator packaging";

test.describe("Suggestion and action similarity before save", () => {
  test.setTimeout(120_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("action create form exposes related-record search", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    await expect(page.getByTestId("related-actions-panel")).toBeVisible();
    await expect(page.getByTestId("find-related-records")).toBeVisible();
  });

  test("suggestion related-record search is non-blocking before submit", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    const form = page.getByTestId("new-suggestion-form");
    await form.locator("textarea").nth(0).fill(
      `We noticed ${sharedPhrase} wear during night shift`,
    );
    await form.locator("textarea").nth(1).fill(
      `Replace regulator during planned ${sharedPhrase} maintenance`,
    );
    await expect(form.locator("textarea").nth(0)).toHaveValue(/sealing jaw/);
    const suggestionFind = page.getByTestId("find-related-records");
    await expect(suggestionFind).toBeEnabled();
    await suggestionFind.click();
    await expect(page.getByTestId("continue-with-new-record")).toBeVisible({
      timeout: 30_000,
    });
  });
});
