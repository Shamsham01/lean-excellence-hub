import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import {
  loginAsCookieWorksPersona,
  COOKIEWORKS_ORGANISATION,
} from "./helpers/cookieworks-auth";
import {
  approveCurrentReview,
  beginCurrentReview,
  claimCurrentReview,
  openReviewQueueForTitle,
} from "./helpers/suggestion-review";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const uniqueSuffix = Date.now().toString(36);
const programmeName = `CW smoke programme ${uniqueSuffix}`;
const categoryName = `CW smoke category ${uniqueSuffix}`;
const suggestionTitle = `CW smoke idea ${uniqueSuffix}`;
const suggestionNoticed = `Packing labels smudge after washdown ${uniqueSuffix}`;
const suggestionIdea = `Add a sealed holder at the pack-out bench ${uniqueSuffix}`;
const BODMIN_FACTORY_LABEL = "Bodmin Cookie Factory";
const EXETER_FACTORY_LABEL = "Exeter Cookie Factory";

function unitTreeNode(page: import("@playwright/test").Page, name: string) {
  return page
    .getByTestId("organisation-unit-tree")
    .locator('[data-testid^="org-unit-node-"]')
    .filter({
      has: page.locator("p.font-medium", { hasText: name }),
    });
}

let suggestionPath = "";
let actionPath = "";
let projectPath = "";

function resetCookieWorksFoundation() {
  execSync("npm run qa:cookie:reset", {
    cwd: join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
    env: {
      ...process.env,
      LEANHUB_ALLOW_QA_TENANT: "1",
    },
    stdio: "pipe",
  });
}

test.describe("CookieWorks suggestion-action-project smoke loop", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and CookieWorks foundation reset (npm run qa:cookie:reset)",
  );

  test.beforeAll(() => {
    resetCookieWorksFoundation();
  });

  test("Bodmin production manager sees Bodmin Operations subtree only", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "productionManager");
    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await expect(page.getByTestId("organisation-unit-tree")).toBeVisible();
    await expect(unitTreeNode(page, "Operations")).toBeVisible();
    await expect(unitTreeNode(page, "Packing")).toBeVisible();
    await expect(unitTreeNode(page, "Decorating")).toBeVisible();
    await expect(page.getByText(EXETER_FACTORY_LABEL)).toHaveCount(0);
    await expect(page.getByTestId("platform-sidebar-org-name")).toHaveText(
      COOKIEWORKS_ORGANISATION.name,
    );
  });

  test("Exeter production manager sees Exeter Operations subtree only", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "exeterProductionManager");
    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await expect(page.getByTestId("organisation-unit-tree")).toBeVisible();
    await expect(unitTreeNode(page, "Operations")).toBeVisible();
    await expect(unitTreeNode(page, "Packing")).toBeVisible();
    await expect(page.getByText("Decorating")).toHaveCount(0);
    await expect(page.getByText(BODMIN_FACTORY_LABEL)).toHaveCount(0);
  });

  test("Organisation-wide CI manager sees both site roots", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "ciManager");
    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await expect(unitTreeNode(page, BODMIN_FACTORY_LABEL)).toBeVisible();
    await expect(unitTreeNode(page, EXETER_FACTORY_LABEL)).toBeVisible();
  });

  test("CI manager publishes a programme and category from empty foundation", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "ciManager");
    await page.goto("/platform/suggestions/new");
    await expect(
      page.getByTestId("suggestion-configuration-block"),
    ).toBeVisible();
    await expect(
      page.getByTestId("suggestion-configure-programmes-link"),
    ).toBeVisible();

    await page.goto("/platform/suggestions/programmes");
    await expect(page.getByTestId("programme-management")).toBeVisible();
    await expect(page.getByTestId("programme-empty-state")).toBeVisible();

    await page.getByTestId("new-programme-button").click();
    await expect(page.getByTestId("programme-create-panel")).toBeVisible();
    await page.locator("#programme-name").fill(programmeName);
    await expect(page.getByTestId("programme-auto-code-preview")).toContainText(
      "Code:",
    );
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByText("Programme draft created.")).toBeVisible();
    await expect(page.getByText(programmeName)).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(
      page.locator('[data-testid^="programme-status-"]').first(),
    ).toHaveText(/Active/i, { timeout: 15_000 });

    await page.getByTestId("new-category-button").click();
    await expect(page.getByTestId("category-create-panel")).toBeVisible();
    await page.locator("#category-name").fill(categoryName);
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page.getByText("Category created.")).toBeVisible();
    await expect(page.getByText(categoryName)).toBeVisible();
  });

  test("operator submits a Bodmin suggestion once programmes exist", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "operator");
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await expect(
      page.getByTestId("suggestion-configuration-block"),
    ).toHaveCount(0);

    await page.locator("textarea").first().fill(suggestionNoticed);
    await page.locator("textarea").nth(1).fill(suggestionIdea);
    await page.locator("form input").first().fill(suggestionTitle);
    await page.getByRole("button", { name: "Submit idea" }).click();
    await expect(page).toHaveURL(/\/platform\/suggestions\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: suggestionTitle }),
    ).toBeVisible();
    suggestionPath = new URL(page.url()).pathname;
  });

  test("team leader claims, begins, and approves the suggestion", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "teamLeader");
    await openReviewQueueForTitle(page, suggestionTitle, "unassigned");
    await claimCurrentReview(page);
    await beginCurrentReview(page);
    await approveCurrentReview(
      page,
      "Approved for a packing-bench follow-up.",
      "We will raise an action and a project from this idea.",
    );
  });

  test("Bodmin production manager opens the created action and project", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "productionManager");
    await page.goto(suggestionPath);
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
    await expect(page.getByTestId("action-reference")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
    actionPath = new URL(page.url()).pathname;

    await page.goto(suggestionPath);
    await page.getByRole("tab", { name: "Implementation" }).click();
    await page.getByTestId("suggestion-create-project").click();
    await expect(page).toHaveURL(/\/platform\/projects\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(page.getByTestId("project-reference")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
    projectPath = new URL(page.url()).pathname;

    await page.goto(suggestionPath);
    await page.getByRole("tab", { name: "Activity" }).click();
    const openProject = page.getByTestId(/^suggestion-open-project-/).first();
    await expect(openProject).toHaveAttribute("href", projectPath);
    expect(await openProject.innerText()).toMatch(/Open project/i);
    const openAction = page.getByTestId(/^suggestion-open-action-/).first();
    await expect(openAction).toHaveAttribute("href", actionPath);
  });

  test("Exeter production manager cannot open the Bodmin action or project workspaces", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "exeterProductionManager");
    await page.goto(actionPath);
    await expect(page.getByTestId("action-detail-page")).toHaveCount(0);
    await page.goto(projectPath);
    await expect(page.getByTestId("project-detail-page")).toHaveCount(0);
  });
});
