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
  { name: "320x700", width: 320, height: 700 },
  { name: "844x390", width: 844, height: 390 },
  { name: "768x1024", width: 768, height: 1024 },
] as const;

const representativeRoutes = [
  { path: "/platform", testId: "platform-home-page", label: "Home" },
  {
    path: "/platform/people",
    testId: "people-directory-page",
    label: "People",
  },
  {
    path: "/platform/suggestions",
    testId: "suggestions-overview",
    label: "Suggestions",
  },
  { path: "/platform/actions", testId: "actions-page", label: "Actions" },
  { path: "/platform/settings", testId: "settings-page", label: "Settings" },
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

async function scrollWorkspace(page: Page) {
  await page.evaluate(() => {
    const main = document.querySelector("main");
    const inner = main?.firstElementChild as HTMLElement | null;
    if (inner) {
      inner.style.minHeight = "300vh";
    }
    if (main) {
      main.scrollTop = main.scrollHeight;
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
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

  test("desktop sidebar remains visible after scrolling long main content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsDemoUser(page, "admin");

    const sidebar = page.locator("aside").first();
    const nav = sidebar.getByRole("navigation", { name: "Platform" });
    await expect(nav).toBeVisible();

    await scrollWorkspace(page);

    await expect(nav).toBeInViewport();
    await expect(
      sidebar.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeInViewport();
    await expect(
      sidebar.getByRole("link", { name: "Settings", exact: true }),
    ).toBeInViewport();
    await expectNoHorizontalOverflow(page);
  });

  test("desktop sidebar independently reaches lower navigation items", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsDemoUser(page, "admin");

    const nav = page.getByRole("navigation", { name: "Platform" });
    for (const label of ["Skills", "Recognition"] as const) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
    }
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

  test("mobile chrome stays reachable after scrolling a long page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/people");
    await expect(page.getByTestId("people-directory-page")).toBeVisible();

    await scrollWorkspace(page);

    const chrome = page.getByTestId("platform-mobile-chrome");
    await expect(chrome).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Open navigation menu" }),
    ).toBeInViewport();
    await expectNoHorizontalOverflow(page);
  });

  for (const route of representativeRoutes) {
    test(`mobile chrome stays usable on ${route.label} at 390x844`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await signInAsDemoUser(page, "admin");
      await page.goto(route.path);
      await expect(page.getByTestId(route.testId)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Open navigation menu" }),
      ).toBeInViewport();
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

  test("restricted operator does not see privileged setup navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsDemoUser(page, "operator");

    await expect(
      page.getByRole("link", { name: "Setup", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
  });

  test("restricted finance user keeps authorised entries only", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsDemoUser(page, "finance");

    await expect(
      page.getByRole("link", { name: "Benefits", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Setup", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Lean AI", exact: true }),
    ).not.toBeVisible();
  });
});
