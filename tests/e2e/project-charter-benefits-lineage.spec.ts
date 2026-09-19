import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const uniqueSuffix = Date.now().toString();
const suggestionTitle = `Charter lineage suggestion ${uniqueSuffix}`;
const suggestionNoticed = `Changeovers lose labels ${uniqueSuffix}`;
const suggestionIdea = `Standardise holder positions ${uniqueSuffix}`;
const persistedImpact = `Expected impact ${uniqueSuffix}`;
const actionTitle = `Lineage follow-up ${uniqueSuffix}`;
const benefitTitle = `Lineage benefit ${uniqueSuffix}`;

let suggestionPath = "";
let projectPath = "";
let benefitPath = "";

test.describe("Project charter lifecycle and benefits lineage", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("suggestion-derived project inherits context and is not completable until charter is ready", async ({
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
    await page.goto("/platform/suggestions/review?queue=unassigned");
    await page
      .locator('[data-testid^="review-queue-item-"]', {
        hasText: suggestionTitle,
      })
      .first()
      .click();
    await expect(page.getByTestId("suggestion-review-workspace")).toBeVisible();
    await page.getByTestId("review-claim-button").click();
    await expect(
      page.getByTestId("review-workspace-reviewer-label"),
    ).toContainText(/Claimed by you/i, { timeout: 15_000 });
    await page.getByTestId("review-begin-button").click();
    await page
      .getByTestId("review-rationale")
      .fill("Internal: convert this into a project.");
    await page
      .getByTestId("review-employee-feedback")
      .fill("Approved to become a project.");
    await page.getByTestId("review-approve-button").click();
    await expect(
      page.getByTestId("suggestion-review-workspace").getByText("Accepted", {
        exact: true,
      }),
    ).toBeVisible();

    await page.goto(suggestionPath);
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await page.getByRole("tab", { name: "Implementation" }).click();
    await page.getByTestId("suggestion-create-project").click();
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(page).toHaveURL(/\/platform\/projects\/[0-9a-f-]{36}/);
    projectPath = new URL(page.url()).pathname;

    await expect(page.getByTestId("project-reference")).toBeVisible();
    await expect(page.getByTestId("project-reference")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
    await expect(page.getByTestId("project-problem-input")).toHaveValue(
      suggestionNoticed,
    );
    await expect(page.getByTestId("project-objective-input")).toHaveValue(
      suggestionIdea,
    );
    await expect(page.getByTestId("project-source-links")).toContainText(
      /IDEA-|SUG-/,
    );
    await expect(page.getByTestId("charter-readiness")).toBeVisible();
    await expect(page.getByTestId("charter-readiness")).toContainText(
      "Published methodology",
    );
    await expect(page.getByTestId("submit-charter-button")).toBeDisabled();
  });

  test("draft charter fields persist and a complete charter submits with history", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto(projectPath);
    await expect(page.getByTestId("project-detail-page")).toBeVisible();

    await page.getByTestId("project-impact-input").fill(persistedImpact);
    await page.getByTestId("project-methodology-input").selectOption({
      index: 1,
    });
    await page.getByTestId("save-charter-button").click();
    await expect(page.getByTestId("project-workspace-message")).toContainText(
      "Charter saved",
    );

    await page.getByRole("tab", { name: "Team" }).click();
    await page.getByTestId("project-team-person").selectOption({ index: 1 });
    await page.getByTestId("project-team-role").selectOption("owner");
    await page.getByTestId("project-assign-team-button").click();
    await expect(page.getByTestId("project-workspace-message")).toContainText(
      "Team member assigned",
    );

    await page.reload();
    await expect(page.getByTestId("project-impact-input")).toHaveValue(
      persistedImpact,
    );
    await expect(page.getByTestId("submit-charter-button")).toBeEnabled();
    await page.getByTestId("submit-charter-button").click();
    await expect(page.getByTestId("project-workspace-message")).toContainText(
      "Project submitted for approval",
    );
    await expect(page.getByTestId("project-status")).toHaveText("Submitted");

    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(
      page.getByTestId("project-history-entry").last(),
    ).toContainText("Submitted");
    await page.reload();
    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(
      page.getByTestId("project-history-entry").last(),
    ).toContainText("Submitted");
  });

  test("project actions use canonical action workspace references", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto(projectPath);
    await page.getByRole("tab", { name: "Actions" }).click();
    await page.getByTestId("project-action-title").fill(actionTitle);
    await page.getByTestId("project-add-action").click();
    await expect(page.getByTestId("project-workspace-message")).toContainText(
      "Action created",
    );
    await page.getByRole("link", { name: actionTitle }).click();
    await expect(page.getByTestId("action-detail-page")).toBeVisible();
    await expect(page.getByTestId("action-reference")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
  });

  test("benefit can be created from the project without a raw UUID", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto(projectPath);
    await page.getByRole("tab", { name: "Benefits" }).click();
    await page.getByTestId("project-benefit-title").fill(benefitTitle);
    await page.getByTestId("project-create-benefit-button").click();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();
    benefitPath = new URL(page.url()).pathname;
    await expect(page.getByTestId("benefit-source-links")).toBeVisible();
    await expect(page.getByTestId("benefit-source-links")).not.toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
    await page.locator('[data-testid^="benefit-source-link-"]').first().click();
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await page.getByRole("tab", { name: "Benefits" }).click();
    await expect(page.getByText(benefitTitle)).toBeVisible();
  });

  test("global new benefit uses a searchable human-readable project selector", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/benefits/new");
    await expect(page.getByTestId("create-benefit-wizard")).toBeVisible();
    await page.getByRole("button", { name: "5. Source" }).click();
    await expect(page.getByTestId("project-select")).toBeVisible();
    await expect(page.getByTestId("project-select-input")).toBeVisible();
    await expect(
      page.locator("#project-source-select option").nth(1),
    ).toHaveText(/PROJ-/);
    await expect(page.getByText("Primary source resource ID")).toHaveCount(0);
  });

  test("scoped operator cannot change an in-scope project or create a benefit", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto(projectPath);
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(page.getByTestId("approve-project-button")).toHaveCount(0);
    await expect(
      page.getByTestId("return-project-to-draft-button"),
    ).toHaveCount(0);
    await expect(page.getByTestId("save-charter-button")).toHaveCount(0);
    await page.getByRole("tab", { name: "Benefits" }).click();
    await expect(page.getByTestId("project-create-benefit")).toHaveCount(0);

    await page.goto(benefitPath);
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();

    await page.goto("/platform/benefits/new");
    await expect(page.getByTestId("create-benefit-wizard")).toHaveCount(0);

    await page.goto("/platform/projects/00000000-0000-4000-8000-000000000099");
    await expect(page.getByTestId("project-detail-page")).toHaveCount(0);
  });
});
