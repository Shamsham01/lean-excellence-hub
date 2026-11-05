import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  disableProblemSolvingStageAutoDraft,
  expectGuidedProblemSolvingWorkspace,
  fillLeanAiPrompt,
  leanAiPanel,
  openProblemSolvingStage,
  sendLeanAiPrompt,
} from "./helpers/guided-problem-solving-workspace";
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

  test.beforeEach(async ({ page }) => {
    await disableProblemSolvingStageAutoDraft(page);
  });

  test("manager opens Lean AI on seeded case", async ({ page }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await expectGuidedProblemSolvingWorkspace(page);
  });

  test("challenge mode distinguishes assumptions using fake provider", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await expectGuidedProblemSolvingWorkspace(page);
    await leanAiPanel(page)
      .getByTestId("lean-ai-mode")
      .selectOption("challenge");
    await fillLeanAiPrompt(page, "Please review assumptions in this case.");
    await sendLeanAiPrompt(page);
    await expect(page.getByText("assumption", { exact: false })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("operator cannot access Lean AI settings", async ({ page }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/settings/ai");
    await expect(page.getByTestId("ai-settings-page")).toHaveCount(0);
  });

  test("administrator reviews LeanAI settings on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/settings/ai");
    const settings = page.getByTestId("ai-settings-page");
    await expect(settings).toBeVisible();
    await expect(settings).toContainText(
      "Included at no extra charge, subject to reasonable fair use.",
    );
    await expect(settings).not.toContainText("500,000");
    await expect(settings).not.toContainText("2,000,000");
    await expect(settings).not.toContainText(/unlimited/i);
    await expect(page.getByTestId("ai-settings-web-search")).toBeVisible();
    const governance = page.getByTestId("ai-settings-governance");
    if (!(await governance.isVisible())) {
      await page.getByTestId("ai-settings-advanced-toggle").click();
    }
    await expect(governance).toContainText("pauses new LeanAI interactions");
    const overflow = await settings.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  async function openLeanAiPanel(page: Page) {
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await expectGuidedProblemSolvingWorkspace(page);
  }

  async function createActiveCaseAndOpenLeanAi(page: Page) {
    await page.goto("/platform/problem-solving/new");
    const wizard = page.getByTestId("create-problem-solving-wizard");
    await page
      .getByTestId("create-case-title")
      .fill(aiCurrentConditionCaseTitle);
    await wizard.getByTestId("case-unit-select").selectOption({ index: 1 });
    await wizard.getByTestId("create-case-owner").selectOption({ index: 1 });
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
    await expectGuidedProblemSolvingWorkspace(page);
  }

  test("accepts a valid hypothesis proposal from fake provider", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await openLeanAiPanel(page);
    await fillLeanAiPrompt(
      page,
      "Please propose hypothesis for the hot-running defect pattern.",
    );
    await sendLeanAiPrompt(page);
    await expect(page.getByTestId("ai-proposal-card")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("ai-proposal-accept").click();
    await expect(page.getByText("Proposal accepted.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("ai-proposal-card")).toHaveCount(0);
    await openProblemSolvingStage(page, "ROOT_CAUSE_ANALYSIS");
    const causeAnalysisPanel = page.getByTestId("pps-unified-cause-analysis");
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
    await fillLeanAiPrompt(
      page,
      "Please propose containment for suspect hot-running batches.",
    );
    await sendLeanAiPrompt(page);
    await expect(page.getByTestId("ai-proposal-card")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("ai-proposal-accept").click();
    await expect(page.getByText("Proposal accepted.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("ai-proposal-card")).toHaveCount(0);
    await openProblemSolvingStage(page, "CURRENT_CONDITION");
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
    await fillLeanAiPrompt(
      page,
      "Please propose condition for the measured hot-running gap.",
    );
    await sendLeanAiPrompt(page);
    await expect(page.getByTestId("ai-proposal-card")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("ai-proposal-accept").click();
    await expect(page.getByText("Proposal accepted.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("ai-proposal-card")).toHaveCount(0);
    const caseUrl = page.url();
    await page.goto(caseUrl);
    await expectGuidedProblemSolvingWorkspace(page);
    await openProblemSolvingStage(page, "CURRENT_CONDITION");
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
    await fillLeanAiPrompt(
      page,
      "Please propose invalid condition for the measured hot-running gap.",
    );
    await sendLeanAiPrompt(page);
    await expect(
      page.getByText("invalid current-condition category", {
        exact: false,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("ai-proposal-card")).toHaveCount(0);
  });
});
