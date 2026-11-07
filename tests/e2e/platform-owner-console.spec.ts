import { expect, test } from "@playwright/test";

test("platform owner console login is separate from customer sign-in", async ({
  page,
}) => {
  await page.goto("/org_admin/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("link", { name: /sign up/i })).toHaveCount(0);
});

test("platform owner routes declare noindex metadata", async ({ page }) => {
  await page.goto("/org_admin/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/i,
  );
});

test("unauthenticated console paths redirect to platform sign-in", async ({
  page,
}) => {
  await page.goto("/org_admin");
  await expect(page).toHaveURL(/\/org_admin\/login/);
  await page.goto("/org_admin/organisations");
  await expect(page).toHaveURL(/\/org_admin\/login/);
});
