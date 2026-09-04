import { expect, type Page } from "@playwright/test";

import {
  selectAssessmentScopeAndWaitForEntities,
  selectFirstScopeEntity,
  selectFrameworkVersion,
} from "./maturity-assessment";

export const COOKIEWORKS_FRAMEWORK = {
  name: "CookieWorks Lean Excellence Framework",
  description: "Lean maturity framework for the Bodmin Cookie Factory.",
} as const;

export const COOKIEWORKS_LEVELS = [
  "Reactive",
  "Developing",
  "Defined",
  "Embedded",
  "Excellence",
] as const;

export const COOKIEWORKS_PILLARS = [
  {
    name: "Leadership",
    criteria: [
      "Leaders conduct regular structured Gemba",
      "Leadership standard work is visible and reviewed",
    ],
  },
  {
    name: "People & Capability",
    criteria: [
      "Required skills are defined by role",
      "Development plans address capability gaps",
    ],
  },
  {
    name: "Daily Management",
    criteria: [
      "Daily performance is reviewed against clear measures",
      "Abnormalities generate owned actions",
    ],
  },
  {
    name: "Continuous Improvement",
    criteria: [
      "Improvement opportunities are actively captured",
      "CI activity is linked to measurable outcomes",
    ],
  },
  {
    name: "Problem Solving",
    criteria: [
      "Structured root-cause methods are used",
      "Countermeasures are verified for effectiveness",
    ],
  },
] as const;

export const BODMIN_FACTORY_LABEL = /Bodmin Cookie Factory/i;

export async function createAndPublishCookieWorksFramework(page: Page) {
  await page.goto("/platform/maturity/models");
  await page.getByLabel("Name").fill(COOKIEWORKS_FRAMEWORK.name);
  await page.getByLabel("Description").fill(COOKIEWORKS_FRAMEWORK.description);
  await page.getByRole("button", { name: "Create draft framework" }).click();

  await expect(page.getByTestId("framework-editor")).toBeVisible();

  await page.getByTestId("framework-step-details").click();
  await page.getByLabel("Display name").fill(COOKIEWORKS_FRAMEWORK.name);
  await page.getByLabel("Description").fill(COOKIEWORKS_FRAMEWORK.description);
  await page.getByRole("button", { name: "Save framework details" }).click();

  await page.getByTestId("framework-step-scopes").click();
  await page.getByRole("button", { name: "Save assessment scopes" }).click();

  await page.getByTestId("framework-step-levels").click();
  for (const [index, levelName] of COOKIEWORKS_LEVELS.entries()) {
    await page.locator("#levelNumber").fill(String(index + 1));
    await page.locator("#levelName").fill(levelName);
    await page.getByRole("button", { name: "Add level" }).click();
    await expect(page.getByTestId(`edit-level-${index + 1}`)).toBeVisible();
  }

  await page.getByTestId("framework-step-pillars").click();
  for (const [index, pillar] of COOKIEWORKS_PILLARS.entries()) {
    await page.locator("#pillarName").fill(pillar.name);
    await page.locator("#pillarPosition").fill(String(index + 1));
    await page.getByRole("button", { name: "Add pillar" }).click();
    await expect(page.getByTestId(`edit-pillar-${index + 1}`)).toBeVisible();
  }

  await page.getByTestId("framework-step-criteria").click();
  for (const pillar of COOKIEWORKS_PILLARS) {
    for (const [index, criterionName] of pillar.criteria.entries()) {
      await page.locator("#pillarId").selectOption({ label: pillar.name });
      await page.locator("#criterionName").fill(criterionName);
      await page.locator("#criterionPosition").fill(String(index + 1));
      await page.getByRole("button", { name: "Add criterion" }).click();
      await expect(
        page
          .locator(
            '[data-testid^="edit-criterion-"] input[aria-label="Criterion name"]',
          )
          .last(),
      ).toHaveValue(criterionName, { timeout: 15_000 });
    }
  }
  await expect(
    page.locator('[data-testid^="edit-criterion-"]').first(),
  ).toBeVisible();

  await page.getByTestId("framework-step-questions").click();
  let linkedQuestionCount = 0;
  const questionPositionByPillar = new Map<string, number>();
  for (const pillar of COOKIEWORKS_PILLARS) {
    for (const criterionName of pillar.criteria) {
      const questionPosition =
        (questionPositionByPillar.get(pillar.name) ?? 0) + 1;
      questionPositionByPillar.set(pillar.name, questionPosition);

      await expect
        .poll(async () =>
          page
            .locator("#criterionId option")
            .filter({ hasText: criterionName })
            .count(),
        )
        .toBeGreaterThan(0);
      await page.locator("#criterionId").selectOption({ label: criterionName });
      await page.locator("#questionPrompt").fill(`Rate: ${criterionName}`);
      await page.locator("#questionPosition").fill(String(questionPosition));
      await page.getByRole("button", { name: "Add scored question" }).click();
      linkedQuestionCount += 1;
      await expect(page.locator('[data-testid^="edit-question-"]')).toHaveCount(
        linkedQuestionCount,
        { timeout: 15_000 },
      );
    }
  }

  await page.getByTestId("framework-step-publish").click();
  await page.getByTestId("publish-framework").click();
  await expect(page.getByText("Active version")).toBeVisible({
    timeout: 15_000,
  });
}

export async function startFormalAssessmentForBodmin(
  page: Page,
  frameworkLabel: string | RegExp = COOKIEWORKS_FRAMEWORK.name,
) {
  await page.goto("/platform/maturity/assessments/new");
  await selectFrameworkVersion(page, { label: frameworkLabel });
  await selectAssessmentScopeAndWaitForEntities(page, "site", {
    expectedEntityName: BODMIN_FACTORY_LABEL,
  });
  await selectFirstScopeEntity(page);
  await page.getByLabel("Assessment type").selectOption("formal");
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page).toHaveURL(
    /\/platform\/maturity\/assessments\/[0-9a-f-]{36}/,
  );
  return page.url();
}

export async function answerAllAssessmentCriteria(page: Page, score = 3) {
  const nextButton = page.getByRole("button", { name: "Next", exact: true });

  while (await nextButton.isEnabled()) {
    const scoreInput = page.locator('input[type="number"]').first();
    if (await scoreInput.isVisible()) {
      await scoreInput.click();
      await scoreInput.pressSequentially(String(score));
      await scoreInput.blur();
      await expect(page.getByText("Saving…")).not.toBeVisible({
        timeout: 10_000,
      });
    }
    await nextButton.click();
  }

  const scoreInput = page.locator('input[type="number"]').first();
  if (await scoreInput.isVisible()) {
    await scoreInput.click();
    await scoreInput.pressSequentially(String(score));
    await scoreInput.blur();
    await expect(page.getByText("Saving…")).not.toBeVisible({
      timeout: 10_000,
    });
  }
}

export async function uploadEvidenceFile(page: Page, filePath: string) {
  await page.getByTestId("evidence-file-input").setInputFiles(filePath);
  await expect(page.getByText("Evidence attached")).toBeVisible({
    timeout: 20_000,
  });
}

export async function openLatestFormalAssessment(page: Page) {
  await page.goto("/platform/maturity/assessments");
  await page
    .locator("a")
    .filter({ hasText: "formal assessment" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/platform\/maturity\/assessments\//);
}
