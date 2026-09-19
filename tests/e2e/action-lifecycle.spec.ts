import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  approveCurrentReview,
  beginCurrentReview,
  claimCurrentReview,
  openReviewQueueForTitle,
} from "./helpers/suggestion-review";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const uniqueSuffix = Date.now().toString();
const suggestionTitle = `Lifecycle suggestion ${uniqueSuffix}`;
const suggestionNoticed = `Lifecycle labels ${uniqueSuffix}`;
const suggestionIdea = `Holders for lifecycle ${uniqueSuffix}`;
const actionTitle = `Checklist follow-up ${uniqueSuffix}`;
const updatedTitle = `Checklist follow-up edited ${uniqueSuffix}`;

let suggestionPath = "";
let actionPath = "";

test.describe("Action lifecycle and suggestion traceability", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("action cards open a stable detail route and persist edits", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    await expect(page.getByTestId("actions-page")).toBeVisible();

    await page.getByLabel("Title").fill(actionTitle);
    await page.getByLabel("Description").fill("Initial description");
    await page.getByRole("button", { name: "Create action" }).click();

    await expect(page.getByTestId("action-detail-page")).toBeVisible();
    await expect(page).toHaveURL(/\/platform\/actions\/[0-9a-f-]{36}/);
    actionPath = new URL(page.url()).pathname;
    await expect(page.getByTestId("action-reference")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );

    await page.getByTestId("action-title-input").fill(updatedTitle);
    await page.getByTestId("action-description-input").fill("Persisted notes");
    await page.getByTestId("action-priority-input").selectOption("high");
    await page.getByTestId("action-due-input").fill("2026-10-01");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("action-workspace-message")).toContainText(
      "Changes saved",
    );

    await page.reload();
    await expect(page.getByTestId("action-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: updatedTitle }),
    ).toBeVisible();
    await expect(page.getByTestId("action-priority")).toHaveText("High");
    await expect(page.getByTestId("action-due-input")).toHaveValue(
      "2026-10-01",
    );
  });

  test("valid lifecycle transitions complete and remain in history after refresh", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto(actionPath);
    await expect(page.getByTestId("action-detail-page")).toBeVisible();

    await page.getByTestId("action-start-button").click();
    await expect(page.getByTestId("action-status")).toHaveText("In progress");

    await page.getByTestId("action-complete-button").click();
    await expect(page.getByTestId("action-status")).toHaveText("Completed");

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByTestId("action-history")).toContainText("Completed");
    await expect(page.getByTestId("action-history-entry").last()).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("action-status")).toHaveText("Completed");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByTestId("action-history-entry").last()).toContainText(
      "Completed",
    );
  });

  test("scoped operator cannot open an out-of-scope action", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto(actionPath);
    await expect(page.getByTestId("action-detail-page")).toHaveCount(0);
    await expect(page.getByTestId("actions-page")).toHaveCount(0);
  });

  test("suggestion handoff creates one navigable action with source back-link", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await page.locator("textarea").first().fill(suggestionNoticed);
    await page.locator("textarea").nth(1).fill(suggestionIdea);
    await page.locator("form input").first().fill(suggestionTitle);
    await page.getByRole("button", { name: "Submit idea" }).click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    suggestionPath = new URL(page.url()).pathname;

    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(page, suggestionTitle);
    await claimCurrentReview(page);
    await beginCurrentReview(page);
    await approveCurrentReview(
      page,
      "Internal: safe to implement as an action.",
      "Approved for a linked action.",
    );

    await page.goto(suggestionPath);
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await page.getByRole("tab", { name: "Implementation" }).click();
    await page.getByTestId("suggestion-create-action").click();
    await expect(
      page.getByTestId("suggestion-open-created-action"),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(page.getByTestId("suggestion-activity-actions")).toContainText(
      "Action:",
    );
    await expect(
      page.getByTestId("suggestion-activity-actions").getByText("Open action"),
    ).toBeVisible();

    await page
      .getByTestId("suggestion-activity-actions")
      .getByText("Open action")
      .click();
    await expect(page.getByTestId("action-detail-page")).toBeVisible();
    await expect(page.getByTestId("action-source-link")).toBeVisible();
    await expect(page.getByTestId("action-source-link")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
    await page.getByTestId("action-source-link").click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
  });

  test("repeated suggestion handoff stays on a single linked action", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto(suggestionPath);
    await page.getByRole("tab", { name: "Implementation" }).click();
    await page.getByTestId("suggestion-create-action").click();
    await expect(page.getByTestId("suggestion-handoff-message")).toContainText(
      "already has a linked action",
    );
    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(
      page.locator('[data-testid^="suggestion-linked-action-"]'),
    ).toHaveCount(1);
  });
});
