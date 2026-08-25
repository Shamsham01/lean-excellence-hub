import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function loginAs(page: Page, user: keyof typeof DEMO_USERS) {
  const credentials = DEMO_USERS[user];
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
  await expect(
    page.getByRole("main").getByText(DEMO_ORGANISATION.name),
  ).toBeVisible();
}

async function selectFirstEnabledOption(page: Page, selectId: string) {
  const value = await page
    .locator(`#${selectId} option:not([disabled])`)
    .first()
    .getAttribute("value");
  if (!value) {
    throw new Error(`No selectable option found for #${selectId}`);
  }
  await page.locator(`#${selectId}`).selectOption(value);
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

    await page.getByTestId("framework-step-levels").click();
    await page.getByLabel("Level name").fill("Initial");
    await page.getByRole("button", { name: "Add level" }).click();
    await expect(page.getByText("1. Initial")).toBeVisible();

    await page.getByTestId("framework-step-pillars").click();
    await page.getByLabel("Pillar name").fill("Leadership");
    await page.getByRole("button", { name: "Add pillar" }).click();
    await expect(page.getByText("1. Leadership")).toBeVisible();

    await page.getByTestId("framework-step-criteria").click();
    await page.getByLabel("Criterion name").fill("Gemba walks");
    await page.getByRole("button", { name: "Add criterion" }).click();
    await expect(page.getByText("Gemba walks")).toBeVisible();

    await page.getByTestId("framework-step-questions").click();
    await page.getByLabel("Question prompt").fill("Rate Gemba walks");
    await page.getByRole("button", { name: "Add scored question" }).click();
    await expect(page.getByText("Rate Gemba walks")).toBeVisible();

    await page.getByTestId("framework-step-publish").click();
    await page.getByTestId("publish-framework").click();
    await expect(page.getByText("Published version")).toBeVisible();
  });

  test("formal assessor: start → answer → evidence → action → submit", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/maturity/models");
    await page
      .getByRole("link", { name: "E2E Closure Framework" })
      .first()
      .click();
    await page.getByRole("link", { name: "Start assessment" }).click();
    await selectFirstEnabledOption(page, "unitId");
    await page.getByLabel("Assessment type").selectOption("formal");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/platform\/maturity\/assessments\//);

    const scoreInput = page.locator('input[type="number"]').first();
    await scoreInput.fill("4");

    const evidenceFile = join(tmpdir(), `e2e-evidence-${Date.now()}.txt`);
    writeFileSync(evidenceFile, "E2E maturity evidence sample");
    await page.getByTestId("evidence-file-input").setInputFiles(evidenceFile);
    await expect(page.getByText("Evidence attached")).toBeVisible({
      timeout: 15000,
    });

    await page.getByLabel("Create action").fill("Improve Gemba cadence");
    await page.getByRole("button", { name: "Create action" }).click();

    await page.getByTestId("submit-assessment").click();
    await expect(page.getByText("Submitted")).toBeVisible();
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
    await expect(page.getByText("Published").first()).toBeVisible();
  });

  test("self assessor: complete self assessment without official result", async ({
    page,
  }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/maturity/assessments/new");
    const e2eVersionValue = await page
      .locator("#modelVersionId option")
      .filter({ hasText: "E2E Closure Framework" })
      .first()
      .getAttribute("value");
    if (!e2eVersionValue) {
      throw new Error("E2E Closure Framework version not found");
    }
    await page.locator("#modelVersionId").selectOption(e2eVersionValue);
    await selectFirstEnabledOption(page, "unitId");
    await page.getByLabel("Assessment type").selectOption("self");
    await page.getByRole("button", { name: "Start" }).click();

    const scoreInput = page.locator('input[type="number"]').first();
    await scoreInput.fill("3");
    await expect(page.getByText("Saving")).not.toBeVisible({ timeout: 10000 });

    await page.getByTestId("complete-self-assessment").click();
    await expect(page.getByText("Completed").first()).toBeVisible();
    await expect(page.getByTestId("publish-official-result")).toHaveCount(0);
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
