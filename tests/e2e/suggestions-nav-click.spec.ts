import { expect, test, type Page } from "@playwright/test";

import { DEMO_SUGGESTION_PROGRAMME } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  beginCurrentReview,
  claimCurrentReview,
  expectReviewStatus,
  parkCurrentReview,
  reviewWorkspace,
} from "./helpers/suggestion-review";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const uniqueSuffix = Date.now().toString(36);
const DEMO_IMPLEMENTED_TITLE = "Pre-stage changeover tooling";
const suggestionTitle = `NAV-CLICK suggestions ${uniqueSuffix}`;
const suggestionNoticed = `NAV-CLICK noticed ${uniqueSuffix}`;
const suggestionIdea = `NAV-CLICK idea ${uniqueSuffix}`;

let createdSuggestionPath = "";
let createdActionPath = "";
let createdProjectPath = "";

async function openSuggestionsHub(page: Page) {
  await page.goto("/platform/suggestions");
  await expect(page.getByTestId("suggestions-overview")).toBeVisible();
  await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
}

async function submitNewSuggestion(page: Page) {
  await page.goto("/platform/suggestions/new");
  await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
  await page.locator("textarea").first().fill(suggestionNoticed);
  await page.locator("textarea").nth(1).fill(suggestionIdea);
  await page.locator("form input").first().fill(suggestionTitle);
  await page.getByRole("button", { name: "Submit idea" }).click();
  await expect(page).toHaveURL(/\/platform\/suggestions\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: suggestionTitle }),
  ).toBeVisible();
  createdSuggestionPath = new URL(page.url()).pathname;
}

test.describe("NAV-CLICK-001 Suggestions navigation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("hub New suggestion, Programmes, Open queue, portfolio row, and Back navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openSuggestionsHub(page);

    const newSuggestion = page.getByTestId("suggestions-new-link");
    await expect(newSuggestion).toHaveAttribute(
      "href",
      "/platform/suggestions/new",
    );
    await newSuggestion.click();
    await expect(page).toHaveURL(/\/platform\/suggestions\/new(?:\?|$)/);
    await expect(page.getByTestId("new-suggestion-page")).toBeVisible();
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();

    await openSuggestionsHub(page);
    const programmes = page.getByTestId("suggestions-programmes-link");
    await expect(programmes).toHaveAttribute(
      "href",
      "/platform/suggestions/programmes",
    );
    await programmes.click();
    await expect(page).toHaveURL(/\/platform\/suggestions\/programmes(?:\?|$)/);
    await expect(page.getByTestId("suggestion-programmes-page")).toBeVisible();
    await expect(page.getByTestId("programme-management")).toBeVisible();
    await expect(page.getByText(DEMO_SUGGESTION_PROGRAMME.name)).toBeVisible();

    const programmesBack = page.getByTestId("suggestions-programmes-back-link");
    await expect(programmesBack).toHaveAttribute(
      "href",
      "/platform/suggestions",
    );
    await programmesBack.click();
    await expect(page).toHaveURL(/\/platform\/suggestions(?:\?|$)/);
    await expect(page.getByTestId("suggestions-overview")).toBeVisible();

    const openQueue = page.getByTestId("suggestions-open-queue-link");
    await expect(openQueue).toHaveAttribute(
      "href",
      "/platform/suggestions/review?queue=mine",
    );
    await openQueue.click();
    await expect(page).toHaveURL(/\/platform\/suggestions\/review\?queue=mine/);
    await expect(page.getByTestId("suggestion-review-queue")).toBeVisible();

    await openSuggestionsHub(page);
    await page
      .getByTestId("suggestion-portfolio-search")
      .fill(DEMO_IMPLEMENTED_TITLE);
    await page.getByTestId("suggestion-portfolio-apply").click();
    const titleLink = page
      .getByRole("link", { name: DEMO_IMPLEMENTED_TITLE })
      .first();
    await expect(titleLink).toBeVisible();
    const suggestionHref = await titleLink.getAttribute("href");
    expect(suggestionHref).toMatch(/\/platform\/suggestions\/[0-9a-f-]{36}$/);
    await titleLink.click();
    await expect(page).toHaveURL(new RegExp(`${suggestionHref}$`));
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_IMPLEMENTED_TITLE }),
    ).toBeVisible();

    const back = page.getByTestId("suggestions-detail-back-link");
    await expect(back).toHaveAttribute("href", "/platform/suggestions");
    await back.click();
    await expect(page).toHaveURL(/\/platform\/suggestions(?:\?|$)/);
    await expect(page.getByTestId("suggestions-overview")).toBeVisible();
  });

  test("keyboard Enter on New suggestion navigates", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await openSuggestionsHub(page);

    const newSuggestion = page.getByTestId("suggestions-new-link");
    await newSuggestion.focus();
    await expect(newSuggestion).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/platform\/suggestions\/new(?:\?|$)/);
    await expect(page.getByTestId("new-suggestion-page")).toBeVisible();
  });

  test("modified click on Programmes keeps the current document", async ({
    page,
    context,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openSuggestionsHub(page);
    const currentUrl = page.url();

    const popupPromise = context.waitForEvent("page");
    await page.getByTestId("suggestions-programmes-link").click({
      modifiers: ["ControlOrMeta"],
    });
    const popup = await popupPromise;
    await popup.waitForURL(/\/platform\/suggestions\/programmes/);
    await expect(page).toHaveURL(currentUrl);
    await expect(popup.getByTestId("suggestion-programmes-page")).toBeVisible();
    await popup.close();
  });

  test("suggestion linked Action navigates from the seeded implemented idea", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openSuggestionsHub(page);
    await page
      .getByTestId("suggestion-portfolio-search")
      .fill(DEMO_IMPLEMENTED_TITLE);
    await page.getByTestId("suggestion-portfolio-apply").click();
    await page
      .getByRole("link", { name: DEMO_IMPLEMENTED_TITLE })
      .first()
      .click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();

    await page.getByRole("tab", { name: "Activity" }).click();
    const openAction = page.getByTestId(/^suggestion-open-action-/).first();
    await expect(openAction).toBeVisible();
    const actionHref = await openAction.getAttribute("href");
    expect(actionHref).toMatch(/\/platform\/actions\/[0-9a-f-]{36}$/);
    expect(await openAction.innerText()).toMatch(/Open action/i);
    await openAction.click();
    await expect(page).toHaveURL(new RegExp(`${actionHref}$`));
    await expect(page.getByTestId("action-detail-page")).toBeVisible();
    await expect(page.getByTestId("action-reference")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
  });

  test("new suggestion submit opens the created workspace without a router race", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "operator");
    await submitNewSuggestion(page);
  });

  test("review queue row, claim/begin, park, approve, View, and Back navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/suggestions/review?queue=unassigned");
    await expect(page.getByTestId("suggestion-review-queue")).toBeVisible();

    const queueItem = page
      .locator('[data-testid^="review-queue-item-"]', {
        hasText: suggestionTitle,
      })
      .first();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if ((await queueItem.count()) > 0) {
        break;
      }
      const next = page.getByTestId("review-queue-next");
      if ((await next.getAttribute("disabled")) !== null) {
        break;
      }
      await next.click();
      await expect(page.getByTestId("suggestion-review-queue")).toBeVisible();
    }

    await expect(queueItem).toBeVisible();
    const queueHref = await queueItem.getAttribute("href");
    expect(queueHref).toMatch(/suggestionId=[0-9a-f-]{36}/);
    await queueItem.click();
    await expect(page).toHaveURL(new RegExp(`suggestionId=`));
    await expect(reviewWorkspace(page)).toBeVisible();
    await expect(reviewWorkspace(page)).toContainText(suggestionTitle);

    await claimCurrentReview(page);
    await beginCurrentReview(page);
    await expectReviewStatus(page, "Under Review");

    await parkCurrentReview(
      page,
      "Internal: NAV-CLICK park destination check.",
      "Parked briefly so review navigation can be verified.",
    );
    await expectReviewStatus(page, "Parked");
    await expect(page).toHaveURL(/\/platform\/suggestions\/review/);

    await page.getByTestId("review-begin-button").click();
    await expectReviewStatus(page, "Under Review");

    await page
      .getByTestId("review-rationale")
      .fill("Internal: NAV-CLICK approve destination check.");
    await page
      .getByTestId("review-employee-feedback")
      .fill("Approved so View and Back links can be exercised.");
    await page.getByTestId("review-approve-button").click();
    await expectReviewStatus(page, "Accepted");

    const suggestionId = createdSuggestionPath.replace(
      "/platform/suggestions/",
      "",
    );
    const viewSuggestion = page.getByTestId("review-view-suggestion");
    await expect(viewSuggestion).toHaveAttribute("href", createdSuggestionPath);
    await viewSuggestion.click();
    await expect(page).toHaveURL(new RegExp(`${createdSuggestionPath}$`));
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: suggestionTitle }),
    ).toBeVisible();

    await page.goto(
      `/platform/suggestions/review?suggestionId=${suggestionId}`,
    );
    await expect(reviewWorkspace(page)).toBeVisible();
    await expect(reviewWorkspace(page)).toContainText(suggestionTitle);
    const backToQueue = page.getByTestId("review-back-to-queue");
    await expect(backToQueue).toHaveAttribute(
      "href",
      "/platform/suggestions/review",
    );
    await backToQueue.click();
    await expect(page).toHaveURL(/\/platform\/suggestions\/review(?:\?|$)/);
    await expect(page.getByTestId("suggestion-review-queue")).toBeVisible();
  });

  test("action and project creation success links reach the correct workspace", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto(createdSuggestionPath);
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await page.getByRole("tab", { name: "Implementation" }).click();

    await page.getByTestId("suggestion-create-action").click();
    const openCreatedAction = page.getByTestId(
      "suggestion-open-created-action",
    );
    await expect(openCreatedAction).toBeVisible();
    const actionHref = await openCreatedAction.getAttribute("href");
    expect(actionHref).toMatch(/\/platform\/actions\/[0-9a-f-]{36}$/);
    expect(await openCreatedAction.innerText()).toMatch(/Open action/i);
    await expect(page.getByTestId("suggestion-handoff-message")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
    await openCreatedAction.click();
    await expect(page).toHaveURL(new RegExp(`${actionHref}$`));
    await expect(page.getByTestId("action-detail-page")).toBeVisible();
    createdActionPath = new URL(page.url()).pathname;

    await page.goto(createdSuggestionPath);
    await page.getByRole("tab", { name: "Implementation" }).click();
    await page.getByTestId("suggestion-create-project").click();
    await expect(page).toHaveURL(/\/platform\/projects\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(page.getByTestId("project-reference")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
    createdProjectPath = new URL(page.url()).pathname;

    await page.goto(createdSuggestionPath);
    await page.getByRole("tab", { name: "Activity" }).click();
    const openProject = page.getByTestId(/^suggestion-open-project-/).first();
    await expect(openProject).toBeVisible();
    await expect(openProject).toHaveAttribute("href", createdProjectPath);
    expect(await openProject.innerText()).toMatch(/Open project/i);
    await openProject.click();
    await expect(page).toHaveURL(new RegExp(`${createdProjectPath}$`));
    await expect(page.getByTestId("project-detail-page")).toBeVisible();

    await page.goto(createdSuggestionPath);
    await page.getByRole("tab", { name: "Activity" }).click();
    const openAction = page.getByTestId(/^suggestion-open-action-/).first();
    await expect(openAction).toHaveAttribute("href", createdActionPath);
    await openAction.click();
    await expect(page).toHaveURL(new RegExp(`${createdActionPath}$`));
    await expect(page.getByTestId("action-detail-page")).toBeVisible();
  });
});
