import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const uniqueSuffix = Date.now().toString(36);
const pinnedCaseTitle = `E2E Pinned PS Case ${uniqueSuffix}`;

function createCaseWizard(page: Page) {
  return page.getByTestId("create-problem-solving-wizard");
}

async function clickWizardNext(page: Page) {
  await createCaseWizard(page)
    .getByRole("button", { name: "Next", exact: true })
    .click();
}

test.describe("Problem solving pinned draft activation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("manager activates a pinned draft, starts a session, and sees draft guidance beforehand", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving/new");

    await page.getByTestId("create-case-title").fill(pinnedCaseTitle);
    await createCaseWizard(page)
      .getByTestId("case-unit-select")
      .selectOption({ index: 1 });
    await createCaseWizard(page)
      .getByTestId("create-case-owner")
      .selectOption({ index: 1 });
    await clickWizardNext(page);
    await clickWizardNext(page);
    await clickWizardNext(page);
    await clickWizardNext(page);

    await createCaseWizard(page)
      .getByTestId("create-case-method-version")
      .selectOption({ index: 1 });
    await clickWizardNext(page);
    await createCaseWizard(page)
      .getByRole("button", { name: "Create draft case" })
      .click();

    await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("activate-method-locked")).toBeVisible();
    await expect(page.getByTestId("activate-method-select")).toHaveCount(0);

    await page.getByTestId("tab-sessions").click();
    await expect(page.getByTestId("sessions-draft-guidance")).toBeVisible();

    await page.getByTestId("tab-overview").click();
    await page.getByTestId("problem-solving-activate-button").click();
    await expect(
      page
        .getByTestId("problem-solving-header")
        .getByText("Active", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("tab-sessions").click();
    await page.getByTestId("session-title").fill("Pinned method workshop");
    await page.getByTestId("start-session-button").click();
    await expect(page.getByText("Pinned method workshop")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("pinned activation layout remains usable on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await page.getByRole("link", { name: pinnedCaseTitle }).click();
    await expect(page.getByTestId("problem-solving-workspace")).toBeVisible();
    await expect(page.getByTestId("problem-solving-header")).toBeVisible();
    await page.getByTestId("tab-sessions").click();
    await expect(
      page.getByTestId("problem-solving-sessions-panel"),
    ).toBeVisible();
  });
});
