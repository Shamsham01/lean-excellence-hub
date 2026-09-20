import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_CI_PROJECTS,
  DEMO_PLATFORM_SAMPLES,
  DEMO_PROBLEM_SOLVING_CASE,
} from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  selectAssessmentScopeAndWaitForEntities,
  selectFirstScopeEntity,
  selectFrameworkVersion,
} from "./helpers/maturity-assessment";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const uniqueSuffix = Date.now().toString(36);
const DEMO_CASE_TITLE = DEMO_PROBLEM_SOLVING_CASE.title;
const DEMO_FRAMEWORK_NAME = DEMO_PLATFORM_SAMPLES.maturityFrameworkName;
const DEMO_SOURCE_PROJECT_TITLE = DEMO_CI_PROJECTS[1].title;
const CORNWALL_PLANT_LABEL = /Cornwall Plant/i;

async function openProblemSolvingHub(page: Page) {
  await page.goto("/platform/problem-solving");
  await expect(
    page.getByTestId("problem-solving-portfolio-page"),
  ).toBeVisible();
}

async function openMaturityHub(page: Page) {
  await page.goto("/platform/maturity");
  await expect(page.getByTestId("maturity-overview-page")).toBeVisible();
}

async function clickWizardNext(page: Page) {
  await page
    .getByTestId("create-problem-solving-wizard")
    .getByRole("button", { name: "Next", exact: true })
    .click();
}

test.describe("NAV-CLICK-001 Problem Solving and Maturity navigation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("problem solving hub New case, portfolio row, Back, and source project navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openProblemSolvingHub(page);

    const newCase = page.getByTestId("problem-solving-new-link");
    await expect(newCase).toHaveAttribute(
      "href",
      "/platform/problem-solving/new",
    );
    await newCase.click();
    await expect(page).toHaveURL(/\/platform\/problem-solving\/new(?:\?|$)/);
    await expect(page.getByTestId("create-problem-solving-page")).toBeVisible();
    await expect(
      page.getByTestId("create-problem-solving-wizard"),
    ).toBeVisible();

    await openProblemSolvingHub(page);
    const caseRow = page
      .getByRole("link", { name: new RegExp(DEMO_CASE_TITLE) })
      .first();
    await expect(caseRow).toBeVisible();
    const caseHref = await caseRow.getAttribute("href");
    expect(caseHref).toMatch(/\/platform\/problem-solving\/[0-9a-f-]{36}$/);
    await caseRow.click();
    await expect(page).toHaveURL(new RegExp(`${caseHref}$`));
    await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible();
    await expect(page.getByTestId("problem-solving-workspace")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_CASE_TITLE }),
    ).toBeVisible();

    await page.getByTestId("tab-overview").click();
    const sourceLink = page
      .getByTestId(/^problem-solving-source-link-/)
      .first();
    await expect(sourceLink).toBeVisible();
    const projectHref = await sourceLink.getAttribute("href");
    expect(projectHref).toMatch(/\/platform\/projects\/[0-9a-f-]{36}$/);
    expect(await sourceLink.innerText()).not.toContain(
      DEMO_SOURCE_PROJECT_TITLE,
    );
    await sourceLink.click();
    await expect(page).toHaveURL(new RegExp(`${projectHref}$`));
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_SOURCE_PROJECT_TITLE }),
    ).toBeVisible();

    await page.goto(caseHref ?? "/platform/problem-solving");
    await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible();
    const back = page.getByTestId("problem-solving-back-link");
    await expect(back).toHaveAttribute("href", "/platform/problem-solving");
    await back.click();
    await expect(page).toHaveURL(/\/platform\/problem-solving(?:\?|$)/);
    await expect(
      page.getByTestId("problem-solving-portfolio-page"),
    ).toBeVisible();
  });

  test("keyboard Enter on New case navigates", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await openProblemSolvingHub(page);

    const newCase = page.getByTestId("problem-solving-new-link");
    await newCase.focus();
    await expect(newCase).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/platform\/problem-solving\/new(?:\?|$)/);
    await expect(page.getByTestId("create-problem-solving-page")).toBeVisible();
  });

  test("modified click on Assessments keeps the current document", async ({
    page,
    context,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openMaturityHub(page);
    const currentUrl = page.url();

    const popupPromise = context.waitForEvent("page");
    await page.getByTestId("maturity-assessments-link").click({
      modifiers: ["ControlOrMeta"],
    });
    const popup = await popupPromise;
    await popup.waitForURL(/\/platform\/maturity\/assessments/);
    await expect(page).toHaveURL(currentUrl);
    await expect(popup.getByTestId("maturity-assessments-page")).toBeVisible();
    await popup.close();
  });

  test("maturity hub Assessments, Framework, model/detail Back, assessment list/detail, and official result Back navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openMaturityHub(page);

    const assessments = page.getByTestId("maturity-assessments-link");
    await expect(assessments).toHaveAttribute(
      "href",
      "/platform/maturity/assessments",
    );
    await assessments.click();
    await expect(page).toHaveURL(/\/platform\/maturity\/assessments(?:\?|$)/);
    await expect(page.getByTestId("maturity-assessments-page")).toBeVisible();

    await openMaturityHub(page);
    const framework = page.getByTestId("maturity-framework-link");
    await expect(framework).toHaveAttribute(
      "href",
      "/platform/maturity/models",
    );
    await framework.click();
    await expect(page).toHaveURL(/\/platform\/maturity\/models(?:\?|$)/);
    await expect(page.getByTestId("maturity-models-page")).toBeVisible();

    const model = page.getByRole("link", {
      name: DEMO_FRAMEWORK_NAME,
      exact: true,
    });
    await expect(model).toBeVisible();
    const modelHref = await model.getAttribute("href");
    expect(modelHref).toMatch(/\/platform\/maturity\/models\/[0-9a-f-]{36}$/);
    await model.click();
    await expect(page).toHaveURL(new RegExp(`${modelHref}$`));
    await expect(page.getByTestId("maturity-model-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_FRAMEWORK_NAME }),
    ).toBeVisible();

    const modelBack = page.getByTestId("maturity-model-back-link");
    await expect(modelBack).toHaveAttribute(
      "href",
      "/platform/maturity/models",
    );
    await modelBack.click();
    await expect(page).toHaveURL(/\/platform\/maturity\/models(?:\?|$)/);
    await expect(page.getByTestId("maturity-models-page")).toBeVisible();

    await page.goto("/platform/maturity/assessments");
    await expect(page.getByTestId("maturity-assessments-page")).toBeVisible();
    const assessmentRow = page
      .getByTestId(/^maturity-assessment-item-/)
      .first();
    await expect(assessmentRow).toBeVisible();
    const assessmentHref = await assessmentRow.getAttribute("href");
    expect(assessmentHref).toMatch(
      /\/platform\/maturity\/assessments\/[0-9a-f-]{36}$/,
    );
    await assessmentRow.click();
    await expect(page).toHaveURL(new RegExp(`${assessmentHref}$`));
    await expect(
      page.getByTestId("maturity-assessment-detail-page"),
    ).toBeVisible();

    const assessmentsBack = page.getByTestId("maturity-assessments-back-link");
    await expect(assessmentsBack).toHaveAttribute(
      "href",
      "/platform/maturity/assessments",
    );
    await assessmentsBack.click();
    await expect(page).toHaveURL(/\/platform\/maturity\/assessments(?:\?|$)/);
    await expect(page.getByTestId("maturity-assessments-page")).toBeVisible();

    await openMaturityHub(page);
    const officialResult = page.getByTestId("maturity-latest-result-link");
    await expect(officialResult).toBeVisible();
    const resultHref = await officialResult.getAttribute("href");
    expect(resultHref).toMatch(/\/platform\/maturity\/results\/[0-9a-f-]{36}$/);
    await officialResult.click();
    await expect(page).toHaveURL(new RegExp(`${resultHref}$`));
    await expect(page.getByTestId("maturity-result-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Official maturity result" }),
    ).toBeVisible();

    const resultBack = page.getByTestId("maturity-result-back-link");
    await expect(resultBack).toHaveAttribute("href", "/platform/maturity");
    await resultBack.click();
    await expect(page).toHaveURL(/\/platform\/maturity(?:\?|$)/);
    await expect(page.getByTestId("maturity-overview-page")).toBeVisible();
  });

  test("create case wizard opens the new workspace without a router race", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving/new");
    await expect(
      page.getByTestId("create-problem-solving-wizard"),
    ).toBeVisible();

    const caseTitle = `NAV-CLICK case ${uniqueSuffix}`;
    await page.getByTestId("create-case-title").fill(caseTitle);
    await page.getByTestId("case-unit-select").selectOption({ index: 1 });
    await page.getByTestId("create-case-owner").selectOption({ index: 1 });
    await clickWizardNext(page);
    await clickWizardNext(page);
    await clickWizardNext(page);
    await clickWizardNext(page);
    await clickWizardNext(page);

    await page.getByTestId("create-case-submit").click();
    await expect(page).toHaveURL(/\/platform\/problem-solving\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: caseTitle })).toBeVisible();
  });

  test("start assessment opens the new workspace without a router race", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/maturity/assessments/new");
    await expect(page.getByTestId("start-assessment-page")).toBeVisible();
    await expect(page.getByTestId("start-assessment-form")).toBeVisible();

    await selectFrameworkVersion(page);
    await selectAssessmentScopeAndWaitForEntities(page, "site", {
      expectedEntityName: CORNWALL_PLANT_LABEL,
    });
    await selectFirstScopeEntity(page);
    await page.getByLabel("Assessment type").selectOption("formal");
    await page.getByRole("button", { name: "Start assessment" }).click();
    await expect(page).toHaveURL(
      /\/platform\/maturity\/assessments\/[0-9a-f-]{36}/,
    );
    await expect(
      page.getByTestId("maturity-assessment-detail-page"),
    ).toBeVisible();
  });
});
