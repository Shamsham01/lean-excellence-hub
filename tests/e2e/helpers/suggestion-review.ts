import { expect, type Page } from "@playwright/test";

const REVIEW_TIMEOUT_MS = 15_000;

export function reviewWorkspace(page: Page) {
  return page.getByTestId("suggestion-review-workspace");
}

function queueItemForTitle(page: Page, title: string) {
  return page
    .locator('[data-testid^="review-queue-item-"]', { hasText: title })
    .first();
}

export async function expectReviewStatus(page: Page, label: string) {
  const status = page.getByTestId("review-workspace-status");

  try {
    await expect(status).toHaveText(label, { timeout: REVIEW_TIMEOUT_MS });
    return;
  } catch {
    // Production RSC refresh after a review mutation can abort
    // ("destination stream closed early"); a full reload reads the
    // persisted status instead of waiting on router.refresh().
  }

  await page.reload();
  await expect(reviewWorkspace(page)).toBeVisible({
    timeout: REVIEW_TIMEOUT_MS,
  });
  await expect(status).toHaveText(label, { timeout: REVIEW_TIMEOUT_MS });
}

export async function openReviewQueueForTitle(
  page: Page,
  title: string,
  queue: "mine" | "unassigned" = "unassigned",
) {
  await page.goto(`/platform/suggestions/review?queue=${queue}`);
  await expect(page.getByTestId("suggestion-review-queue")).toBeVisible();

  const item = queueItemForTitle(page, title);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if ((await item.count()) > 0) {
      break;
    }

    const next = page.getByTestId("review-queue-next");
    if ((await next.getAttribute("disabled")) !== null) {
      break;
    }

    await next.click();
    await expect(page.getByTestId("suggestion-review-queue")).toBeVisible();
  }

  await expect(item).toBeVisible({ timeout: REVIEW_TIMEOUT_MS });
  const testId = await item.getAttribute("data-testid");
  const suggestionId = testId?.replace("review-queue-item-", "") ?? "";
  expect(suggestionId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

  const href = await item.getAttribute("href");
  expect(href).toContain(`suggestionId=${suggestionId}`);

  // Full document navigation — the review page auto-selects items[0]
  // without putting suggestionId in the URL, so a client Link click can
  // leave the workspace visible on the wrong suggestion.
  await page.goto(href!);
  await expect(page).toHaveURL(new RegExp(`suggestionId=${suggestionId}`), {
    timeout: REVIEW_TIMEOUT_MS,
  });
  await expect(reviewWorkspace(page)).toBeVisible();
  await expect(reviewWorkspace(page)).toContainText(title);
}

export async function claimCurrentReview(page: Page) {
  await page.getByTestId("review-claim-button").click();
  await expect(page.getByTestId("review-workspace-error")).toHaveCount(0);

  try {
    await expect(
      page.getByTestId("review-workspace-reviewer-label"),
    ).toContainText(/Claimed by you/i, { timeout: REVIEW_TIMEOUT_MS });
    return;
  } catch {
    await page.reload();
  }

  await expect(page.getByTestId("review-workspace-error")).toHaveCount(0);
  await expect(
    page.getByTestId("review-workspace-reviewer-label"),
  ).toContainText(/Claimed by you/i, { timeout: REVIEW_TIMEOUT_MS });
}

export async function beginCurrentReview(page: Page) {
  await page.getByTestId("review-begin-button").click();

  try {
    await expect(page.getByTestId("review-approve-button")).toBeVisible({
      timeout: REVIEW_TIMEOUT_MS,
    });
    return;
  } catch {
    await page.reload();
  }

  await expect(page.getByTestId("review-approve-button")).toBeVisible({
    timeout: REVIEW_TIMEOUT_MS,
  });
}

export async function approveCurrentReview(
  page: Page,
  rationale: string,
  employeeFeedback: string,
) {
  await page.getByTestId("review-rationale").fill(rationale);
  await page.getByTestId("review-employee-feedback").fill(employeeFeedback);
  await page.getByTestId("review-approve-button").click();
  await expect(page.getByTestId("review-workspace-error")).toHaveCount(0);
  await expectReviewStatus(page, "Accepted");
}
