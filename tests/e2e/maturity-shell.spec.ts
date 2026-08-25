import { test, expect } from "@playwright/test";

test.describe("Maturity routes", () => {
  test("maturity overview page is linked from platform navigation structure", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
