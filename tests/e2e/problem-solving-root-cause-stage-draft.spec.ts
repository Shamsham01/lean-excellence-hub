import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  disableProblemSolvingStageAutoDraft,
  expectGuidedProblemSolvingWorkspace,
  openDemoProblemSolvingCaseFromPortfolio,
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
    await openDemoProblemSolvingCaseFromPortfolio(page);
    await expectGuidedProblemSolvingWorkspace(page);
    await openProblemSolvingStage(page, "ROOT_CAUSE_ANALYSIS");
    const preview = page.getByTestId("pps-stage-not-reached-notice");
    if (await preview.isVisible()) {
      await page.getByTestId("pps-advance-to-viewed-stage").click();
      await expect(preview).toBeHidden({ timeout: 15_000 });
    }

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
