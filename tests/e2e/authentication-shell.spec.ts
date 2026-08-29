import { expect, test } from "@playwright/test";

test("exposes email and workforce sign-in without public signup", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /workforce sign in/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Forgot password/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /sign up/i })).toHaveCount(0);

  await page.goto("/workforce-login");
  await expect(
    page.getByRole("heading", { name: "Workforce sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Organisation code")).toBeVisible();
  await expect(page.getByLabel("Workforce ID or username")).toBeVisible();
});

test("signout cannot be triggered with GET", async ({ request }) => {
  const response = await request.get("/auth/signout", { maxRedirects: 0 });
  expect(response.status()).toBe(405);
});

test("platform routes require authentication", async ({ page }) => {
  await page.goto("/platform");
  await expect(page).toHaveURL(/\/login/);
});

test("Microsoft OAuth is explicitly unavailable", async ({ request }) => {
  const response = await request.get("/auth/oauth/azure", { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});

test("workforce credential POST rejects a missing same-origin proof", async ({
  request,
}) => {
  const response = await request.post("/api/auth/workforce", {
    form: {
      organisationCode: "tenant-a",
      password: "not-a-real-password",
      workforceAlias: "worker-001",
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
});

test("workforce HTML form submission is not blocked by the origin guard", async ({
  page,
}) => {
  await page.goto("/workforce-login");
  await page.getByLabel("Organisation code").fill("apex-manufacturing");
  await page.getByLabel("Workforce ID or username").fill("missing.user");
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/workforce-login\?error=invalid/);
  await expect(
    page.getByText("Unable to sign in with those credentials."),
  ).toBeVisible();
});
