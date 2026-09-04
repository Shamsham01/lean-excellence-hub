import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { DEMO_PROBLEM_SOLVING_CASE } from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const HYPOTHESIS_STATEMENT =
  "Thermal expansion during hot-running shifts seal alignment.";
const CONTAINMENT_DESCRIPTION =
  "Quarantine output from the last three hot-running batches.";
const CURRENT_CONDITION_STATEMENT =
  "Hot-running defect rate is 2.4x the cold-start baseline.";
const aiCurrentConditionCaseTitle = `M12 AI Current Condition ${Date.now().toString(36)}`;

test.describe("Milestone 12 closure", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("manager opens Lean AI on seeded case", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await page.getByTestId("tab-lean-ai").click();
    await expect(page.getByTestId("lean-ai-panel")).toBeVisible();
  });

  test("challenge mode distinguishes assumptions using fake provider", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await page.getByTestId("tab-lean-ai").click();
    await page.getByTestId("lean-ai-mode").selectOption("challenge");
    await page
      .getByTestId("lean-ai-input")
      .fill("Please review assumptions in this case.");
    await page.getByTestId("lean-ai-send").click();
    await expect(page.getByText("assumption", { exact: false })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("operator cannot access Lean AI settings", async ({ page }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/settings/ai");
    await expect(page.getByTestId("ai-settings-page")).toHaveCount(0);
  });

  async function openLeanAiPanel(page: Page) {
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await page.getByTestId("tab-lean-ai").click();
    await expect(page.getByTestId("lean-ai-panel")).toBeVisible();
  }

  async function createActiveCaseAndOpenLeanAi(page: Page) {
    await page.goto("/platform/problem-solving/new");
    const wizard = page.getByTestId("create-problem-solving-wizard");
    await page
      .getByTestId("create-case-title")
      .fill(aiCurrentConditionCaseTitle);
    await wizard
      .getByTestId("create-case-facilitator")
      .selectOption({ index: 1 });
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await wizard
      .getByLabel("Problem statement")
      .fill(
        "Hot-running seal defects exceed the acceptable quality threshold.",
      );
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await wizard
      .getByLabel("Scope in")
      .fill("Packaging Line 3 sealing station");
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await wizard.getByRole("button", { name: "Create draft case" }).click();
    await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("activate-method-select").selectOption({ index: 0 });
    await page.getByTestId("problem-solving-activate-button").click();
    await expect(
      page.getByTestId("problem-solving-header").getByText("Active", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("tab-lean-ai").click();
    await expect(page.getByTestId("lean-ai-panel")).toBeVisible();
  }

  test("accepts a valid hypothesis proposal from fake provider", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await openLeanAiPanel(page);
    await page
      .getByTestId("lean-ai-input")
      .fill("Please propose hypothesis for the hot-running defect pattern.");
    await page.getByTestId("lean-ai-send").click();
    await expect(page.getByTestId("ai-proposal-card")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("ai-proposal-accept").click();
    await expect(page.getByText("Proposal accepted.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("ai-proposal-card")).toHaveCount(0);
    await page.getByTestId("tab-cause-analysis").click();
    const causeAnalysisPanel = page.getByTestId(
      "problem-solving-cause-analysis-panel",
    );
    await expect(causeAnalysisPanel).toBeVisible();
    await expect(
      causeAnalysisPanel.getByText(HYPOTHESIS_STATEMENT).first(),
    ).toBeVisible();
  });

  test("accepts a valid containment proposal from fake provider", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await openLeanAiPanel(page);
    await page
      .getByTestId("lean-ai-input")
      .fill("Please propose containment for suspect hot-running batches.");
    await page.getByTestId("lean-ai-send").click();
    await expect(page.getByTestId("ai-proposal-card")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("ai-proposal-accept").click();
    await expect(page.getByText("Proposal accepted.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("ai-proposal-card")).toHaveCount(0);
    await page.getByTestId("tab-containment").click();
    const containmentPanel = page.getByTestId(
      "problem-solving-containment-panel",
    );
    await expect(containmentPanel).toBeVisible();
    await expect(
      containmentPanel.getByText(CONTAINMENT_DESCRIPTION).first(),
    ).toBeVisible();
  });

  test("accepts a valid current condition proposal from fake provider", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await createActiveCaseAndOpenLeanAi(page);
    await page
      .getByTestId("lean-ai-input")
      .fill("Please propose condition for the measured hot-running gap.");
    await page.getByTestId("lean-ai-send").click();
    await expect(page.getByTestId("ai-proposal-card")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("ai-proposal-accept").click();
    await expect(page.getByText("Proposal accepted.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("ai-proposal-card")).toHaveCount(0);
    await page.getByTestId("tab-current-condition").click();
    const currentConditionPanel = page.getByTestId(
      "problem-solving-current-condition-panel",
    );
    await expect(currentConditionPanel).toBeVisible();
    await expect(
      currentConditionPanel
        .locator('[data-testid^="current-condition-item-"]')
        .filter({ hasText: "Measured fact" }),
    ).toBeVisible();
    await expect(
      currentConditionPanel.getByText(CURRENT_CONDITION_STATEMENT),
    ).toBeVisible();
  });

  test("does not surface invalid current condition proposals for acceptance", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await createActiveCaseAndOpenLeanAi(page);
    await page
      .getByTestId("lean-ai-input")
      .fill(
        "Please propose invalid condition for the measured hot-running gap.",
      );
    await page.getByTestId("lean-ai-send").click();
    await expect(
      page.getByText("invalid current-condition category", {
        exact: false,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("ai-proposal-card")).toHaveCount(0);
  });
});
