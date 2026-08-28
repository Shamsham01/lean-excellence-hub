import { expectPlatformOrganisationName } from "./helpers/platform-home";
import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const uniqueSuffix = Date.now().toString(36);

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

test.describe("Milestone 8 closure", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("manager opens methodology editor with published version", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/projects/methodologies");
    await expect(page.getByTestId("methodology-manager-page")).toBeVisible();
    await page.getByRole("link", { name: "DMAIC" }).click();
    await expect(page.getByRole("heading", { name: "DMAIC" })).toBeVisible();
    await expect(page.getByText("Versions")).toBeVisible();
  });

  test("manager creates a project via wizard", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/projects/new");
    await expect(page.getByTestId("create-project-page")).toBeVisible();
    await expect(page.getByTestId("create-project-wizard")).toBeVisible();

    const projectTitle = `E2E Closure Project ${uniqueSuffix}`;
    await page.getByLabel("Project title").fill(projectTitle);
    await page
      .locator("textarea")
      .first()
      .fill("Changeovers exceed the 45-minute target.");
    await page
      .locator("textarea")
      .nth(1)
      .fill("Reduce average changeover below 30 minutes.");

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel(/Methodology/i).selectOption({ index: 0 });
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByPlaceholder("Display name").fill("Changeover duration");
    await page.getByPlaceholder("Unit").fill("minutes");
    await page.getByPlaceholder("Baseline").fill("48");
    await page.getByPlaceholder("Target").fill("28");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: projectTitle }),
    ).toBeVisible();
  });

  test("manager submits, approves, and starts the project", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/projects");
    await page
      .getByRole("link", {
        name: new RegExp(`E2E Closure Project ${uniqueSuffix}`),
      })
      .click();
    await expect(page.getByTestId("project-detail-page")).toBeVisible();

    const submitButton = page.getByRole("button", { name: "Submit charter" });
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    await expect(
      page.getByText("Project submitted for approval"),
    ).toBeVisible();

    const approveButton = page.getByRole("button", { name: "Approve" });
    await expect(approveButton).toBeVisible();
    await approveButton.click();
    await expect(page.getByText("Project approved")).toBeVisible();

    const startButton = page.getByRole("button", { name: "Start project" });
    await expect(startButton).toBeVisible();
    await startButton.click();
    await expect(page.getByText("Project started")).toBeVisible();
  });

  test("manager completes a phase and records a measurement", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/projects");
    await page
      .getByRole("link", {
        name: new RegExp(`E2E Closure Project ${uniqueSuffix}`),
      })
      .click();
    await expect(page.getByTestId("project-detail-page")).toBeVisible();

    await page.getByRole("tab", { name: "Phases" }).click();
    const completePhase = page
      .getByRole("button", { name: "Complete" })
      .first();
    if (await completePhase.isVisible()) {
      await completePhase.click();
      await expect(page.getByText("Phase completed")).toBeVisible();
    }

    await page.getByRole("tab", { name: "Measures" }).click();
    const measurementInput = page.getByPlaceholder("Measured value").first();
    await expect(measurementInput).toBeVisible();
    await measurementInput.fill("40");
    await page.getByRole("button", { name: "Record" }).first().click();
    await expect(page.getByText("Measurement recorded")).toBeVisible();
  });

  test("operator cannot open project manage routes", async ({ page }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/projects/new");
    await expect(page.getByTestId("create-project-page")).not.toBeVisible();

    await page.goto("/platform/projects/methodologies");
    await expect(
      page.getByTestId("methodology-manager-page"),
    ).not.toBeVisible();
  });
});
