import { expect, test } from "@playwright/test";

import {
  HERO_HEADLINE,
  landingCopy,
} from "../../src/lib/marketing/landing-copy";

test("renders the commercial landing page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: HERO_HEADLINE,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in" }).first(),
  ).toHaveAttribute("href", "/login");
  await expect(
    page.getByRole("link", { name: "Book a live demo" }).first(),
  ).toHaveAttribute("href", "/demo");
  await expect(
    page.locator("#hero").getByRole("link", { name: "Get free access" }),
  ).toHaveAttribute("href", "/early-access");
  await expect(page).toHaveTitle(
    "Lean Excellence Hub — Operational Excellence & Continuous Improvement Platform",
  );
  await expect(page.getByText("Application baseline")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Appearance/ })).toHaveCount(0);
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
    page.getByRole("heading", { name: landingCopy.platform.title }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("demo page stays truthful when booking is not configured", async ({
  page,
}) => {
  await page.goto("/demo");

  await expect(
    page.getByRole("heading", {
      name: "See operational excellence connected.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Live booking is not connected" }),
  ).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByText(/does not show sample times/i)).toBeVisible();
  await expect(page.getByText("09:00")).toHaveCount(0);
  await expect(page.getByText("10:30")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Explore the platform" }),
  ).toHaveAttribute("href", "/#platform");
});
