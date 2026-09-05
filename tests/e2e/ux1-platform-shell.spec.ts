import { expect, test, type Page } from "@playwright/test";

import { expectPlatformOrganisationName } from "./helpers/platform-home";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  ensurePlatformE2eUser,
  platformE2eCredentials,
} from "./helpers/platform-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function loginPlatformE2e(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(platformE2eCredentials.email);
  await page.getByLabel("Password").fill(platformE2eCredentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
}

test.describe("UX1 platform shell", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test.beforeAll(async () => {
    await ensurePlatformE2eUser();
  });

  test("desktop shell shows identity, grouped navigation, and utilities", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginPlatformE2e(page);

    await expectPlatformOrganisationName(
      page,
      platformE2eCredentials.organisationName,
    );
    await expect(page.getByText("Lean Excellence Hub")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Platform" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Actions", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Toggle theme" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
  });

  test("desktop navigation highlights active nested routes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginPlatformE2e(page);

    await page.getByRole("link", { name: "Maturity", exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/maturity/);

    const maturityLink = page.getByRole("link", {
      name: "Maturity",
      exact: true,
    });
    await expect(maturityLink).toHaveAttribute("aria-current", "page");

    await page.goto("/platform/maturity/models");
    await expect(maturityLink).toHaveAttribute("aria-current", "page");
  });

  test("desktop sidebar keeps header and footer visible while navigation scrolls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await signInAsDemoUser(page, "admin");

    const nav = page.getByRole("navigation", { name: "Platform" });
    await expect(nav).toBeVisible();
    await expect(page.getByText("Lean Excellence Hub")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();

    const scrollMetrics = await nav.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));

    expect(["auto", "scroll"]).toContain(scrollMetrics.overflowY);
    if (scrollMetrics.scrollHeight > scrollMetrics.clientHeight) {
      await nav.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(page.getByText("Lean Excellence Hub")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sign out", exact: true }),
      ).toBeVisible();
    }
  });

  test("mobile drawer opens, navigates, and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginPlatformE2e(page);

    await expect(
      page.getByRole("navigation", { name: "Platform" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open navigation menu" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const nav = page.getByRole("navigation", { name: "Platform" });
    await expect(nav).toBeVisible();

    await page.getByRole("link", { name: "Actions", exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/actions/);
    await expect(nav).not.toBeVisible();
  });

  test("team member does not see privileged setup navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAsDemoUser(page, "operator");

    await expect(
      page.getByRole("link", { name: "Setup", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
  });

  test("finance validator sees benefits and settings without people administration", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAsDemoUser(page, "finance");

    await expect(
      page.getByRole("link", { name: "Benefits", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "People", exact: true }),
    ).not.toBeVisible();
  });
});
