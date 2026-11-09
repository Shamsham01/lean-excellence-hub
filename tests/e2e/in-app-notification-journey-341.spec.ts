import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  approveCurrentReview,
  beginCurrentReview,
  reviewWorkspace,
} from "./helpers/suggestion-review";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

function notificationBell(page: import("@playwright/test").Page) {
  return page.getByTestId("platform-notification-bell");
}

async function expectSingleNotificationBell(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("platform-notification-bell")).toHaveCount(1);
}

test.describe("In-app notification journey (#341)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and npm run db:seed-demo",
  );

  const title = `E2E notification journey ${Date.now()}`;
  let suggestionId: string | null = null;

  test("operator submits idea", async ({ page }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await page.getByLabel("What have you noticed?").fill(title);
    await page
      .getByLabel("What would you change?")
      .fill("Notification bell journey for issue 341");
    await page.getByTestId("suggestion-submit-button").click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    const detailMatch = page
      .url()
      .match(/\/platform\/suggestions\/([0-9a-f-]{36})/i);
    suggestionId = detailMatch?.[1] ?? null;
    expect(suggestionId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("manager opens approval from notification bell and approves", async ({
    page,
  }) => {
    expect(suggestionId).toBeTruthy();
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform");
    await expectSingleNotificationBell(page);
    await expect(notificationBell(page)).toBeVisible();
    await notificationBell(page).click();
    const item = page
      .locator(
        `[data-notification-unread="true"][data-notification-href*="suggestionId=${suggestionId}"]`,
      )
      .filter({ hasText: /Idea submitted for review/i })
      .first();
    await expect(item).toBeVisible({ timeout: 30_000 });
    await item.click();
    await expect(reviewWorkspace(page)).toBeVisible({ timeout: 30_000 });
    await beginCurrentReview(page);
    await approveCurrentReview(
      page,
      "Approved via notification centre",
      "Thanks for raising this",
    );
  });

  test("mobile chrome exposes a single notification bell", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/platform");
    await expectSingleNotificationBell(page);
    await expect(
      page.getByTestId("platform-mobile-chrome").getByTestId(
        "platform-notification-bell",
      ),
    ).toBeVisible();
  });

  test("operator sees accepted status in notification bell", async ({
    page,
  }) => {
    expect(suggestionId).toBeTruthy();
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform");
    await expectSingleNotificationBell(page);
    await expect(notificationBell(page)).toBeVisible();
    await notificationBell(page).click();
    const acceptedItem = page
      .locator('[data-notification-unread="true"]')
      .filter({ hasText: /accepted/i })
      .first();
    await expect(acceptedItem).toBeVisible({ timeout: 30_000 });
    await acceptedItem.click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(
      new RegExp(`/platform/suggestions/${suggestionId}`),
    );
  });
});
