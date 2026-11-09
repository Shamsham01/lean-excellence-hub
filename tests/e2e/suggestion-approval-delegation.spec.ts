import { expect, test } from "@playwright/test";

import { DEMO_USERS } from "../../scripts/demo-seed/constants";
import {
  approveCurrentReview,
  beginCurrentReview,
  reviewWorkspace,
} from "./helpers/suggestion-review";
import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

let submittedSuggestionId: string | null = null;
let delegatedSuggestionId: string | null = null;

async function fillAndSubmitSuggestion(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page.goto("/platform/suggestions/new");
  await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
  await page.getByLabel("What have you noticed?").fill(title);
  await page
    .getByLabel("What would you change?")
    .fill("Approval delegation end-to-end acceptance");
  await page.getByTestId("suggestion-submit-button").click();
  await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
}

async function openReviewForTitle(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page.goto("/platform/suggestions");
  await page.getByTestId("suggestion-portfolio-search").fill(title);
  await page.getByTestId("suggestion-portfolio-apply").click();
  const row = page
    .locator('[data-testid^="suggestion-portfolio-item-"]', { hasText: title })
    .first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByTestId(/suggestion-portfolio-review-link-/).click();
  await expect(reviewWorkspace(page)).toBeVisible();
  await expect(page).toHaveURL(/suggestionId=/);
  await expect(reviewWorkspace(page)).toContainText(title);
}

function notificationBell(page: import("@playwright/test").Page) {
  return page.locator('[data-testid="platform-notification-bell"]:visible');
}

async function openUnreadNotificationReview(
  page: import("@playwright/test").Page,
  pattern: RegExp,
  suggestionId?: string,
) {
  await page.goto("/platform");
  await expect(notificationBell(page)).toBeVisible();
  await notificationBell(page).click();
  await expect(page.getByTestId("platform-notification-list")).toBeVisible({
    timeout: 30_000,
  });
  let item = page.locator('[data-notification-unread="true"]');
  if (suggestionId) {
    item = page
      .locator(
        `[data-notification-unread="true"][data-notification-href*="suggestionId=${suggestionId}"]`,
      )
      .filter({ hasText: pattern });
  } else {
    item = item.filter({ hasText: pattern });
  }
  const target = item.first();
  await expect(target).toBeVisible({ timeout: 30_000 });
  await target.click();
  await expect(reviewWorkspace(page)).toBeVisible({ timeout: 30_000 });
}

test.describe("Suggestion approval delegation (UI acceptance)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and npm run db:seed-demo",
  );

  const title = `E2E approval delegate ${Date.now()}`;

  test("operator submits idea", async ({ page }) => {
    await signInAsDemoUser(page, "operator");
    await fillAndSubmitSuggestion(page, title);
    const detailMatch = page
      .url()
      .match(/\/platform\/suggestions\/([0-9a-f-]{36})/i);
    submittedSuggestionId = detailMatch?.[1] ?? null;
    expect(submittedSuggestionId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("site manager sees pending approval and delegates to finance", async ({
    page,
  }) => {
    expect(submittedSuggestionId).toBeTruthy();
    await signInAsDemoUser(page, "manager");
    await openUnreadNotificationReview(
      page,
      /Idea submitted for review/i,
      submittedSuggestionId!,
    );
    delegatedSuggestionId = new URL(page.url()).searchParams.get(
      "suggestionId",
    );
    expect(delegatedSuggestionId).toBe(submittedSuggestionId);
    await expect(reviewWorkspace(page)).toContainText(title);
    await expect(page.getByTestId("review-delegate-controls")).toBeVisible();

    const delegateSelect = page.getByTestId("review-delegate-select");
    const financeOption = delegateSelect.locator(
      `option:has-text("${DEMO_USERS.finance.displayName}")`,
    );
    await expect(financeOption).toHaveCount(1);
    await delegateSelect.selectOption({
      label: DEMO_USERS.finance.displayName,
    });
    await page
      .getByTestId("review-delegate-reason")
      .fill("Manager on walkabout");
    await page.getByTestId("review-delegate-button").click();
    await expect(page.getByTestId("review-workspace-error")).toHaveCount(0);
  });

  test("delegated finance reviewer sees unread pending and approves", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "finance");
    expect(submittedSuggestionId).toBeTruthy();
    await openUnreadNotificationReview(
      page,
      /delegated to you/i,
      submittedSuggestionId!,
    );
    await expect(
      page.getByTestId("review-workspace-delegation-notice"),
    ).toBeVisible();
    await expect(page.getByTestId("suggestion-delegation-reason")).toHaveText(
      /Manager on walkabout/i,
    );
    await beginCurrentReview(page);
    await approveCurrentReview(
      page,
      "Looks good from finance",
      "Thanks for the idea",
    );
  });

  test("original manager has no stale approval notification", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    expect(delegatedSuggestionId).toBeTruthy();
    await notificationBell(page).click();
    await expect(page.getByTestId("platform-notification-list")).toBeVisible({
      timeout: 30_000,
    });
    const staleForSuggestion = page.locator(
      `[data-notification-unread="true"][data-notification-href*="suggestionId=${delegatedSuggestionId}"]`,
    );
    await expect(staleForSuggestion).toHaveCount(0);
  });
});
