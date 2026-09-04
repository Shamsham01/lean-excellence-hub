import { expectPlatformOrganisationName } from "./helpers/platform-home";
import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const uniqueSuffix = Date.now().toString(36);
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
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
  await expectPlatformOrganisationName(page, DEMO_ORGANISATION.name);
}

test.describe("Milestone 10 closure", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("manager opens benefits portfolio with seeded stories", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/benefits");
    await expect(page.getByTestId("benefits-portfolio-page")).toBeVisible();
    await expect(page.getByTestId("benefit-portfolio")).toBeVisible();
    await expect(
      page.getByText("Packaging Waste Reduction Savings"),
    ).toBeVisible();
    await expect(
      page.getByText("Preventive Maintenance Cost Avoidance"),
    ).toBeVisible();
    await expect(
      page.getByText("Visual Standards Quality Improvement"),
    ).toBeVisible();
  });

  test("manager creates a financial benefit draft", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/benefits/new");
    await expect(page.getByTestId("create-benefit-page")).toBeVisible();
    await expect(page.getByTestId("create-benefit-wizard")).toBeVisible();

    const title = `E2E Benefit ${uniqueSuffix}`;
    await page.getByLabel("Benefit title").fill(title);
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Financial", exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Baseline financial value").fill("15000");
    await page
      .getByLabel("Baseline description")
      .fill("Baseline scrap cost for E2E benefit.");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Forecast start").fill("2026-04-01");
    await page.getByLabel("Forecast end").fill("2026-06-30");
    await page.getByLabel("Forecast total amount").fill("9000");
    await page.getByRole("button", { name: "Continue" }).click();

    await page
      .getByLabel("Standalone initiative (no source link required)")
      .check();
    await page.getByRole("button", { name: "Continue" }).click();
    await Promise.all([
      page.waitForURL(/\/platform\/benefits\/[0-9a-f-]{36}/),
      page.getByRole("button", { name: "Create benefit draft" }).click(),
    ]);

    await expect(page.getByTestId("benefit-detail-page")).toBeVisible();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });

  test("manager submits forecast and benefit for validation", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/benefits");
    await page
      .getByRole("link", { name: new RegExp(`E2E Benefit ${uniqueSuffix}`) })
      .click();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();

    await page.getByRole("tab", { name: "Forecast" }).click();
    await page.getByRole("button", { name: "Submit forecast" }).click();
    await expect(page.getByText("Forecast submitted")).toBeVisible();

    await page.getByTestId("benefit-submit-button").click();
    await expect(page.getByTestId("benefit-submit-dialog")).toBeVisible();
    await page
      .getByTestId("benefit-ci-validator-select")
      .selectOption({ label: "Apex Manager" });
    await page
      .getByTestId("benefit-finance-validator-select")
      .selectOption({ label: "Apex Finance" });
    await page.getByTestId("benefit-submit-confirm-button").click();
    await expect(
      page.getByText(/Benefit submitted for validation/i),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("benefit-header")
        .getByText("Submitted", { exact: true }),
    ).toBeVisible();
  });

  test("manager records CI approval while finance approval remains pending", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/benefits");
    await page
      .getByRole("link", { name: new RegExp(`E2E Benefit ${uniqueSuffix}`) })
      .click();
    await page.getByRole("tab", { name: "Validation" }).click();
    await page
      .getByLabel("Rationale", { exact: true })
      .fill("CI validation approved in E2E.");
    await page.getByRole("button", { name: "Record CI validation" }).click();
    await expect(page.getByText(/CI validation recorded/i)).toBeVisible();
    await expect(
      page
        .getByTestId("benefit-header")
        .getByText("Submitted", { exact: true }),
    ).toBeVisible();
  });

  test("finance validator approves from validation queue without project access", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await page.goto("/platform/benefits/validation");
    await expect(
      page.getByTestId("benefit-validation-queue-page"),
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(`E2E Benefit ${uniqueSuffix}`)),
    ).toBeVisible();

    await page
      .getByTestId("benefit-validation-queue-page")
      .getByText(new RegExp(`E2E Benefit ${uniqueSuffix}`))
      .locator("..")
      .locator("..")
      .getByRole("link", { name: "Open" })
      .click();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();
    await page.getByRole("tab", { name: "Validation" }).click();
    await page
      .locator("#finance-validation-rationale")
      .fill("Finance validation approved in E2E.");
    await page
      .getByRole("button", { name: "Record finance validation" })
      .click();
    await expect(page.getByText("FINANCE validation recorded")).toBeVisible();
    await expect(
      page.getByTestId("benefit-header").getByText("Approved", { exact: true }),
    ).toBeVisible();

    await page.goto("/platform/projects/new");
    await expect(page.getByTestId("create-project-page")).not.toBeVisible();
  });

  test("manager views realising benefit with validated actuals", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/benefits");
    await page.getByRole("link", { name: /Changeover Time Savings/i }).click();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();
    await page.getByRole("tab", { name: "Realisation" }).click();
    await expect(page.getByTestId("benefit-realisation-panel")).toBeVisible();
    await expect(
      page
        .getByTestId("benefit-realisation-panel")
        .getByText("Validated Actual", { exact: true })
        .first(),
    ).toBeVisible();
  });

  test("manager views non-financial realised benefit measure history", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/benefits");
    await page
      .getByRole("link", { name: /Visual Standards Quality Improvement/i })
      .click();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();
    await expect(
      page.getByTestId("benefit-header").getByText("Realised", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Realisation" }).click();
    await expect(
      page
        .getByTestId("benefit-realisation-panel")
        .getByText("Validated Measure", { exact: true })
        .first(),
    ).toBeVisible();
  });

  test("operator cannot open benefit management routes", async ({ page }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/benefits/new");
    await expect(page.getByTestId("create-benefit-page")).not.toBeVisible();

    await page.goto("/platform/benefits/validation");
    await expect(
      page.getByTestId("benefit-validation-queue-page"),
    ).not.toBeVisible();
  });

  test("forecast history remains visible on seeded benefit", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/benefits");
    await page
      .getByRole("link", { name: /Packaging Waste Reduction Savings/i })
      .click();
    await page.getByRole("tab", { name: "Forecast" }).click();
    await expect(page.getByTestId("benefit-forecast-panel")).toBeVisible();
    await expect(
      page.getByTestId("benefit-forecast-panel").getByText("Forecast history"),
    ).toBeVisible();
    await expect(
      page.getByTestId("benefit-forecast-panel").getByText(/Version 1/),
    ).toBeVisible();
  });

  test("realisation history keeps validated entries visible", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/benefits");
    await page
      .getByRole("link", { name: /Packaging Waste Reduction Savings/i })
      .click();
    await page.getByRole("tab", { name: "Realisation" }).click();
    await expect(
      page
        .getByTestId("benefit-realisation-panel")
        .getByText("Validated Actual", { exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByTestId("benefit-realisation-panel").getByText("£2,800"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("benefit-realisation-panel")
        .getByText("Validated")
        .first(),
    ).toBeVisible();
  });

  test("manager opens suggestion benefits integration for implemented suggestion", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/suggestions");
    await page
      .getByTestId("suggestion-portfolio-search")
      .fill("Pre-stage changeover tooling");
    await page.getByTestId("suggestion-portfolio-apply").click();
    await page
      .getByRole("link", { name: /Pre-stage changeover tooling/i })
      .click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await page.getByRole("tab", { name: "Benefits" }).click();
    await expect(page.getByTestId("suggestion-benefits-panel")).toBeVisible();
    await expect(page.getByText("Linked benefits")).toBeVisible();
  });

  for (const viewport of viewports) {
    test(`responsive smoke at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await loginAs(page, "manager");
      await page.goto("/platform/benefits");
      await expect(page.getByTestId("benefits-portfolio-page")).toBeVisible();

      if (viewport.width <= 768) {
        await page.goto("/platform/benefits/new");
        await expect(page.getByTestId("create-benefit-page")).toBeVisible();
      }
    });
  }
});
