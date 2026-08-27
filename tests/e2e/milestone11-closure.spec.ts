import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_PROBLEM_SOLVING_CASE,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const uniqueSuffix = Date.now().toString(36);
const liveCaseTitle = `E2E Live PS Case ${uniqueSuffix}`;
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

async function loginAs(page: Page, user: keyof typeof DEMO_USERS) {
  const credentials = DEMO_USERS[user];
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Email sign in" }).click();
  await expect(page).toHaveURL(/\/platform/, { timeout: 15_000 });
  await expect(
    page.getByRole("main").getByText(DEMO_ORGANISATION.name),
  ).toBeVisible();
}

function createCaseWizard(page: Page) {
  return page.getByTestId("create-problem-solving-wizard");
}

async function clickWizardNext(page: Page) {
  await createCaseWizard(page)
    .getByRole("button", { name: "Next", exact: true })
    .click();
}

async function openLiveCase(page: Page) {
  await page.goto("/platform/problem-solving");
  await page.getByRole("link", { name: liveCaseTitle }).click();
  await expect(page.getByTestId("problem-solving-workspace")).toBeVisible();
}

test.describe("Milestone 11 closure", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("manager opens problem solving portfolio with seeded case", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/problem-solving");
    await expect(
      page.getByTestId("problem-solving-portfolio-page"),
    ).toBeVisible();
    await expect(page.getByTestId("problem-solving-portfolio")).toBeVisible();
    await expect(page.getByText(DEMO_PROBLEM_SOLVING_CASE.title)).toBeVisible();
  });

  test("manager completes authenticated problem solving lifecycle on a live case", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/problem-solving/new");

    await page.getByTestId("create-case-title").fill(liveCaseTitle);
    await createCaseWizard(page)
      .getByTestId("create-case-facilitator")
      .selectOption({ index: 1 });
    await clickWizardNext(page);

    await createCaseWizard(page)
      .getByLabel("Problem statement")
      .fill(
        "Intermittent seal defects exceed the acceptable quality threshold.",
      );
    await clickWizardNext(page);

    await createCaseWizard(page)
      .getByLabel("Scope in")
      .fill("Packaging Line 3 sealing station");
    await clickWizardNext(page);
    await clickWizardNext(page);
    await clickWizardNext(page);
    await createCaseWizard(page)
      .getByRole("button", { name: "Create draft case" })
      .click();

    await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("activate-method-select").selectOption({ index: 0 });
    await page.getByTestId("problem-solving-activate-button").click();
    await expect(
      page
        .getByTestId("problem-solving-header")
        .getByText("Active", { exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("tab-current-condition").click();
    await page
      .getByTestId("current-condition-category")
      .selectOption("measured_fact");
    await page
      .getByTestId("current-condition-statement")
      .fill("Defect rate measured at 180 ppm across three consecutive runs.");
    await page.getByRole("button", { name: "Add item" }).click();
    const currentConditionPanel = page.getByTestId(
      "problem-solving-current-condition-panel",
    );
    await expect(
      currentConditionPanel
        .locator('[data-testid^="current-condition-item-"]')
        .filter({ hasText: "Measured fact" }),
    ).toBeVisible();
    await expect(
      page.getByText("Defect rate measured at 180 ppm"),
    ).toBeVisible();

    await page
      .getByTestId("current-condition-category")
      .selectOption("assumption");
    await page
      .getByTestId("current-condition-statement")
      .fill(
        "Operators may be rushing changeover because the line is behind schedule.",
      );
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(
      currentConditionPanel
        .locator('[data-testid^="current-condition-item-"]')
        .filter({ hasText: "Assumption" }),
    ).toBeVisible();

    await page.getByTestId("tab-containment").click();
    await page
      .getByTestId("containment-description")
      .fill("Increase in-process seal inspection after splice events.");
    await page.getByRole("button", { name: "Create containment" }).click();
    const containmentItem = page
      .locator('[data-testid^="containment-item-"]')
      .first();
    await expect(
      containmentItem.getByText("Increase in-process seal inspection"),
    ).toBeVisible();
    await containmentItem
      .getByTestId(/^containment-action-title-/)
      .fill("Hold packs after splice until seal check passes");
    await containmentItem.getByTestId(/^link-containment-action-/).click();
    await expect(
      page.getByTestId("problem-solving-containment-panel"),
    ).toContainText("Containment action linked", { timeout: 15_000 });
    await page.getByTestId("tab-verification").click();
    await expect(
      page.locator('[data-testid^="related-action-"]').filter({
        hasText: "Hold packs after splice until seal check passes",
      }),
    ).toBeVisible();
    await page.getByTestId("tab-containment").click();
    await expect(
      containmentItem.getByText("Increase in-process seal inspection"),
    ).toBeVisible();

    await page.getByTestId("tab-cause-analysis").click();
    await page
      .getByTestId("analysis-title")
      .fill("Line 3 seal defect fishbone");
    await page.getByTestId("analysis-node-label").fill("Machine");
    await page.getByTestId("create-analysis-button").click();
    await expect(page.getByTestId("analysis-artifact")).toBeVisible({
      timeout: 15_000,
    });

    const supportedStatement =
      "Sealing jaw pressure varies outside the validated setup window.";
    const refutedStatement =
      "Film tension drift during run causes inconsistent seal bead formation.";

    await page.getByTestId("hypothesis-statement").fill(supportedStatement);
    await page.getByRole("button", { name: "Add hypothesis" }).click();
    await expect(
      page
        .locator('[data-testid^="hypothesis-item-"]')
        .filter({ hasText: supportedStatement }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("hypothesis-statement").fill(refutedStatement);
    await page.getByRole("button", { name: "Add hypothesis" }).click();
    await expect(
      page
        .locator('[data-testid^="hypothesis-item-"]')
        .filter({ hasText: refutedStatement }),
    ).toBeVisible({ timeout: 15_000 });

    const supportedItem = page
      .locator('[data-testid^="hypothesis-item-"]')
      .filter({ hasText: supportedStatement });
    const refutedItem = page
      .locator('[data-testid^="hypothesis-item-"]')
      .filter({ hasText: refutedStatement });

    await supportedItem.getByRole("button", { name: "Start testing" }).click();
    await refutedItem.getByRole("button", { name: "Start testing" }).click();

    await supportedItem
      .getByTestId(/^hypothesis-test-question-/)
      .fill(
        "Does sealing jaw pressure remain within validated limits across a full run?",
      );
    await supportedItem
      .getByTestId(/^hypothesis-test-expected-/)
      .fill("Pressure remains within +/- 5% of setup target.");
    await supportedItem.getByTestId(/^create-hypothesis-test-/).click();
    await supportedItem
      .getByTestId(/^hypothesis-test-actual-/)
      .fill(
        "Pressure dropped below validated minimum three times after splice events.",
      );
    await supportedItem
      .getByTestId(/^hypothesis-test-conclusion-/)
      .selectOption("supports");
    await supportedItem.getByTestId(/^complete-hypothesis-test-/).click();
    await expect(supportedItem.getByText("Supports")).toBeVisible();
    await expect(supportedItem.getByText("Supported")).toBeVisible();

    await refutedItem
      .getByTestId(/^hypothesis-test-question-/)
      .fill("Does film tension correlate with seal defect timing?");
    await refutedItem
      .getByTestId(/^hypothesis-test-expected-/)
      .fill("Defects increase when tension drifts high.");
    await refutedItem.getByTestId(/^create-hypothesis-test-/).click();
    await refutedItem
      .getByTestId(/^hypothesis-test-actual-/)
      .fill("Tension remained stable during defect clusters.");
    await refutedItem
      .getByTestId(/^hypothesis-test-conclusion-/)
      .selectOption("refutes");
    await refutedItem.getByTestId(/^complete-hypothesis-test-/).click();
    await refutedItem.getByTestId(/^reject-hypothesis-/).click();
    await expect(refutedItem.getByText("Rejected")).toBeVisible();

    await supportedItem.getByTestId(/^verify-cause-/).click();
    await page
      .getByTestId("verify-cause-rationale")
      .fill(
        "Pressure trace test supports mechanical instability as the verified cause.",
      );
    await expect(page.getByTestId("confirm-verify-cause")).toBeEnabled();
    await page.getByTestId("confirm-verify-cause").click();
    await expect(
      supportedItem.getByText("Verified cause", { exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });
    const verifiedHypothesisId = (
      (await supportedItem.getAttribute("data-testid")) ?? ""
    ).replace("hypothesis-item-", "");

    const liveCaseUrl = page.url();
    await loginAs(page, "psContributor");
    await page.goto(liveCaseUrl);
    await expect(page.getByTestId("problem-solving-workspace")).toBeVisible();
    await page.getByTestId("tab-cause-analysis").click();
    await expect(page.getByTestId(/^verify-cause-/)).not.toBeVisible();
    await expect(page.getByTestId("confirm-verify-cause")).not.toBeVisible();
    await expect(
      page.getByTestId("problem-solving-close-button"),
    ).not.toBeVisible();

    await loginAs(page, "manager");
    await page.goto(liveCaseUrl);
    await expect(page.getByTestId("problem-solving-workspace")).toBeVisible();

    await page.getByTestId("tab-countermeasures").click();
    await page
      .getByTestId("countermeasure-title")
      .fill("Replace sealing jaw regulator and add pressure verification");
    await page.getByRole("button", { name: "Create countermeasure" }).click();
    const countermeasureItem = page
      .locator('[data-testid^="countermeasure-item-"]')
      .first();
    const causeSelect = countermeasureItem.getByTestId(
      /^countermeasure-cause-select-/,
    );
    await causeSelect.selectOption(verifiedHypothesisId);
    await countermeasureItem.getByTestId(/^select-countermeasure-/).click();
    await expect(countermeasureItem.getByText("Selected")).toBeVisible();
    await countermeasureItem
      .getByTestId(/^countermeasure-action-title-/)
      .fill("Replace Line 3 sealing jaw regulator");
    await countermeasureItem
      .getByTestId(/^link-countermeasure-action-/)
      .click();
    await expect(
      page.getByTestId("problem-solving-countermeasures-panel"),
    ).toContainText("Countermeasure action linked", { timeout: 15_000 });
    await page.getByTestId("tab-verification").click();
    await expect(
      page.locator('[data-testid^="related-action-"]').filter({
        hasText: "Replace Line 3 sealing jaw regulator",
      }),
    ).toBeVisible();

    await page
      .getByTestId("effectiveness-criterion")
      .fill("Seal defect rate (ppm)");
    await page.getByTestId("effectiveness-baseline").fill("180");
    await page.getByTestId("effectiveness-target").fill("120");
    await page.getByTestId("create-effectiveness-check").click();
    const effectivenessCheck = page
      .locator('[data-testid^="effectiveness-check-"]')
      .first();
    await expect(
      page.getByTestId("problem-solving-verification-panel"),
    ).toContainText("Effectiveness check created", { timeout: 15_000 });
    await effectivenessCheck.getByTestId(/^effectiveness-actual-/).fill("95");
    await expect(
      effectivenessCheck.getByTestId(/^record-effectiveness-pass-/),
    ).toBeEnabled();
    await effectivenessCheck.getByTestId(/^record-effectiveness-pass-/).click();
    await expect(
      effectivenessCheck.getByText("Pass", { exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("tab-sustainment").click();
    await page
      .getByTestId("sustainment-what")
      .fill(
        "Add sealing jaw pressure verification to the Line 3 changeover standard.",
      );
    await page
      .getByTestId("sustainment-check-method")
      .fill(
        "Technician verifies pressure within validated range before release to run.",
      );
    await page.getByTestId("create-sustainment-item").click();
    await expect(
      page.getByText("Add sealing jaw pressure verification"),
    ).toBeVisible();

    await page.getByTestId("tab-sessions").click();
    await page
      .getByTestId("session-title")
      .fill("Line 3 seal defect investigation review");
    await page.getByRole("button", { name: "Start session" }).click();
    const sessionItem = page.locator('[data-testid^="session-item-"]').first();
    await sessionItem
      .getByTestId(/^session-note-/)
      .fill("Team reviewed pressure trace evidence together.");
    await sessionItem.getByTestId(/^add-session-note-/).click();
    await sessionItem
      .getByTestId(/^session-decision-/)
      .fill(
        "Proceed with regulator replacement and add pressure verification to standard work.",
      );
    await sessionItem.getByTestId(/^add-session-decision-/).click();
    await sessionItem.getByTestId(/^complete-session-/).click();
    await expect(
      sessionItem.getByText("completed", { exact: true }),
    ).toBeVisible();

    await page.getByTestId("problem-solving-close-button").click();
    await expect(
      page.getByTestId("problem-solving-close-dialog"),
    ).toBeVisible();
    await page
      .getByTestId("closure-outcome-select")
      .selectOption("resolved_verified_cause");
    await page
      .getByTestId("closure-rationale")
      .fill(
        "Verified cause addressed with selected countermeasure and PASS effectiveness.",
      );
    await page.getByTestId("confirm-close-case").click();
    await expect(
      page
        .getByTestId("problem-solving-header")
        .getByText("Closed", { exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("tab-cause-analysis").click();
    await expect(
      page.getByText("Verified cause", { exact: true }),
    ).toBeVisible();
    await page.getByTestId("tab-countermeasures").click();
    await expect(
      page.getByText(
        "Replace sealing jaw regulator and add pressure verification",
      ),
    ).toBeVisible();
    await page.getByTestId("tab-verification").click();
    await expect(page.getByText("Pass", { exact: true })).toBeVisible();
    await page.getByTestId("tab-sustainment").click();
    await expect(
      page.getByText("Add sealing jaw pressure verification"),
    ).toBeVisible();
    await page.getByTestId("tab-sessions").click();
    await expect(
      page.getByText("Line 3 seal defect investigation review"),
    ).toBeVisible();
  });

  test("seeded closed case shows verified cause and effectiveness history", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await expect(page.getByTestId("problem-solving-workspace")).toBeVisible();
    await expect(page.getByText("Closed")).toBeVisible();

    await page.getByTestId("tab-cause-analysis").click();
    await expect(
      page.getByText(
        DEMO_PROBLEM_SOLVING_CASE.hypotheses.pressureVariation.statement,
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Verified cause", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        DEMO_PROBLEM_SOLVING_CASE.hypotheses.filmTension.statement,
      ),
    ).toBeVisible();

    await page.getByTestId("tab-verification").click();
    await expect(
      page.getByText(DEMO_PROBLEM_SOLVING_CASE.effectiveness.criterion),
    ).toBeVisible();

    await page.getByTestId("tab-sustainment").click();
    await expect(
      page.getByText(DEMO_PROBLEM_SOLVING_CASE.sustainment.what),
    ).toBeVisible();

    await page.getByTestId("tab-sessions").click();
    await expect(
      page.getByText(DEMO_PROBLEM_SOLVING_CASE.session.title),
    ).toBeVisible();
  });

  test("operator without problem_solving.view cannot access portfolio or case routes", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await openLiveCase(page);
    const caseUrl = page.url();

    await loginAs(page, "operator");
    await page.goto("/platform/problem-solving");
    await expect(
      page.getByTestId("problem-solving-portfolio-page"),
    ).not.toBeVisible();

    await page.goto(caseUrl);
    await expect(
      page.getByTestId("problem-solving-detail-page"),
    ).not.toBeVisible();
  });

  test("operator cannot open problem solving create route", async ({
    page,
  }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/problem-solving/new");
    await expect(
      page.getByTestId("create-problem-solving-page"),
    ).not.toBeVisible();
  });

  test("seeded case source links do not expose source resource titles in overview", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await page.getByTestId("tab-overview").click();
    await expect(
      page.getByTestId("problem-solving-overview-panel"),
    ).toBeVisible();
    await expect(page.getByText("Packaging Waste Reduction")).not.toBeVisible();
    const sourceSection = page.getByText("Source links").locator("..");
    const sourceText = await sourceSection.innerText();
    if (!sourceText.includes("No linked sources.")) {
      expect(sourceText).toMatch(/[0-9a-f]{8}/i);
      expect(sourceText).not.toContain("Packaging Waste Reduction");
    }
  });

  for (const viewport of viewports) {
    test(`responsive smoke at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await loginAs(page, "manager");
      await page.goto("/platform/problem-solving");
      await expect(
        page.getByTestId("problem-solving-portfolio-page"),
      ).toBeVisible();

      await page
        .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
        .click();
      await expect(page.getByTestId("problem-solving-workspace")).toBeVisible();
      await page.getByTestId("tab-overview").click();
      await expect(
        page.getByTestId("problem-solving-overview-panel"),
      ).toBeVisible();

      if (viewport.width <= 768) {
        await page.goto("/platform/problem-solving/new");
        await expect(
          page.getByTestId("create-problem-solving-page"),
        ).toBeVisible();
      }
    });
  }
});
