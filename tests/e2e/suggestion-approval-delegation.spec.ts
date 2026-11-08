import { expect, test } from "@playwright/test";

import { DEMO_USERS } from "../../scripts/demo-seed/constants";
import {
  approveCurrentReview,
  beginCurrentReview,
  reviewWorkspace,
} from "./helpers/suggestion-review";
import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

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
  return page
    .getByTestId("platform-desktop-sidebar")
    .getByTestId("platform-notification-bell");
}

async function openUnreadNotificationReview(
  page: import("@playwright/test").Page,
  pattern: RegExp,
) {
  await expect(notificationBell(page)).toBeVisible();
  await notificationBell(page).click();
  await expect(page.getByTestId("platform-notification-list")).toBeVisible();
  const item = page
    .locator('[data-notification-unread="true"]')
    .filter({ hasText: pattern })
    .first();
  await expect(item).toBeVisible({ timeout: 30_000 });
  await item.click();
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
  });

  test("site manager sees pending approval and delegates to finance", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await openUnreadNotificationReview(page, /Idea submitted for review/i);
    delegatedSuggestionId = new URL(page.url()).searchParams.get(
      "suggestionId",
    );
    expect(delegatedSuggestionId).toMatch(/^[0-9a-f-]{36}$/i);
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
    await openUnreadNotificationReview(page, /delegated to you/i);
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
    await expect(page.getByTestId("platform-notification-list")).toBeVisible();
    const staleForSuggestion = page.locator(
      `[data-notification-unread="true"][data-notification-href*="suggestionId=${delegatedSuggestionId}"]`,
    );
    await expect(staleForSuggestion).toHaveCount(0);
  });
});
