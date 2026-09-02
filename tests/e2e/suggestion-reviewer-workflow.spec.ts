import { expectPlatformOrganisationName } from "./helpers/platform-home";
import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_USERS,
  S2B2_WORKFLOW_FIXTURE_TITLES,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

function reviewWorkspace(page: Page) {
  return page.getByTestId("suggestion-review-workspace");
}

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

async function openReviewQueueForTitle(
  page: Page,
  title: string,
  queue: "mine" | "unassigned" = "unassigned",
) {
  await page.goto(`/platform/suggestions/review?queue=${queue}`);
  await expect(page.getByTestId("suggestion-review-queue")).toBeVisible();
  await page
    .locator('[data-testid^="review-queue-item-"]', { hasText: title })
    .first()
    .click();
  await expect(reviewWorkspace(page)).toBeVisible();
  await expect(page).toHaveURL(/suggestionId=/);
}

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
    await loginAs(page, "manager");
    await openReviewQueueForTitle(page, S2B2_WORKFLOW_FIXTURE_TITLES.claim);
    await page.getByTestId("review-claim-button").click();
    await expect(page.getByTestId("review-workspace-error")).toHaveCount(0);
    await expect(
      page.getByTestId("review-workspace-reviewer-label"),
    ).toContainText(/Claimed by you/i, { timeout: 15000 });
    await expect(
      reviewWorkspace(page).getByText("Submitted", { exact: true }),
    ).toBeVisible();
  });

  test("reviewer begins review explicitly", async ({ page }) => {
    await loginAs(page, "manager");
    await openReviewQueueForTitle(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      "mine",
    );
    await page.getByTestId("review-begin-button").click();
    await expect(
      reviewWorkspace(page).getByText("Under Review", { exact: true }),
    ).toBeVisible();
  });

  test("reviewer parks with rationale and keeps assignment", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await openReviewQueueForTitle(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      "mine",
    );
    await page
      .getByTestId("review-rationale")
      .fill("Waiting for supplier quote.");
    await page.getByTestId("review-park-button").click();
    await expect(
      page.getByTestId("review-workspace-parked-current"),
    ).toBeVisible();
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
    await loginAs(page, "manager");
    await openReviewQueueForTitle(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      "mine",
    );
    await page.getByTestId("review-begin-button").click();
    await expect(
      reviewWorkspace(page).getByText("Under Review", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("review-workspace-parked-history"),
    ).toBeVisible();
    await expect(page.getByText("Previously parked")).toBeVisible();
  });

  test("reviewer approves and leaves my reviews queue", async ({ page }) => {
    await loginAs(page, "manager");
    await openReviewQueueForTitle(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      "mine",
    );
    await page
      .getByTestId("review-rationale")
      .fill("Clear operational benefit.");
    await page.getByTestId("review-approve-button").click();
    await expect(
      reviewWorkspace(page).getByText("Accepted", { exact: true }),
    ).toBeVisible();
    await page.goto("/platform/suggestions/review?queue=mine");
    await expect(
      page.locator('[data-testid^="review-queue-item-"]', {
        hasText: S2B2_WORKFLOW_FIXTURE_TITLES.claim,
      }),
    ).toHaveCount(0);
  });

  test("reviewer declines a separate fixture", async ({ page }) => {
    await loginAs(page, "manager");
    await openReviewQueueForTitle(page, S2B2_WORKFLOW_FIXTURE_TITLES.decline);
    await page.getByTestId("review-claim-button").click();
    await page.getByTestId("review-begin-button").click();
    await page.getByTestId("review-rationale").fill("Not viable at this time.");
    await page.getByTestId("review-decline-button").click();
    await expect(
      reviewWorkspace(page).getByText("Rejected", { exact: true }),
    ).toBeVisible();
  });

  test("stale claim surfaces safe conflict messaging", async ({ browser }) => {
    const managerA = await browser.newPage();
    const managerB = await browser.newPage();

    await loginAs(managerA, "manager");
    await loginAs(managerB, "manager");

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
    await expect(
      managerB.getByTestId("review-workspace-reviewer-label"),
    ).toContainText(/Claimed by you/i, { timeout: 15000 });

    await managerA.getByTestId("review-claim-button").click();
    await expect(managerA.getByTestId("review-workspace-error")).toContainText(
      /changed since you opened it|no longer have permission|no longer available/i,
    );

    await managerA.close();
    await managerB.close();
  });

  test("manager assigns an unassigned suggestion", async ({ page }) => {
    await loginAs(page, "manager");
    await openReviewQueueForTitle(page, S2B2_WORKFLOW_FIXTURE_TITLES.assign);
    await page.getByTestId("review-assign-select").selectOption({
      label: "Apex Finance",
    });
    await page.getByTestId("review-assign-button").click();
    await expect(
      page.getByTestId("review-workspace-reviewer-label"),
    ).toContainText(/Assigned to Apex Finance/i);
    await expect(
      reviewWorkspace(page).getByText("Submitted", { exact: true }),
    ).toBeVisible();
  });

  test("manager reassigns an assigned suggestion", async ({ page }) => {
    await loginAs(page, "manager");
    await openReviewWorkspaceFromPortfolio(
      page,
      S2B2_WORKFLOW_FIXTURE_TITLES.reassign,
    );
    await page.getByTestId("review-assign-select").selectOption({
      label: "Apex Finance",
    });
    await page.getByTestId("review-assign-button").click();
    await expect(
      page.getByTestId("review-workspace-reviewer-label"),
    ).toContainText(/Assigned to Apex Finance/i);
    await page.getByTestId("review-assign-select").selectOption({
      label: "Apex Manager",
    });
    await page.getByRole("button", { name: "Reassign reviewer" }).click();
    await expect(
      page.getByTestId("review-workspace-reviewer-label"),
    ).toContainText(/Assigned to Apex Manager|Claimed by you|Reassigned to/i);
  });

  test("read-only user does not see reviewer workflow leakage", async ({
    page,
  }) => {
    await loginAs(page, "operator");
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
    await loginAs(page, "manager");
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
    await loginAs(page, "manager");
    await openReviewQueueForTitle(page, S2B2_WORKFLOW_FIXTURE_TITLES.parked);
    await page.getByTestId("review-claim-button").click();
    await page.getByTestId("review-begin-button").click();
    await page
      .getByTestId("review-rationale")
      .fill("Need additional evidence.");
    await page.getByTestId("review-park-button").click();
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
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions/review?queue=unassigned");
    await expect(page.getByTestId("review-queue-tabs")).toBeVisible();
    await expect(page.getByTestId("review-queue-list")).toBeVisible();
    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 8,
    );
    expect(horizontalScroll).toBe(false);
  });
});
