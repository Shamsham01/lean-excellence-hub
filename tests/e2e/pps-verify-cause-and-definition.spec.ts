import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  disableProblemSolvingStageAutoDraft,
  expectGuidedProblemSolvingWorkspace,
  openProblemSolvingStage,
} from "./helpers/guided-problem-solving-workspace";
import { DEMO_PROBLEM_SOLVING_CASE } from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("PPS verify cause and case definition edit", () => {
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test.beforeEach(async ({ page }) => {
    await disableProblemSolvingStageAutoDraft(page);
  });

  test("manager verifies a hypothesis and edits problem statement", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await expectGuidedProblemSolvingWorkspace(page);

    await openProblemSolvingStage(page, "DEFINE");
    const nextStatement = `Updated problem statement ${Date.now().toString(36)}`;
    await page.getByTestId("pps-problem-statement-edit").click();
    await page.getByTestId("pps-problem-statement-input").fill(nextStatement);
    await page.getByTestId("pps-problem-statement-save").click();
    await expect(page.getByText(nextStatement)).toBeVisible({
      timeout: 15_000,
    });

    await openProblemSolvingStage(page, "ROOT_CAUSE_ANALYSIS");
    const causePanel = page.getByTestId("pps-unified-cause-analysis");
    await expect(causePanel).toBeVisible();

    const hypothesisCard = causePanel
      .locator('[data-testid^="hypothesis-item-"]')
      .first();
    await expect(hypothesisCard).toBeVisible();

    const startTesting = hypothesisCard.getByRole("button", {
      name: "Start testing",
    });
    if (await startTesting.isVisible()) {
      await startTesting.click();
    }

    await hypothesisCard
      .getByTestId(/^hypothesis-test-question-/)
      .fill("Does the evidence support this cause?");
    await hypothesisCard
      .getByTestId(/^hypothesis-test-expected-/)
      .fill("Measured effect matches predicted failure mode.");
    await hypothesisCard.getByTestId(/^create-hypothesis-test-/).click();

    await hypothesisCard
      .getByTestId(/^hypothesis-test-actual-/)
      .fill("Measurements matched the predicted failure mode.");
    await hypothesisCard
      .getByTestId(/^hypothesis-test-conclusion-/)
      .selectOption("supports");
    await hypothesisCard.getByTestId(/^complete-hypothesis-test-/).click();

    await hypothesisCard.getByTestId(/^verify-cause-/).click();
    await page
      .getByTestId("verify-cause-rationale")
      .fill("Test evidence supports verified root cause for this case.");
    await page.getByTestId("confirm-verify-cause").click();

    await expect(
      hypothesisCard.getByText("Verified cause", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("case definition edit is usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await expectGuidedProblemSolvingWorkspace(page);
    await openProblemSolvingStage(page, "DEFINE");
    await page.getByTestId("pps-target-condition-edit").click();
    await expect(page.getByTestId("pps-target-condition-input")).toBeVisible();
    const overflow = await page
      .getByTestId("problem-solving-overview-panel")
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
