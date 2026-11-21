import { expect, test } from "@playwright/test";

test("homepage does not host the interactive playground", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Make continuous improvement visible, accountable and measurable.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Experience improvement, not another product tour.",
    }),
  ).toHaveCount(0);
  await expect(page.getByTestId("leh-demo-start-suggestion")).toHaveCount(0);
  await expect(page.locator("#try-leh")).toHaveCount(0);
});
