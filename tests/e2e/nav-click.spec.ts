import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  approveCurrentReview,
  beginCurrentReview,
  claimCurrentReview,
  openReviewQueueForTitle,
} from "./helpers/suggestion-review";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const uniqueSuffix = Date.now().toString();
const suggestionTitle = `NAV-CLICK suggestion ${uniqueSuffix}`;
const suggestionNoticed = `NAV-CLICK noticed ${uniqueSuffix}`;
const suggestionIdea = `NAV-CLICK idea ${uniqueSuffix}`;

async function platformNav(page: Page, icon: string) {
  return page.getByTestId(`platform-nav-${icon}`);
}

async function clickPlatformNav(page: Page, icon: string) {
  const link = await platformNav(page, icon);
  await expect(link).toBeVisible();
  await link.click();
}

test.describe("NAV-CLICK-001 shared in-app navigation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("platform nav click reaches Suggestions", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform");
    await clickPlatformNav(page, "suggestions");
    await expect(page).toHaveURL(/\/platform\/suggestions(?:\?|$)/);
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
  });

  test("suggestion list-row and detail links navigate", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform");
    await clickPlatformNav(page, "suggestions");
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();

    const titleLink = page.getByTestId(/^suggestion-portfolio-title-/).first();
    await expect(titleLink).toBeVisible();
    const href = await titleLink.getAttribute("href");
    expect(href).toMatch(/\/platform\/suggestions\/[0-9a-f-]{36}/);

    await titleLink.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
  });

  test("suggestion linked action and action list rows navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/suggestions");
    await page
      .getByTestId("suggestion-portfolio-search")
      .fill("Pre-stage changeover tooling");
    await page.getByTestId("suggestion-portfolio-apply").click();
    await page
      .getByRole("link", { name: "Pre-stage changeover tooling" })
      .first()
      .click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();

    await page.getByRole("tab", { name: "Activity" }).click();
    const openAction = page.getByTestId(/^suggestion-open-action-/).first();
    await expect(openAction).toBeVisible();
    await openAction.click();
    await expect(page).toHaveURL(/\/platform\/actions\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("action-detail-page")).toBeVisible();

    await clickPlatformNav(page, "actions");
    await expect(page).toHaveURL(/\/platform\/actions(?:\?|$)/);
    await expect(page.getByTestId("actions-list")).toBeVisible();

    const actionRow = page.getByTestId(/^action-list-item-/).first();
    await expect(actionRow).toBeVisible();
    await actionRow.click();
    await expect(page).toHaveURL(/\/platform\/actions\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("action-detail-page")).toBeVisible();
  });

  test("keyboard Enter on platform nav navigates", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/actions");
    const suggestions = await platformNav(page, "suggestions");
    await suggestions.focus();
    await expect(suggestions).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/platform\/suggestions(?:\?|$)/);
    await expect(page.getByTestId("suggestion-portfolio")).toBeVisible();
  });

  test("modified clicks keep the current document", async ({
    page,
    context,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/suggestions");
    const currentUrl = page.url();
    const actions = await platformNav(page, "actions");

    const popupPromise = context.waitForEvent("page");
    await actions.click({ modifiers: ["ControlOrMeta"] });
    const popup = await popupPromise;
    await popup.waitForURL(/\/platform\/actions/);
    await expect(page).toHaveURL(currentUrl);
    await expect(popup).toHaveURL(/\/platform\/actions/);
    await popup.close();
  });

  test("suggestion open-project link navigates after create", async ({
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
    const suggestionPath = new URL(page.url()).pathname;

    await signInAsDemoUser(page, "manager");
    await openReviewQueueForTitle(page, suggestionTitle);
    await claimCurrentReview(page);
    await beginCurrentReview(page);
    await approveCurrentReview(
      page,
      "Internal: NAV-CLICK project handoff.",
      "Approved so the open-project link can be exercised.",
    );

    await page.goto(suggestionPath);
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await page.getByRole("tab", { name: "Implementation" }).click();
    await page.getByTestId("suggestion-create-project").click();
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(page).toHaveURL(/\/platform\/projects\/[0-9a-f-]{36}/);
    const projectPath = new URL(page.url()).pathname;

    const sourceLink = page.getByTestId(/^project-source-link-/).first();
    if (await sourceLink.count()) {
      await sourceLink.click();
      await expect(page).toHaveURL(new RegExp(`${suggestionPath}$`));
      await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    } else {
      await page.goto(suggestionPath);
      await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    }

    await page.getByRole("tab", { name: "Implementation" }).click();
    const openProject = page.getByTestId(/^suggestion-open-project-/).first();
    if ((await openProject.count()) === 0) {
      await page.getByRole("tab", { name: "Activity" }).click();
    }
    await expect(openProject).toBeVisible({ timeout: 15_000 });
    await openProject.click();
    await expect(page).toHaveURL(new RegExp(`${projectPath}$`));
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
  });
});
