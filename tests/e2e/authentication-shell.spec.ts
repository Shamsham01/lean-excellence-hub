import { expect, test } from "@playwright/test";

test("exposes email and workforce sign-in without public workforce signup", async ({
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
  await page.goto("/login?error=invalid");
  await expect(page.getByTestId("login-error")).toContainText(
    /unable to sign in\. check your email and password/i,
  );
  await expect(
    page.getByRole("link", { name: "Reset password" }),
  ).toHaveAttribute("href", "/recover");
  await expect(
    page.getByText("Unable to sign in with those credentials."),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /sign up/i })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Create your account" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Create your account" }).click();
  await expect(page).toHaveURL(/\/signup/);
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(page.getByTestId("founding-signup-form")).toBeVisible();
  await expect(
    page.getByText(/organisation setup follows after you confirm your email/i),
  ).toBeVisible();
  await expect(
    page.getByText(
      /joining an existing organisation still requires an invitation/i,
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Reset it" })).toHaveAttribute(
    "href",
    "/recover",
  );

  await page.goto("/workforce-login");
  await expect(
    page.getByRole("heading", { name: "Workforce sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Organisation code")).toBeVisible();
  await expect(page.getByLabel("Workforce ID or username")).toBeVisible();
});

test("expired recovery links stay on recover with useful copy", async ({
  page,
}) => {
  await page.goto("/recover?error=expired");
  await expect(page.getByTestId("recover-expired")).toContainText(
    /this recovery link is invalid or has expired/i,
  );
  await expect(
    page.getByRole("button", { name: "Request another recovery email" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to sign in" }),
  ).toHaveAttribute("href", "/login");
  await expect(
    page.getByText("Unable to sign in with those credentials."),
  ).toHaveCount(0);
});

test("check-email signup state stays anti-enumeration-safe", async ({
  page,
}) => {
  await page.goto("/signup?status=check-email");

  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /if this is a new account, we've sent a confirmation link\. if you already have an account, sign in or reset your password\./i,
    ),
  ).toBeVisible();
  await expect(page.getByTestId("founding-signup-check-email")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  await expect(
    page.getByRole("link", { name: "Forgot password?" }),
  ).toHaveAttribute("href", "/recover");
  await expect(
    page.getByRole("link", { name: "Use a different email" }),
  ).toHaveAttribute("href", "/signup");
  await expect(page.getByText(/email already exists/i)).toHaveCount(0);
  await expect(
    page.getByText(
      /confirm your address to finish creating your organisation/i,
    ),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/signup?status=check-email");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/recover/);

  await page.goto("/signup?status=check-email");
  await page.getByRole("link", { name: "Use a different email" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByTestId("founding-signup-form")).toBeVisible();
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
