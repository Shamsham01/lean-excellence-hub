import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { DEMO_SUGGESTION_PORTFOLIO_MIN_COUNT } from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function applyPortfolioFilters(page: Page) {
  await page.getByTestId("suggestion-portfolio-apply").click();
}

async function getPortfolioTotalCount(page: Page): Promise<number> {
  const pagination = page.getByTestId("suggestion-portfolio-pagination");
  await expect(pagination).toBeVisible();
  const text = await pagination.textContent();
  const match = text?.match(/of\s+(\d+)/i);
  if (!match?.[1]) {
    throw new Error(`Expected pagination total in "${text ?? ""}"`);
  }
  return Number.parseInt(match[1], 10);
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
    await signInAsDemoUser(page, "manager");
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
    await signInAsDemoUser(page, "manager");
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
    await signInAsDemoUser(page, "manager");
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
    await signInAsDemoUser(page, "manager");
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
    await signInAsDemoUser(page, "manager");
    await page.goto(
      "/platform/suggestions?status=implemented&q=changeover&page=1",
    );
    await page.getByTestId("suggestion-portfolio-clear-filters").click();
    await expect(page).toHaveURL("/platform/suggestions");
    const totalCount = await getPortfolioTotalCount(page);
    expect(totalCount).toBeGreaterThanOrEqual(
      DEMO_SUGGESTION_PORTFOLIO_MIN_COUNT,
    );
  });

  test("pagination preserves filters and supports next page", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
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
    await signInAsDemoUser(page, "manager");
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
    await signInAsDemoUser(page, "manager");
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
    await signInAsDemoUser(page, "manager");
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

  test("reserved-character search survives real PostgREST filtering", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/suggestions");
    const fullPortfolioCount = await getPortfolioTotalCount(page);

    await page
      .getByTestId("suggestion-portfolio-search")
      .fill('S3a search probe "quote"');
    await applyPortfolioFilters(page);
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
    await expect(
      page.getByRole("link", { name: 'S3a search probe "quote"' }).first(),
    ).toBeVisible();

    await page.getByTestId("suggestion-portfolio-search").fill('"');
    await applyPortfolioFilters(page);
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
    await expect(
      page.getByRole("link", { name: 'S3a search probe "quote"' }).first(),
    ).toBeVisible();

    await page
      .getByTestId("suggestion-portfolio-search")
      .fill("S3a search probe 100%done");
    await applyPortfolioFilters(page);
    await expect(
      page.getByRole("link", { name: "S3a search probe 100%done" }).first(),
    ).toBeVisible();

    await page.goto("/platform/suggestions?q=%25");
    await expect(page).toHaveURL(/q=%25/);
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
    const percentMatchCount = await getPortfolioTotalCount(page);
    expect(percentMatchCount).toBeLessThan(fullPortfolioCount);
    expect(percentMatchCount).toBeLessThanOrEqual(2);
    await expect(
      page.getByRole("link", { name: "S3a search probe 100%done" }).first(),
    ).toBeVisible();

    await page
      .getByTestId("suggestion-portfolio-search")
      .fill("S3a search probe under_score");
    await applyPortfolioFilters(page);
    await expect(
      page.getByRole("link", { name: "S3a search probe under_score" }).first(),
    ).toBeVisible();

    await page.goto("/platform/suggestions?q=_");
    await expect(page).toHaveURL(/q=_/);
    const underscoreMatchCount = await getPortfolioTotalCount(page);
    expect(underscoreMatchCount).toBeLessThan(fullPortfolioCount);
    expect(underscoreMatchCount).toBeLessThanOrEqual(2);

    await page
      .getByTestId("suggestion-portfolio-search")
      .fill(String.raw`S3a search probe back\slash`);
    await applyPortfolioFilters(page);
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: String.raw`S3a search probe back\slash` })
        .first(),
    ).toBeVisible();
  });
});
