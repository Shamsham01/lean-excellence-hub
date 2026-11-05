import { expect, type Page } from "@playwright/test";

/** Call before the first navigation in a spec so auto-draft does not race Lean AI sends. */
export async function disableProblemSolvingStageAutoDraft(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("pps-disable-stage-auto-draft", "1");
  });
}

export function leanAiPanel(page: Page) {
  return page.getByTestId("lean-ai-panel");
}

export async function fillLeanAiPrompt(page: Page, text: string) {
  const input = leanAiPanel(page).getByTestId("lean-ai-input");
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await input.fill("");
  await input.pressSequentially(text, { delay: 5 });
  await expect(input).toHaveValue(text);
}

export async function sendLeanAiPrompt(page: Page) {
  const send = leanAiPanel(page).getByTestId("lean-ai-send");
  await expect(send).toBeEnabled({ timeout: 15_000 });
  await send.click();
}

export async function expectGuidedProblemSolvingWorkspace(page: Page) {
  await expect(page.getByTestId("problem-solving-workspace")).toBeVisible();
  await expect(page.getByTestId("pps-stage-rail")).toBeVisible();
  await expect(leanAiPanel(page)).toBeVisible();
}

const STAGE_BUTTON_LABEL: Record<string, RegExp> = {
  CURRENT_CONDITION: /current condition|gather facts/i,
  ROOT_CAUSE_ANALYSIS: /root cause|cause analysis|analyse/i,
  TARGET_CONDITION: /target condition/i,
  COUNTERMEASURES: /countermeasure/i,
  IMPLEMENTATION: /implementation/i,
  EFFECTIVENESS_CHECK: /effectiveness check/i,
  SUSTAINMENT: /sustainment|standards/i,
  DEFINE: /define/i,
};

export async function openProblemSolvingStage(
  page: Page,
  semanticStageKey: string,
) {
  const rail = page.getByTestId("pps-stage-rail");
  await expect(rail).toBeVisible({
    timeout: 15_000,
  });
  const stage = page.getByTestId(`pps-stage-${semanticStageKey}`);
  if ((await stage.count()) > 0) {
    await expect(stage).toBeVisible({ timeout: 15_000 });
    await stage.scrollIntoViewIfNeeded();
    await stage.click();
    return;
  }
  const label = STAGE_BUTTON_LABEL[semanticStageKey];
  if (!label) {
    throw new Error(`Unknown problem-solving stage key: ${semanticStageKey}`);
  }
  const byLabel = rail.getByRole("button", { name: label });
  await expect(byLabel).toBeVisible({ timeout: 15_000 });
  await byLabel.scrollIntoViewIfNeeded();
  await byLabel.click();
}
