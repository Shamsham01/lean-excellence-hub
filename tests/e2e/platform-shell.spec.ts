import { expect, test, type Page } from "@playwright/test";

import { expectPlatformOrganisationName } from "./helpers/platform-home";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  ensurePlatformE2eUser,
  platformE2eCredentials,
} from "./helpers/platform-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const mobileViewports = [
  { name: "390x844", width: 390, height: 844 },
  { name: "375x667", width: 375, height: 667 },
  { name: "360x640", width: 360, height: 640 },
  { name: "844x390", width: 844, height: 390 },
  { name: "768x1024", width: 768, height: 1024 },
] as const;

async function loginPlatformE2e(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(platformE2eCredentials.email);
  await page.getByLabel("Password").fill(platformE2eCredentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
}

async function openMobileDrawer(page: Page) {
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const nav = page.getByRole("navigation", { name: "Platform" });
  await expect(nav).toBeVisible();
  return nav;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function expectFinalNavItemReachable(
  page: Page,
  nav: ReturnType<Page["getByRole"]>,
) {
  const links = nav.getByRole("link");
  const linkCount = await links.count();
  expect(linkCount).toBeGreaterThan(0);

  const lastLink = links.nth(linkCount - 1);
  const lastLabel = await lastLink.innerText();

  const scrollMetrics = await nav.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));

  expect(["auto", "scroll"]).toContain(scrollMetrics.overflowY);

  if (scrollMetrics.scrollHeight > scrollMetrics.clientHeight) {
    await lastLink.scrollIntoViewIfNeeded();
  }

  await expect(lastLink).toBeVisible();
  return { lastLink, lastLabel };
}

test.describe("authenticated platform shell", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test.beforeAll(async () => {
    await ensurePlatformE2eUser();
  });

  test("renders organisation context and permission-aware navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPlatformE2e(page);
    await expectPlatformOrganisationName(
      page,
      platformE2eCredentials.organisationName,
    );
    await expect(
      page.getByRole("link", { name: "Setup", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Actions" })).toBeVisible();
  });

  test("actions page is reachable from the shell", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginPlatformE2e(page);

    await page.getByRole("link", { name: "Actions" }).click();
    await expect(page).toHaveURL(/\/platform\/actions/);
    await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
  });

  test("desktop shell keeps sidebar navigation usable at 1440x900", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsDemoUser(page, "admin");

    const nav = page.getByRole("navigation", { name: "Platform" });
    await expect(nav).toBeVisible();
    await expect(page.getByText("Lean Excellence Hub")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();

    await expectFinalNavItemReachable(page, nav);
    await expectNoHorizontalOverflow(page);
  });

  for (const viewport of mobileViewports) {
    test(`mobile drawer scrolls to final navigation item at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await signInAsDemoUser(page, "admin");

      const nav = await openMobileDrawer(page);
      const drawer = page.getByRole("dialog");
      await expect(drawer.getByText("Lean Excellence Hub")).toBeVisible();
      await expect(
        drawer.getByRole("button", { name: "Sign out", exact: true }),
      ).toBeVisible();

      const { lastLink } = await expectFinalNavItemReachable(page, nav);
      await expect(lastLink).toBeInViewport();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("mobile drawer navigates to a lower item and closes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await signInAsDemoUser(page, "admin");

    const nav = await openMobileDrawer(page);
    const recognitionLink = nav.getByRole("link", {
      name: "Recognition",
      exact: true,
    });
    await expect(recognitionLink).toHaveCount(1);
    await recognitionLink.scrollIntoViewIfNeeded();
    await expect(recognitionLink).toBeVisible();
    await recognitionLink.click();

    await expect(page).toHaveURL(/\/platform\/recognition/);
    await expect(nav).not.toBeVisible();
  });

  test("mobile drawer closes with Escape and can be reopened", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "admin");

    const nav = await openMobileDrawer(page);
    await page.keyboard.press("Escape");
    await expect(nav).not.toBeVisible();

    await openMobileDrawer(page);
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
