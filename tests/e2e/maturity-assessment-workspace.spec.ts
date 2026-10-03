import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  answerVisibleScore,
  selectAssessmentScopeAndWaitForEntities,
  selectAssessmentType,
  selectFirstScopeEntity,
  selectFrameworkVersion,
} from "./helpers/maturity-assessment";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const FRAMEWORK_NAME = "E2E Readiness Framework";
const CORNWALL_PLANT_LABEL = /Cornwall Plant/i;
const jpegPath = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../fixtures/maturity-evidence/sample.jpg",
);

async function screenshotIfPossible(page: Page, name: string) {
  try {
    await page.screenshot({
      path: `/opt/cursor/artifacts/${name}`,
      fullPage: true,
    });
  } catch {
    // Artifact directory is optional outside Cloud Agent runs.
  }
}

async function createReadinessFramework(page: Page) {
  await page.goto("/platform/maturity/models");
  await page.getByLabel("Name").fill(FRAMEWORK_NAME);
  await page.getByRole("button", { name: "Create draft framework" }).click();
  await expect(page.getByTestId("framework-editor")).toBeVisible({
    timeout: 15_000,
  });

  await page.getByTestId("framework-step-levels").click();
  for (const [index, name] of [
    "Initial",
    "Developing",
    "Established",
  ].entries()) {
    await page.locator("#levelName").fill(name);
    await page.getByRole("button", { name: "Add level" }).click();
    await expect(page.getByTestId(`edit-level-${index + 1}`)).toBeVisible({
      timeout: 15_000,
    });
  }

  await page.getByTestId("framework-step-pillars").click();
  await page.getByLabel("Pillar name").fill("Leadership & Governance");
  await page.getByRole("button", { name: "Add pillar" }).click();
  await expect(page.getByTestId("edit-pillar-1")).toBeVisible({
    timeout: 15_000,
  });

  await page.getByTestId("framework-step-criteria").click();
  for (const name of [
    "Clear Roles & Responsibilities",
    "Decision-Making & Accountability",
    "Strategy & Priorities",
  ]) {
    const before = await page
      .locator('[data-testid^="edit-criterion-"]')
      .count();
    await page.locator("#criterionName").fill(name);
    await page.getByRole("button", { name: "Add criterion" }).click();
    await expect(page.locator('[data-testid^="edit-criterion-"]')).toHaveCount(
      before + 1,
      { timeout: 15_000 },
    );
  }

  await page.getByTestId("framework-step-questions").click();
  for (const name of [
    "Clear Roles & Responsibilities",
    "Decision-Making & Accountability",
    "Strategy & Priorities",
  ]) {
    await expect
      .poll(async () =>
        page.locator("#criterionId option").filter({ hasText: name }).count(),
      )
      .toBeGreaterThan(0);
    await page.locator("#criterionId").selectOption({ label: name });
    await page.locator("#questionPrompt").fill(`Rate: ${name}`);
    const before = await page
      .locator('[data-testid^="edit-question-"]')
      .count();
    await page.getByRole("button", { name: "Add scored question" }).click();
    await expect(page.locator('[data-testid^="edit-question-"]')).toHaveCount(
      before + 1,
      { timeout: 15_000 },
    );
  }
  await expect(page.locator('[data-testid^="edit-question-"]')).toHaveCount(3, {
    timeout: 15_000,
  });

  await page.getByTestId("framework-step-publish").click();
  await page.getByTestId("publish-framework").click();
  await expect(page.getByTestId("framework-editor")).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function startAssessment(page: Page, type: "self" | "formal") {
  await page.goto("/platform/maturity/assessments/new");
  await selectFrameworkVersion(page, { label: FRAMEWORK_NAME });
  await selectAssessmentScopeAndWaitForEntities(page, "site", {
    expectedEntityName: CORNWALL_PLANT_LABEL,
  });
  await selectFirstScopeEntity(page);
  await selectAssessmentType(page, type);
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.getByTestId("maturity-assessment-detail-page")).toBeVisible(
    {
      timeout: 15_000,
    },
  );
}

test.describe("Maturity assessment readiness and mobile workspace", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin publishes a 3-question readiness framework", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await createReadinessFramework(page);
  });

  test("incomplete self assessment shows friendly remaining UX without crashing", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "operator");
    await startAssessment(page, "self");

    await expect(page.getByTestId("assessment-completion-count")).toContainText(
      "0 / 3 required responses",
    );
    await expect(page.getByTestId("remaining-required-count")).toHaveText(
      "3 required responses remaining",
    );
    await expect(page.getByTestId("complete-self-assessment")).toHaveCount(0);
    await page.getByTestId("review-missing-responses").click();
    await expect(page.getByTestId("assessment-readiness-panel")).toBeVisible();
    await expect(page.getByTestId("assessment-readiness-panel")).toContainText(
      "3 required responses remaining",
    );

    await screenshotIfPossible(page, "maturity-incomplete-readiness.png");

    await page.getByTestId("go-to-first-missing").click();
    await expect(
      page.getByText("Clear Roles & Responsibilities").first(),
    ).toBeVisible();
    await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);
    await expect(
      page.getByTestId("maturity-assessment-detail-page"),
    ).toBeVisible();
  });

  test("incomplete formal submit uses the same readiness UX", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await startAssessment(page, "formal");

    await expect(page.getByTestId("submit-assessment")).toHaveCount(0);
    await expect(page.getByTestId("review-missing-responses")).toBeVisible();
    await page.getByTestId("review-missing-responses").click();
    await expect(page.getByTestId("assessment-readiness-panel")).toBeVisible();
    await page.getByTestId("go-to-first-missing").click();
    await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);
    await expect(
      page.getByTestId("maturity-assessment-detail-page"),
    ).toBeVisible();
  });

  test("mobile JPEG evidence stays on the current criterion without workspace crash", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "operator");
    await startAssessment(page, "self");

    const firstCriterion = await page
      .getByTestId("assessment-criterion-position")
      .innerText();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByTestId("assessment-criterion-position"),
    ).not.toHaveText(firstCriterion);
    const activeCriterion = await page
      .getByTestId("assessment-criterion-position")
      .innerText();

    await answerVisibleScore(page, 2);
    await page.getByTestId("question-comment").fill("Photo evidence follows.");
    await page.getByTestId("question-comment").blur();
    await expect(page.getByText("Saving…")).not.toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("evidence-file-input").setInputFiles(jpegPath);
    await expect(page.getByText("Evidence attached")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("evidence-gallery")).toBeVisible();
    await expect(page.getByRole("img", { name: /sample\.jpg/i })).toBeVisible();
    await expect(page.getByTestId("assessment-criterion-position")).toHaveText(
      activeCriterion,
    );
    await expect(
      page.getByTestId("maturity-assessment-detail-page"),
    ).toBeVisible();
    await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);

    await screenshotIfPossible(page, "maturity-mobile-question-evidence.png");

    await page.getByTestId("criteria-drawer-open").click();
    await expect(page.getByTestId("criteria-drawer")).toBeVisible();
    await screenshotIfPossible(page, "maturity-mobile-criteria-drawer.png");
    await page.keyboard.press("Escape");

    await screenshotIfPossible(page, "maturity-mobile-criterion-workflow.png");

    await page.reload();
    await expect(
      page.getByTestId("maturity-assessment-detail-page"),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("evidence-gallery")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("img", { name: /sample\.jpg/i })).toBeVisible();
    await expect(page.getByTestId("question-comment")).toHaveValue(
      "Photo evidence follows.",
    );
    await expect(page.getByTestId("assessment-criterion-position")).toHaveText(
      activeCriterion,
    );
    await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);
  });

  test("desktop layout screenshots and completed read-only state", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsDemoUser(page, "operator");
    await startAssessment(page, "self");

    const openPane = page.getByTestId("leanai-assistant-desktop");
    if (await openPane.isVisible().catch(() => false)) {
      await page.getByTestId("leanai-assistant-close").click();
    }
    await expect(page.getByTestId("leanai-assistant-rail")).toBeVisible();
    await screenshotIfPossible(page, "maturity-desktop-leanai-collapsed.png");

    await page.getByTestId("leanai-assistant-open").click();
    await expect(page.getByTestId("leanai-assistant-desktop")).toBeVisible();
    await screenshotIfPossible(page, "maturity-desktop-leanai-open.png");

    while (
      await page.getByRole("button", { name: "Next", exact: true }).isEnabled()
    ) {
      await answerVisibleScore(page, 2);
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await answerVisibleScore(page, 2);
    await expect(page.getByTestId("complete-self-assessment")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("complete-self-assessment").click();
    await expect(page.getByTestId("assessment-readonly-banner")).toBeVisible({
      timeout: 15_000,
    });
    await screenshotIfPossible(page, "maturity-completed-readonly.png");
  });
});
