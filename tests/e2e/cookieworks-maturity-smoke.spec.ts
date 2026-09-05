import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  loginAsCookieWorksPersona,
  COOKIEWORKS_ORGANISATION,
} from "./helpers/cookieworks-auth";
import {
  answerAllAssessmentCriteria,
  BODMIN_FACTORY_LABEL,
  COOKIEWORKS_FRAMEWORK,
  createAndPublishCookieWorksFramework,
  openLatestFormalAssessment,
  startFormalAssessmentForBodmin,
  uploadEvidenceFile,
} from "./helpers/cookieworks-maturity";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const fixtureDirectory = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../fixtures/maturity-evidence",
);
const sampleImagePath = join(fixtureDirectory, "sample.png");
const sampleDocumentPath = join(fixtureDirectory, "sample.txt");

const journey = {
  assessmentUrl: "",
  assessmentId: "",
};

function assessmentIdFromUrl(url: string) {
  const match = url.match(/\/platform\/maturity\/assessments\/([^/?#]+)/);
  return match?.[1] ?? "";
}

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return () => {
    expect(errors, errors.join("\n")).toEqual([]);
  };
}

test.describe("CookieWorks maturity smoke (MAT0)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and CookieWorks foundation seed (npm run qa:cookie:reset)",
  );

  test.beforeAll(() => {
    execSync("npm run qa:cookie:reset", {
      cwd: join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
      env: {
        ...process.env,
        LEANHUB_ALLOW_QA_TENANT: "1",
      },
      stdio: "pipe",
    });
  });

  test.afterAll(() => {
    execSync("npm run qa:cookie:reset", {
      cwd: join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
      env: {
        ...process.env,
        LEANHUB_ALLOW_QA_TENANT: "1",
      },
      stdio: "pipe",
    });
  });

  test("MAT0-01: maturity empty state for admin", async ({ page }) => {
    const assertConsole = trackConsoleErrors(page);
    await loginAsCookieWorksPersona(page, "admin");
    await page.goto("/platform/maturity");

    await expect(
      page.getByRole("heading", { name: "Lean maturity", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("No Lean maturity framework yet"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create framework" }),
    ).toBeVisible();
    await expect(page.getByText("Apex")).toHaveCount(0);
    await expect(page.locator("canvas, svg.recharts-surface")).toHaveCount(0);
    assertConsole();
  });

  test("MAT0-02..06: configure and publish CookieWorks framework", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await loginAsCookieWorksPersona(page, "admin");
    await createAndPublishCookieWorksFramework(page);
    await expect(page.getByText(COOKIEWORKS_FRAMEWORK.name)).toBeVisible();
    await expect(page.getByText("Active version 1")).toBeVisible();
  });

  test("MAT0-07: CI Manager starts formal assessment for Bodmin", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "ciManager");
    journey.assessmentUrl = await startFormalAssessmentForBodmin(page);
    journey.assessmentId = assessmentIdFromUrl(journey.assessmentUrl);

    await expect(page.getByText(/draft|in progress/i)).toBeVisible();
    await expect(page.getByText(BODMIN_FACTORY_LABEL)).toHaveCount(0);
  });

  test("MAT0-08: draft answers persist across navigation", async ({ page }) => {
    expect(journey.assessmentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    await loginAsCookieWorksPersona(page, "ciManager");
    await page.goto(`/platform/maturity/assessments/${journey.assessmentId}`);
    await expect(
      page.getByRole("heading", { name: "Assessment" }),
    ).toBeVisible();

    const scoreInput = page.locator('input[type="number"]').first();
    await expect(scoreInput).toBeVisible({ timeout: 15_000 });
    await scoreInput.click();
    await scoreInput.pressSequentially("3");
    await scoreInput.blur();
    await expect(page.getByText("Saving…")).not.toBeVisible({
      timeout: 10_000,
    });

    await page.goto("/platform/maturity");
    await page.goto(`/platform/maturity/assessments/${journey.assessmentId}`);
    await expect(page.locator('input[type="number"]').first()).toHaveValue("3");

    await page.reload();
    await expect(page.locator('input[type="number"]').first()).toHaveValue("3");
  });

  test("MAT0-09: evidence upload for image and document", async ({ page }) => {
    await loginAsCookieWorksPersona(page, "ciManager");
    await page.goto(`/platform/maturity/assessments/${journey.assessmentId}`);

    await uploadEvidenceFile(page, sampleImagePath);
    await expect(page.getByText("sample.png")).toBeVisible();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await uploadEvidenceFile(page, sampleDocumentPath);
    await expect(page.getByText("sample.txt")).toBeVisible();

    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.getByText("sample.png")).toBeVisible();
  });

  test("MAT0-10: operator cannot upload evidence on formal assessment", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "operator");
    await page.goto(`/platform/maturity/assessments/${journey.assessmentId}`);

    await expect(page.getByTestId("evidence-file-input")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Submit for review" }),
    ).toHaveCount(0);
  });

  test("MAT0-11: submit completed formal assessment", async ({ page }) => {
    await loginAsCookieWorksPersona(page, "ciManager");
    await page.goto(`/platform/maturity/assessments/${journey.assessmentId}`);

    await answerAllAssessmentCriteria(page, 4);
    await page.getByTestId("submit-assessment").click();
    await expect(page.getByText("Submitted", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("MAT0-12: assessor begins formal review", async ({ page }) => {
    await loginAsCookieWorksPersona(page, "assessor");
    await openLatestFormalAssessment(page);

    await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
    await expect(page.getByText("sample.png")).toBeVisible();
    await expect(page.getByTestId("publish-official-result")).toHaveCount(0);
    await expect(page.getByTestId("submit-assessment")).toHaveCount(0);

    await page.getByTestId("begin-assessor-review").click();
    await expect(page.getByText("In review")).toBeVisible();
  });

  test("MAT0-14: CI Manager approves and publishes official result", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "ciManager");
    await openLatestFormalAssessment(page);

    await page.getByTestId("approve-assessment").click();
    await expect(page.getByText("Approved")).toBeVisible();

    await page.getByTestId("publish-official-result").click();
    await expect(page.getByText("Published").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("MAT0-15..16: official result and immutability", async ({ page }) => {
    await loginAsCookieWorksPersona(page, "admin");
    await page.goto("/platform/maturity");

    await expect(
      page.getByText("Current maturity", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("canvas, svg.recharts-surface").first(),
    ).toBeVisible();

    await openLatestFormalAssessment(page);
    await expect(page.getByText("Published").first()).toBeVisible();
    await expect(page.getByTestId("submit-assessment")).toHaveCount(0);
    await expect(page.locator('input[type="number"]').first()).toBeDisabled();
    await expect(page.getByTestId("evidence-file-input")).toHaveCount(0);
  });

  test("permissions: operator cannot configure frameworks", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "operator");
    await page.goto("/platform/maturity/models");

    await expect(
      page.getByRole("button", { name: "Create draft framework" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("framework-editor")).toHaveCount(0);
  });

  test("permissions: assessor cannot create frameworks", async ({ page }) => {
    await loginAsCookieWorksPersona(page, "assessor");
    await page.goto("/platform/maturity/models");

    await expect(
      page.getByRole("button", { name: "Create draft framework" }),
    ).toHaveCount(0);
  });

  test("permissions: assessor cannot approve assessments", async ({ page }) => {
    await loginAsCookieWorksPersona(page, "assessor");
    await openLatestFormalAssessment(page);

    await expect(page.getByTestId("approve-assessment")).toHaveCount(0);
    await expect(page.getByTestId("publish-official-result")).toHaveCount(0);
  });
});

test.describe("CookieWorks foundation contract", () => {
  test("organisation label is CookieWorks Manufacturing", async () => {
    expect(COOKIEWORKS_ORGANISATION.name).toBe("CookieWorks Manufacturing");
    expect(COOKIEWORKS_ORGANISATION.primarySiteName).toBe(
      "Bodmin Cookie Factory",
    );
  });
});
