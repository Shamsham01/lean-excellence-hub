import { expect, test } from "@playwright/test";

test("renders the commercial landing page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Operational excellence. Connected.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in" }).first(),
  ).toHaveAttribute("href", "/login");
  await expect(
    page.getByRole("link", { name: "Explore the platform" }).first(),
  ).toHaveAttribute("href", "#platform");
  await expect(page).toHaveTitle(
    "Lean Excellence Hub — Operational Excellence & Continuous Improvement Platform",
  );
  await expect(page.getByText("Application baseline")).toHaveCount(0);
});

test("mobile navigation reaches in-page sections and sign-in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Open menu" }).click();
  const mobileNav = page.getByRole("navigation", { name: "Mobile" });
  await expect(mobileNav).toBeVisible();
  await mobileNav.getByRole("link", { name: "Platform" }).click();
  await expect(page).toHaveURL(/#platform/);
  await expect(
    page.getByRole("heading", { name: "One connected improvement system." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
