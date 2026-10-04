import { expect, test } from "@playwright/test";

test("public interactive workspace submits a suggestion without leaving the homepage", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Experience improvement, not another product tour.",
    }),
  ).toBeVisible();

  await page.getByTestId("leh-demo-start-suggestion").click();
  await expect(page.getByTestId("leh-demo-suggestion-form")).toBeVisible();
  await page.getByTestId("leh-demo-submit-idea").click();
  await expect(page.getByText("Idea submitted")).toBeVisible();
  await expect(page.getByText("SUG-DEMO-001")).toBeVisible();
  await expect(page.getByTestId("leh-demo-notification-count")).toHaveText("1");
});
