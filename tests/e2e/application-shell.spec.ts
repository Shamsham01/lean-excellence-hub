import { expect, test } from "@playwright/test";

test("renders the application baseline", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Lean Excellence Hub" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Lean Excellence Hub");
});
