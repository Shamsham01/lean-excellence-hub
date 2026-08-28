import { expect, test } from "@playwright/test";

test("renders the commercial landing page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Continuous improvement/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page).toHaveTitle("Lean Excellence Hub");
  await expect(page.getByText("Application baseline")).toHaveCount(0);
});
