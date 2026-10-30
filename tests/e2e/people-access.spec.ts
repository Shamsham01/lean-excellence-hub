import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const viewports = [
  { width: 320, height: 700 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

const longName =
  "Continuous Improvement Coordinator With A Very Long Organisation Name";

async function fitsViewport(page: Page, testId: string, width: number) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.width).toBeLessThanOrEqual(width);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
}

async function controlFits(page: Page, selector: string, width: number) {
  const box = await page.locator(selector).boundingBox();
  expect(box, selector).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
}

async function pageDoesNotScrollHorizontally(page: Page) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

test.describe("PEOPLE-ACCESS employee profile and invitations", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("operator profile and home show personal access", async ({ page }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/settings/profile");
    await expect(page.getByTestId("your-access-summary")).toBeVisible();
    await expect(page.getByTestId("profile-application-role")).toBeVisible();
    await expect(page.getByTestId("profile-membership-load-error")).toHaveCount(
      0,
    );

    await page.goto("/platform");
    await expect(page.getByTestId("home-your-profile")).toBeVisible();
    await expect(page.getByText("Start Lean maturity")).toHaveCount(0);
  });

  test("invitation and profile layouts fit the supported widths", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/settings/people");
    const form = page.getByTestId("invite-colleague-form");
    await expect(form).toBeVisible();
    await page.getByLabel("Name").fill(longName);
    await page.getByTestId("add-invitation-grant").click();
    await expect(page.locator("#invite-role-1")).toBeVisible();

    await page.locator("#invite-primary-unit").evaluate((select) => {
      const option = document.createElement("option");
      option.value = "long-hierarchy-path";
      option.textContent =
        "North Region / Manufacturing Campus / Final Assembly Site / Body Shop / Line 4 / Station With An Extremely Long Hierarchy Path";
      select.append(option);
      (select as HTMLSelectElement).value = option.value;
    });

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(form).toBeVisible();
      await fitsViewport(page, "invite-colleague-form", viewport.width);
      await controlFits(page, "#invite-job-function", viewport.width);
      await controlFits(page, "#invite-primary-unit", viewport.width);
      await controlFits(page, "#invite-role", viewport.width);
      await controlFits(page, "#invite-scope", viewport.width);
      await controlFits(
        page,
        "[data-testid='invitation-access-preview']",
        viewport.width,
      );
      await pageDoesNotScrollHorizontally(page);
    }

    const operatorPreset = page.getByTestId("operator-access-preset");
    if (await operatorPreset.isVisible()) {
      await page.setViewportSize({ width: 390, height: 844 });
      const site = page.getByLabel("Operator site");
      const siteValue = await site
        .locator("option")
        .nth(1)
        .getAttribute("value");
      expect(siteValue).toBeTruthy();
      await site.selectOption(siteValue ?? "");
      await page.getByTestId("apply-operator-access").click();
      await expect(page.locator("#invite-role")).not.toHaveValue("");
      await expect(page.locator("#invite-role-1")).not.toHaveValue("");
      await expect(
        page.getByText("Viewing: Published and shared workplace records"),
      ).toBeVisible();
      await expect(
        page.getByText("Viewing: Their own suggestions"),
      ).toBeVisible();
      await fitsViewport(page, "invite-colleague-form", 390);
      await controlFits(page, "#operator-access-site", 390);
      await controlFits(page, "#invite-role-1", 390);
      await pageDoesNotScrollHorizontally(page);
    }

    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/settings/profile");
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("your-access-summary")).toBeVisible();
      await fitsViewport(page, "profile-settings-page", viewport.width);
      await controlFits(
        page,
        "[data-testid='your-access-summary']",
        viewport.width,
      );
      await pageDoesNotScrollHorizontally(page);
    }
  });
});
