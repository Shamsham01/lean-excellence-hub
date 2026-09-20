import { expect, test, type Page } from "@playwright/test";

import { S2B2_WORKFLOW_FIXTURE_TITLES } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  beginCurrentReview,
  claimCurrentReview,
  expectReviewStatus,
  expectReviewTestId,
  expectReviewerLabel,
  openReviewQueueForTitle,
  parkCurrentReview,
  reviewWorkspace,
} from "./helpers/suggestion-review";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

function portfolioRowForTitle(page: Page, title: string) {
  return page
    .locator('[data-testid^="suggestion-portfolio-item-"]', { hasText: title })
    .first();
}

async function openReviewWorkspaceFromPortfolio(page: Page, title: string) {
  await page.goto("/platform/suggestions");
  await page.getByTestId("suggestion-portfolio-search").fill(title);
  await page.getByTestId("suggestion-portfolio-apply").click();
  const row = portfolioRowForTitle(page, title);
  await expect(row).toBeVisible();
  await row.getByTestId(/suggestion-portfolio-review-link-/).click();
  await expect(reviewWorkspace(page)).toBeVisible();
  await expect(page).toHaveURL(/suggestionId=/);
}

async function reviewUrlForPortfolioTitle(page: Page, title: string) {
  await page.goto("/platform/suggestions");
  await page.getByTestId("suggestion-portfolio-search").fill(title);
  await page.getByTestId("suggestion-portfolio-apply").click();
  const row = portfolioRowForTitle(page, title);
  await expect(row).toBeVisible();
  const reviewHref = await row
    .getByTestId(/suggestion-portfolio-review-link-/)
    .getAttribute("href");

  if (!reviewHref) {
    throw new Error(`Expected review link for fixture: ${title}`);
  }

  return reviewHref.startsWith("/")
    ? reviewHref
    : new URL(reviewHref).pathname + new URL(reviewHref).search;
}

test.describe("S2b2 suggestion reviewer workflow", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("reviewer claims an unassigned submitted suggestion", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(page, S2B2_WORKFLOW_FIXTURE_TITLES.claim);
    await page.getByTestId("review-claim-button").click();
    await expect(page.getByTestId("review-workspace-error")).toHaveCount(0);
    await expectReviewerLabel(page, /Claimed by you/i);
    await expectReviewStatus(page, "Submitted");
  });

  test("reviewer begins review explicitly", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      "mine",
    );
    await page.getByTestId("review-begin-button").click();
    await expectReviewStatus(page, "Under Review");
  });

  test("reviewer parks with rationale and keeps assignment", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      "mine",
    );
    await parkCurrentReview(
      page,
      "Internal: waiting for supplier quote.",
      "Waiting for supplier quote.",
    );
    await page.goto("/platform/suggestions/review?queue=mine");
    await expect(
      page
        .locator('[data-testid^="review-queue-item-"]', {
          hasText: S2B2_WORKFLOW_FIXTURE_TITLES.claim,
        })
        .first(),
    ).toBeVisible();
  });

  test("reviewer resumes parked review and keeps historical context", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      "mine",
    );
    await page.getByTestId("review-begin-button").click();
    await expectReviewStatus(page, "Under Review");
    await expectReviewTestId(page, "review-workspace-parked-history");
    await expect(page.getByText("Previously parked")).toBeVisible();
  });

  test("reviewer approves and leaves my reviews queue", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      "mine",
    );
    await page
      .getByTestId("review-rationale")
      .fill("Internal: clear operational benefit.");
    await page
      .getByTestId("review-employee-feedback")
      .fill("Clear operational benefit.");
    await page.getByTestId("review-approve-button").click();
    await expectReviewStatus(page, "Accepted");
    await page.goto("/platform/suggestions/review?queue=mine");
    await expect(
      page.locator('[data-testid^="review-queue-item-"]', {
        hasText: S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      }),
    ).toHaveCount(0);
  });

  test("reviewer declines a separate fixture", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(page, S2B2_WORKFLOW_FIXTURE_TITLES.decline);
    await claimCurrentReview(page);
    await beginCurrentReview(page);
    await page.getByTestId("review-rationale").fill("Internal: not viable.");
    await page
      .getByTestId("review-employee-feedback")
      .fill("Not viable at this time.");
    await page.getByTestId("review-decline-button").click();
    await expectReviewStatus(page, "Rejected");
  });

  test("stale claim surfaces safe conflict messaging", async ({ browser }) => {
    const managerA = await browser.newPage();
    const managerB = await browser.newPage();

    await signInAsDemoUser(managerA, "manager");
    await signInAsDemoUser(managerB, "manager");

    const reviewPath = await reviewUrlForPortfolioTitle(
      managerA,
      S2B2_WORKFLOW_FIXTURE_TITLES.staleClaim,
    );
    const reviewUrl = reviewPath.includes("queue=")
      ? reviewPath
      : `${reviewPath}${reviewPath.includes("?") ? "&" : "?"}queue=unassigned`;

    await managerA.goto(reviewUrl);
    await managerB.goto(reviewUrl);

    await expect(managerA.getByTestId("review-claim-button")).toBeVisible();
    await expect(managerB.getByTestId("review-claim-button")).toBeVisible();

    await managerB.getByTestId("review-claim-button").click();
    await expectReviewerLabel(managerB, /Claimed by you/i);

    await managerA.getByTestId("review-claim-button").click();
    await expect(managerA.getByTestId("review-workspace-error")).toContainText(
      /changed since you opened it|no longer have permission|no longer available/i,
    );

    await managerA.close();
    await managerB.close();
  });

  test("manager assigns an unassigned suggestion", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(page, S2B2_WORKFLOW_FIXTURE_TITLES.assign);
    await page.getByTestId("review-assign-select").selectOption({
      label: "Apex Finance",
    });
    await page.getByTestId("review-assign-button").click();
    await expectReviewerLabel(page, /Assigned to Apex Finance/i);
    await expectReviewStatus(page, "Submitted");
  });

  test("manager reassigns an assigned suggestion", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await openReviewWorkspaceFromPortfolio(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.reassign,
    );
    await page.getByTestId("review-assign-select").selectOption({
      label: "Apex Finance",
    });
    await page.getByTestId("review-assign-button").click();
    await expectReviewerLabel(page, /Assigned to Apex Finance/i);
    await page.getByTestId("review-assign-select").selectOption({
      label: "Apex Manager",
    });
    await page.getByRole("button", { name: "Reassign reviewer" }).click();
    await expectReviewerLabel(
      page,
      /Assigned to Apex Manager|Claimed by you|Reassigned to/i,
    );
  });

  test("read-only user does not see reviewer workflow leakage", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions");
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
    await expect(
      page.getByTestId("suggestion-portfolio-reviewer"),
    ).not.toBeVisible();
    await expect(
      page.getByTestId(/suggestion-portfolio-review-link-/),
    ).toHaveCount(0);
    await page.goto("/platform/suggestions/review");
    await expect(page.getByTestId("suggestion-review-queue")).not.toBeVisible();
  });

  test("portfolio reviewer filter persists in URL", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/suggestions");
    await page
      .getByTestId("suggestion-portfolio-reviewer")
      .selectOption("unassigned");
    await page.getByTestId("suggestion-portfolio-apply").click();
    await expect(page).toHaveURL(/reviewer=unassigned/);
    const next = page.getByTestId("suggestion-portfolio-next");
    if (await next.isEnabled()) {
      await next.click();
      await expect(page).toHaveURL(/reviewer=unassigned/);
    }
  });

  test("parked assignment appears in my reviews queue", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(page, S2B2_WORKFLOW_FIXTURE_TITLES.parked);
    await page.getByTestId("review-claim-button").click();
    await page.getByTestId("review-begin-button").click();
    await parkCurrentReview(
      page,
      "Internal: need additional evidence.",
      "Need additional evidence.",
    );
    await page.goto("/platform/suggestions/review?queue=mine");
    await expect(
      page
        .locator('[data-testid^="review-queue-item-"]', {
          hasText: S2B2_WORKFLOW_FIXTURE_TITLES.parked,
        })
        .first(),
    ).toBeVisible();
  });

  test("mobile review queue remains usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/suggestions/review?queue=unassigned");
    await expect(page.getByTestId("review-queue-tabs")).toBeVisible();
    await expect(page.getByTestId("review-queue-list")).toBeVisible();
    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 8,
    );
    expect(horizontalScroll).toBe(false);
  });
});
