import { expectPlatformOrganisationName } from "./helpers/platform-home";
import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function loginAs(page: Page, user: keyof typeof DEMO_USERS) {
  const credentials = DEMO_USERS[user];
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
  await expectPlatformOrganisationName(page, DEMO_ORGANISATION.name);
}

async function applyPortfolioFilters(page: Page) {
  await page.getByTestId("suggestion-portfolio-apply").click();
}

test.describe("S3a suggestions portfolio", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("manager loads portfolio with reference, title, and status", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions");
    await expect(page.getByTestId("suggestions-overview")).toBeVisible();
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
    await expect(
      page.getByTestId(/suggestion-portfolio-item-/).first(),
    ).toBeVisible();

    await page
      .getByTestId("suggestion-portfolio-search")
      .fill("Pre-stage changeover tooling");
    await applyPortfolioFilters(page);
    await expect(
      page.getByRole("link", { name: "Pre-stage changeover tooling" }).first(),
    ).toBeVisible();

    await page.getByTestId("suggestion-portfolio-search").fill("");
    await page
      .getByTestId("suggestion-portfolio-search")
      .fill("Visual defect sample board");
    await applyPortfolioFilters(page);
    await expect(
      page.getByRole("link", { name: "Visual defect sample board" }).first(),
    ).toBeVisible();
  });

  test("status filter updates results and URL", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions");
    await page
      .getByTestId("suggestion-portfolio-status")
      .selectOption("implemented");
    await applyPortfolioFilters(page);
    await expect(page).toHaveURL(/status=implemented/);
    await expect(
      page.getByRole("link", { name: "Pre-stage changeover tooling" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Visual defect sample board" }),
    ).toHaveCount(0);
  });

  test("category filter narrows portfolio results", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions");
    await page
      .getByTestId("suggestion-portfolio-category")
      .selectOption({ label: "Delivery" });
    await applyPortfolioFilters(page);
    await expect(page).toHaveURL(/category=/);
    await expect(
      page.getByRole("link", { name: "Pre-stage changeover tooling" }).first(),
    ).toBeVisible();
  });

  test("search finds a known suggestion", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions");
    await page
      .getByTestId("suggestion-portfolio-search")
      .fill("S3a portfolio seed 01");
    await applyPortfolioFilters(page);
    await expect(page).toHaveURL(/q=S3a/);
    await expect(
      page.getByRole("link", { name: "S3a portfolio seed 01" }).first(),
    ).toBeVisible();
  });

  test("clear filters restores the full portfolio", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto(
      "/platform/suggestions?status=implemented&q=changeover&page=1",
    );
    await page.getByTestId("suggestion-portfolio-clear-filters").click();
    await expect(page).toHaveURL("/platform/suggestions");
    await expect(
      page.getByTestId("suggestion-portfolio-pagination"),
    ).toContainText(/of 3\d/);
  });

  test("pagination preserves filters and supports next page", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions?pageSize=25");
    await expect(
      page.getByTestId("suggestion-portfolio-pagination"),
    ).toBeVisible();
    await expect(page.getByText(/Page 1 of/)).toBeVisible();
    await page.getByTestId("suggestion-portfolio-next").click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 of/)).toBeVisible();
    await expect(
      page.getByTestId(/suggestion-portfolio-item-/).first(),
    ).toBeVisible();
  });

  test("detail navigation returns to filtered portfolio state", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions?status=implemented");
    await page
      .getByRole("link", { name: /Pre-stage changeover tooling/i })
      .first()
      .click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/status=implemented/);
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
  });

  test("filtered empty state is distinct from the portfolio", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions");
    await page
      .getByTestId("suggestion-portfolio-search")
      .fill("no-such-suggestion-xyz");
    await applyPortfolioFilters(page);
    await expect(
      page.getByTestId("suggestion-portfolio-empty-state"),
    ).toContainText("No suggestions match these filters.");
  });

  test("mobile viewport keeps filters and portfolio usable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions");
    await expect(page.getByTestId("suggestion-portfolio-search")).toBeVisible();
    await expect(page.getByTestId("suggestion-portfolio-status")).toBeVisible();
    await expect(
      page.getByTestId(/suggestion-portfolio-mobile-item-/).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId("suggestion-portfolio-pagination"),
    ).toBeVisible();
  });
});
