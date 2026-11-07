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

export async function ensureLeanAiPanelOpen(page: Page) {
  const panel = leanAiPanel(page);
  if (await panel.isVisible()) {
    return;
  }
  const mobileTrigger = page.getByTestId("pps-mobile-copilot-trigger");
  if (await mobileTrigger.isVisible()) {
    await mobileTrigger.click();
    await expect(panel).toBeVisible();
    return;
  }
  const headerToggle = page.getByTestId("pps-lean-ai-header-toggle");
  if (await headerToggle.isVisible()) {
    const pressed = await headerToggle.getAttribute("aria-pressed");
    if (pressed === "true") {
      return;
    }
    await headerToggle.click();
    await expect(panel).toBeVisible();
    return;
  }
  const expand = page.getByTestId("lean-ai-expand");
  if (await expand.isVisible()) {
    await expand.click();
    await expect(panel).toBeVisible();
  }
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
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 1024) {
    return;
  }
  await expect(leanAiPanel(page)).toBeVisible();
}

/** Mobile footer link is lg:hidden; desktop uses sidebar nav back to the portfolio. */
export async function expectProblemSolvingPortfolioNavigation(page: Page) {
  const viewport = page.viewportSize();
  const back = page.getByTestId("problem-solving-back-link");
  if (viewport && viewport.width < 1024) {
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/platform/problem-solving");
    return;
  }
  await expect(page.getByTestId("platform-nav-problem-solving")).toBeVisible();
}

export async function goToProblemSolvingPortfolio(page: Page) {
  const back = page.getByTestId("problem-solving-back-link");
  if (await back.isVisible()) {
    await expect(back).toHaveAttribute("href", "/platform/problem-solving");
    await back.click();
  } else {
    await page.getByTestId("platform-nav-problem-solving").click();
  }
  await expect(
    page.getByTestId("problem-solving-portfolio-page"),
  ).toBeVisible();
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
  const viewport = page.viewportSize();
  const useMobileRail = Boolean(viewport && viewport.width < 1024);
  const rail = useMobileRail
    ? page.getByTestId("pps-stage-rail-mobile")
    : page.getByTestId("pps-stage-rail");
  await expect(rail).toBeVisible({
    timeout: 15_000,
  });
  const stageTestId = useMobileRail
    ? `pps-stage-mobile-${semanticStageKey}`
    : `pps-stage-${semanticStageKey}`;
  const stage = page.getByTestId(stageTestId);
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

export const A3_STRUCTURED_METHOD_LABEL =
  "A3 / 8-Step Structured Problem Solving";

export async function activateA3StructuredMethod(page: Page) {
  await page
    .getByTestId("activate-method-select")
    .selectOption({ label: A3_STRUCTURED_METHOD_LABEL });
  await page.getByTestId("problem-solving-activate-button").click();
}
