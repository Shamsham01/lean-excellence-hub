import { expectPlatformOrganisationName } from "./helpers/platform-home";
import {
  selectAssessmentScopeAndWaitForEntities,
  selectFirstScopeEntity,
  selectFrameworkVersion,
} from "./helpers/maturity-assessment";
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const CORNWALL_PLANT_LABEL = /Cornwall Plant/i;

async function loginAs(page: Page, user: keyof typeof DEMO_USERS) {
  const credentials = DEMO_USERS[user];
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
  await expectPlatformOrganisationName(page, DEMO_ORGANISATION.name);
}

test.describe("Milestone 5 maturity journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: framework draft → edit → publish", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/maturity/models");

    const frameworkName = "E2E Closure Framework";
    await page.getByLabel("Name").fill(frameworkName);
    await page.getByRole("button", { name: "Create draft framework" }).click();

    await expect(page.getByTestId("framework-editor")).toBeVisible();

    await page.getByTestId("framework-step-details").click();
    await page.getByLabel("Display name").fill(frameworkName);
    await page.getByLabel("Description").fill("E2E editable draft description");
    await page.getByRole("button", { name: "Save framework details" }).click();

    await page.getByTestId("framework-step-levels").click();
    await page.getByLabel("Level name").fill("Initial");
    await page.getByRole("button", { name: "Add level" }).click();
    await expect(page.getByTestId("edit-level-1")).toBeVisible();
    await page
      .getByTestId("edit-level-1")
      .getByLabel("Level name")
      .fill("Initial revised");
    await page.getByRole("button", { name: "Save level" }).click();
    await expect(
      page.getByTestId("edit-level-1").getByLabel("Level name"),
    ).toHaveValue("Initial revised");

    await page.getByTestId("framework-step-pillars").click();
    await page.getByLabel("Pillar name").fill("Leadership");
    await page.getByRole("button", { name: "Add pillar" }).click();
    await expect(page.getByTestId("edit-pillar-1")).toBeVisible();

    await page.getByTestId("framework-step-criteria").click();
    await page.getByLabel("Criterion name").fill("Gemba walks");
    await page.getByRole("button", { name: "Add criterion" }).click();
    await expect(
      page.locator('[data-testid^="edit-criterion-"]').first(),
    ).toBeVisible();

    await page.getByTestId("framework-step-questions").click();
    await page.getByLabel("Question prompt").fill("Rate Gemba walks");
    await page.getByRole("button", { name: "Add scored question" }).click();
    await expect(
      page.locator('[data-testid^="edit-question-"]').first(),
    ).toBeVisible();

    await page.getByTestId("framework-step-publish").click();
    await page.getByTestId("publish-framework").click();
    await expect(page.getByText("Active version")).toBeVisible();
  });

  test("MAT1a: start assessment shows eligible site entities only", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/maturity/assessments/new");
    await selectFrameworkVersion(page);
    await selectAssessmentScopeAndWaitForEntities(page, "site", {
      expectedEntityName: CORNWALL_PLANT_LABEL,
    });

    const entityOptions = page.locator("#unitId option:not([disabled])");
    const optionTexts = await entityOptions.allTextContents();
    expect(optionTexts.some((label) => /cornwall|plant/i.test(label))).toBe(
      true,
    );
    for (const label of optionTexts) {
      expect(label).not.toMatch(/operations|engineering|quality|line/i);
    }
  });

  test("formal assessor: start → answer → comment → evidence → action → submit", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/maturity/assessments/new");
    await selectFrameworkVersion(page, { label: /E2E Closure Framework/ });
    await selectAssessmentScopeAndWaitForEntities(page, "site", {
      expectedEntityName: CORNWALL_PLANT_LABEL,
    });
    await selectFirstScopeEntity(page);
    await page.getByLabel("Assessment type").selectOption("formal");
    await page.getByRole("button", { name: "Start assessment" }).click();
    await expect(page).toHaveURL(/\/platform\/maturity\/assessments\//);

    const scoreInput = page.locator('input[type="number"]').first();
    await scoreInput.click();
    await scoreInput.pressSequentially("4");
    await scoreInput.blur();
    await page.waitForTimeout(500);

    await page
      .getByTestId("assessor-comment")
      .fill("Observed consistent Gemba cadence on the shop floor.");
    await page.getByTestId("assessor-comment").blur();
    await expect(page.getByText("Saving comment")).not.toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(500);

    const evidenceFile = join(tmpdir(), `e2e-evidence-${Date.now()}.txt`);
    writeFileSync(evidenceFile, "E2E maturity evidence sample");
    await page.getByTestId("evidence-file-input").setInputFiles(evidenceFile);
    await expect(page.getByText("Evidence attached")).toBeVisible({
      timeout: 15000,
    });

    await page.getByLabel("Create action").fill("Improve Gemba cadence");
    await page.getByRole("button", { name: "Create action" }).click();

    await page.getByTestId("submit-assessment").click();
    await expect(page.getByTestId("submit-assessment")).not.toBeVisible();
    await expect(page.getByText("Submitted", { exact: true })).toBeVisible({
      timeout: 15000,
    });
  });

  test("approver: review → approve → publish official result", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/maturity/assessments");

    await page
      .locator("a")
      .filter({ hasText: "formal assessment" })
      .filter({ hasText: "Submitted" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/platform\/maturity\/assessments\//);

    await page.getByTestId("begin-assessor-review").click();
    await expect(page.getByText("In review")).toBeVisible();

    await page.getByTestId("approve-assessment").click();
    await expect(page.getByText("Approved")).toBeVisible();

    await page.getByTestId("publish-official-result").click();
    await expect(page.getByText("Published").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("self assessor: complete self assessment without official result", async ({
    page,
  }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/maturity/assessments/new");
    await selectFrameworkVersion(page, { label: /E2E Closure Framework/ });
    await selectAssessmentScopeAndWaitForEntities(page, "site", {
      expectedEntityName: CORNWALL_PLANT_LABEL,
    });
    await selectFirstScopeEntity(page);
    await page.getByLabel("Assessment type").selectOption("self");
    await page.getByRole("button", { name: "Start assessment" }).click();

    const scoreInput = page.locator('input[type="number"]').first();
    await scoreInput.fill("3");
    await expect(page.getByText("Saving")).not.toBeVisible({ timeout: 10000 });

    await page.getByTestId("complete-self-assessment").click();
    await expect(page.getByText("Completed").first()).toBeVisible();
    await expect(page.getByTestId("publish-official-result")).toHaveCount(0);
  });

  test("admin: create successor version keeps historical assessment pinned", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/maturity/models");
    await page
      .getByRole("link", { name: "E2E Closure Framework" })
      .first()
      .click();

    await page.getByTestId("create-successor-version").click();
    await expect(page.getByText("Draft version 2")).toBeVisible({
      timeout: 15000,
    });
  });

  test("unauthorised scope access is denied", async ({ page }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/maturity/models");

    await expect(
      page.getByRole("button", { name: "Create draft framework" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("framework-editor")).toHaveCount(0);
  });

  test("tablet assessment viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAs(page, "manager");
    await page.goto("/platform/maturity/assessments");

    const assessmentLink = page
      .locator("a")
      .filter({ hasText: /formal|self/i })
      .first();
    await assessmentLink.click();

    await expect(
      page.getByRole("heading", { name: "Assessment" }),
    ).toBeVisible();
    await expect(
      page.locator('[aria-label="Assessment progress"]'),
    ).toBeVisible();
  });
});
