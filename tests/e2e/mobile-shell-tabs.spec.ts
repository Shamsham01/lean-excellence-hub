import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const mobileViewports = [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x640", width: 360, height: 640 },
] as const;

const representativeRoutes = [
  {
    path: "/platform",
    testId: "platform-home-page",
    label: "Home",
  },
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
  {
    path: "/platform/actions",
    testId: "actions-page",
    label: "Actions",
  },
  {
    path: "/platform/settings",
    testId: "settings-page",
    label: "Settings",
  },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function expectMobileChromeUsable(page: Page) {
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  await expect(menu).toBeVisible();
  await expect(menu).toBeInViewport();

  const orgName = page.getByTestId("platform-mobile-org-name");
  await expect(orgName).toBeVisible();
  await expect(orgName).toBeInViewport();
}

test.describe("MOBILE-001 shared shell and tabs", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  for (const viewport of mobileViewports) {
    test(`representative routes stay within viewport at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await signInAsDemoUser(page, "admin");

      for (const route of representativeRoutes) {
        await page.goto(route.path);
        await expect(page.getByTestId(route.testId)).toBeVisible();
        await expectMobileChromeUsable(page);
        await expectNoHorizontalOverflow(page);
      }
    });
  }

  test("shared workspace tabs remain contained and scrollable on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/benefits");
    await expect(page.getByTestId("benefits-portfolio-page")).toBeVisible();
    await expect(page.getByTestId("benefit-portfolio")).toBeVisible();

    const benefitLink = page
      .getByRole("link", { name: /Packaging Waste Reduction Savings/ })
      .first();
    await benefitLink.scrollIntoViewIfNeeded();
    await benefitLink.click();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();

    const tabsList = page.locator('[role="tablist"]').first();
    await expect(tabsList).toBeVisible();

    const tabMetrics = await tabsList.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowX: style.overflowX,
      };
    });

    expect(["auto", "scroll"]).toContain(tabMetrics.overflowX);
    expect(tabMetrics.width).toBeLessThanOrEqual(390);
    expect(tabMetrics.scrollWidth).toBeGreaterThanOrEqual(
      tabMetrics.clientWidth,
    );

    const discussionTab = page.getByRole("tab", { name: "Discussion" });
    await discussionTab.scrollIntoViewIfNeeded();
    await expect(discussionTab).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
