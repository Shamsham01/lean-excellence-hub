import { expect, test } from "@playwright/test";

import { DEMO_PROBLEM_SOLVING_CASE } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  activateA3StructuredMethod,
  disableProblemSolvingStageAutoDraft,
  fillLeanAiPrompt,
  leanAiPanel,
  sendLeanAiPrompt,
} from "./helpers/guided-problem-solving-workspace";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const FISHBONE_CAUSE_LABEL = "Guide roller wear after heat soak";

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function openActiveCaseFishboneStage(
  page: import("@playwright/test").Page,
) {
  await signInAsDemoUser(page, "manager");
  await page.goto("/platform/problem-solving/new");
  const title = `PPS fishbone mobile ${Date.now().toString(36)}`;
  const wizard = page.getByTestId("create-problem-solving-wizard");
  await page.getByTestId("create-case-title").fill(title);
  await wizard.getByTestId("case-unit-select").selectOption({ index: 1 });
  await wizard.getByTestId("create-case-owner").selectOption({ index: 1 });
  await wizard
    .getByTestId("create-case-facilitator")
    .selectOption({ index: 1 });
  await wizard.getByRole("button", { name: "Next", exact: true }).click();
  await wizard
    .getByLabel("Problem statement")
    .fill("Seal defects spike during hot-running shifts on Line 3.");
  await wizard.getByRole("button", { name: "Next", exact: true }).click();
  await wizard.getByLabel("Scope in").fill("Packaging Line 3");
  for (let step = 0; step < 3; step += 1) {
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
  }
  await wizard.getByRole("button", { name: "Create draft case" }).click();
  await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible({
    timeout: 30_000,
  });
  await activateA3StructuredMethod(page);
  await expect(
    page.getByTestId("problem-solving-header").getByText("Active", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
  const caseBaseUrl = page.url().replace(/\?.*$/, "");
  await page.goto(`${caseBaseUrl}?stage=ROOT_CAUSE_ANALYSIS`);
  await expect(page.getByTestId("pps-unified-cause-analysis")).toBeVisible({
    timeout: 15_000,
  });
}

async function openFishboneStage(page: import("@playwright/test").Page) {
  await signInAsDemoUser(page, "manager");
  await page.goto("/platform/problem-solving");
  await page
    .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
    .click();
  await expect(page.getByTestId("problem-solving-workspace")).toBeVisible({
    timeout: 30_000,
  });
  const caseBaseUrl = page.url().replace(/\?.*$/, "");
  await page.goto(`${caseBaseUrl}?stage=ROOT_CAUSE_ANALYSIS`);
  await expect(page.getByTestId("pps-unified-cause-analysis")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("PPS fishbone mobile", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test.beforeEach(async ({ page }) => {
    await disableProblemSolvingStageAutoDraft(page);
    await page.addInitScript(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("pps-lean-ai-copilot:")) {
          window.localStorage.removeItem(key);
        }
      }
    });
  });

  test("390px fishbone stage has no horizontal overflow with chat closed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFishboneStage(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: "/opt/cursor/artifacts/pps-fishbone-390-overflow-fixed.png",
      fullPage: true,
    });
  });

  test("390px fishbone stage has no horizontal overflow with Lean AI open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openActiveCaseFishboneStage(page);
    await page.getByTestId("pps-mobile-copilot-trigger").click();
    await expect(page.getByTestId("pps-lean-ai-dock")).toBeVisible({
      timeout: 15_000,
    });
    await expect(leanAiPanel(page)).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalOverflow(page);
  });

  test("390px fishbone stage has no horizontal overflow with pending proposals", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openActiveCaseFishboneStage(page);
    await page.getByTestId("pps-mobile-copilot-trigger").click();
    await expect(leanAiPanel(page)).toBeVisible({ timeout: 15_000 });
    await fillLeanAiPrompt(
      page,
      "Please propose fishbone cause for the hot-running defect pattern.",
    );
    await sendLeanAiPrompt(page);
    const pendingPanel = page.getByTestId("pps-pending-ai-proposals");
    await expect(pendingPanel.getByTestId("ai-proposal-card")).toBeVisible({
      timeout: 30_000,
    });
    await expectNoHorizontalOverflow(page);
  });

  test("Lean AI copilot can close and reopen from header and mobile FAB", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openActiveCaseFishboneStage(page);
    await page.getByTestId("pps-mobile-copilot-trigger").click();
    await expect(leanAiPanel(page)).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("pps-lean-ai-header-toggle").click();
    await expect(leanAiPanel(page)).toBeHidden();
    await page.getByTestId("pps-mobile-copilot-trigger").click();
    await expect(leanAiPanel(page)).toBeVisible();
    await page.getByTestId("pps-mobile-copilot-close").click();
    await expect(leanAiPanel(page)).toBeHidden();
    await page.getByTestId("pps-lean-ai-header-toggle").click();
    await expect(leanAiPanel(page)).toBeVisible();
  });

  test("accepting a fishbone cause proposal renders under the machine category", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openActiveCaseFishboneStage(page);
    await page.getByTestId("pps-mobile-copilot-trigger").click();
    await expect(leanAiPanel(page)).toBeVisible({ timeout: 15_000 });
    await fillLeanAiPrompt(
      page,
      "Please propose fishbone cause for the hot-running defect pattern.",
    );
    await sendLeanAiPrompt(page);
    const pendingPanel = page.getByTestId("pps-pending-ai-proposals");
    await expect(pendingPanel.getByTestId("ai-proposal-card")).toBeVisible({
      timeout: 30_000,
    });
    await pendingPanel.getByTestId("ai-proposal-accept").click();
    await expect(page.getByText("Proposal accepted.")).toBeVisible({
      timeout: 15_000,
    });
    const machineBucket = page.getByTestId("pps-fishbone-machine");
    await expect(machineBucket.getByText(FISHBONE_CAUSE_LABEL)).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({
      path: "/opt/cursor/artifacts/pps-fishbone-390-after-accept.png",
      fullPage: true,
    });
  });
});
