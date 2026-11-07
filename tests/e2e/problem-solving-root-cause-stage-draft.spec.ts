import { expect, test } from "@playwright/test";

import { DEMO_PROBLEM_SOLVING_CASE } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  disableProblemSolvingStageAutoDraft,
  expectGuidedProblemSolvingWorkspace,
  openProblemSolvingStage,
} from "./helpers/guided-problem-solving-workspace";

test.describe("Problem solving root cause stage draft", () => {
  test("Draft this stage on ROOT_CAUSE_ANALYSIS creates a pending proposal", async ({
    page,
  }) => {
    test.skip(
      process.env.E2E_WITH_SUPABASE !== "1",
      "Requires local Supabase E2E stack with fake AI provider",
    );

    await signInAsDemoUser(page, "manager");
    await disableProblemSolvingStageAutoDraft(page);
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await expectGuidedProblemSolvingWorkspace(page);
    await openProblemSolvingStage(page, "ROOT_CAUSE_ANALYSIS");

    const draftButton = page.getByTestId("pps-stage-auto-draft-button");
    await expect(draftButton).toBeVisible();
    await draftButton.click();

    await expect(page.getByTestId("ai-proposal-card").first()).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page.getByText(/Lean AI finished but did not create any proposals/i),
    ).toHaveCount(0);
  });
});
