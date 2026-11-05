import { expect, type Page } from "@playwright/test";

export async function expectGuidedProblemSolvingWorkspace(page: Page) {
  await expect(page.getByTestId("problem-solving-workspace")).toBeVisible();
  await expect(page.getByTestId("pps-stage-rail")).toBeVisible();
  await expect(page.getByTestId("lean-ai-panel")).toBeVisible();
}

export async function openProblemSolvingStage(
  page: Page,
  semanticStageKey: string,
) {
  const stage = page.getByTestId(`pps-stage-${semanticStageKey}`);
  await expect(stage).toBeVisible();
  await stage.click();
}
