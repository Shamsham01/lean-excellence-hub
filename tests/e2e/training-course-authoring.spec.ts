import { expect, test, type Page } from "@playwright/test";

import { DEMO_TRAINING_COURSES } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  ensureOnboardingE2eOrganisation,
  loginAsOnboardingOwner,
} from "./helpers/onboarding-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

function trackProductionRuntimeErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`[console.error] ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(`[pageerror] ${error.message}`);
  });

  return () => {
    expect(
      pageErrors,
      pageErrors.length > 0
        ? `Unexpected uncaught page errors:\n${pageErrors.join("\n")}`
        : undefined,
    ).toEqual([]);
    expect(
      consoleErrors,
      consoleErrors.length > 0
        ? `Unexpected console.error output:\n${consoleErrors.join("\n")}`
        : undefined,
    ).toEqual([]);
  };
}

test.describe("Training course catalogue bootstrap", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test("empty catalogue: setup → create draft → save → reload → publish → catalogue", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await ensureOnboardingE2eOrganisation();
    await loginAsOnboardingOwner(page);

    const stamp = Date.now();
    const courseName = `Forklift Safety ${stamp}`;
    const expectedCode = `forklift-safety-${stamp}`;

    await page.goto("/platform/setup");
    await expect(page.getByTestId("setup-page")).toBeVisible();
    const trainingSetup = page.getByTestId("setup-item-training_configuration");
    await expect(trainingSetup).toBeVisible();
    await trainingSetup.getByRole("link", { name: "Set up" }).click();
    await expect(page).toHaveURL(/\/platform\/training\/courses/);
    await expect(page.getByTestId("training-courses-page")).toBeVisible();

    if ((await page.getByTestId("training-course-create-form").count()) === 0) {
      await page.getByTestId("training-course-new-button").click();
    } else {
      await expect(page.getByTestId("training-courses-empty")).toBeVisible();
    }
    await expect(page.getByTestId("training-course-create-form")).toBeVisible();

    await page.getByTestId("training-course-name-input").fill(courseName);
    await expect(
      page.getByTestId("training-course-auto-code-preview"),
    ).toContainText(expectedCode);
    await page.getByTestId("training-course-create-submit").click();

    await expect(page).toHaveURL(
      /\/platform\/training\/courses\/[0-9a-f-]{36}/,
    );
    await expect(page.getByTestId("training-course-detail-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: courseName })).toBeVisible();
    await expect(page.getByTestId("training-course-current-status")).toHaveText(
      "Draft",
    );
    await expect(
      page.getByTestId("training-course-draft-editor"),
    ).toBeVisible();

    await page.getByTestId("training-course-validity-input").fill("365");
    await page
      .getByTestId("training-course-delivery-input")
      .selectOption("classroom");
    await page
      .getByTestId("training-course-objectives-input")
      .fill("Operate a forklift safely.");
    await page.getByTestId("training-course-save-draft").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Draft saved.",
    );

    await page.reload();
    await expect(
      page.getByTestId("training-course-validity-input"),
    ).toHaveValue("365");
    await expect(
      page.getByTestId("training-course-delivery-input"),
    ).toHaveValue("classroom");
    await expect(
      page.getByTestId("training-course-objectives-input"),
    ).toHaveValue("Operate a forklift safely.");

    await page.getByTestId("training-course-publish").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Published successfully.",
    );
    await expect(page.getByTestId("training-course-current-status")).toHaveText(
      "Published",
    );
    await expect(
      page.getByTestId("training-course-published-content"),
    ).toContainText("Operate a forklift safely.");
    await expect(page.getByTestId("training-course-draft-editor")).toHaveCount(
      0,
    );

    await page.reload();
    await expect(page.getByTestId("training-course-current-status")).toHaveText(
      "Published",
    );
    await expect(page.getByTestId("create-course-successor")).toBeVisible();

    await page.goto("/platform/training/courses");
    await expect(page.getByRole("link", { name: courseName })).toBeVisible();
    await expect(page.getByText("Published").first()).toBeVisible();

    await page.goto("/platform/setup");
    await expect(
      page.getByTestId("setup-item-training_configuration"),
    ).toContainText("Setup started");

    assertNoProductionRuntimeErrors();
  });

  test("generated code, advanced override, and duplicate-code handling", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/training/courses");
    await expect(page.getByTestId("training-courses-page")).toBeVisible();

    await page.getByTestId("training-course-new-button").click();
    await expect(page.getByTestId("training-course-create-form")).toBeVisible();
    await page
      .getByTestId("training-course-name-input")
      .fill(DEMO_TRAINING_COURSES[0].name);
    await expect(
      page.getByTestId("training-course-auto-code-preview"),
    ).toContainText("lean-basic-2");

    await page.getByTestId("training-course-custom-code-toggle").click();
    await page
      .getByTestId("training-course-custom-code-input")
      .fill(DEMO_TRAINING_COURSES[0].code);
    await page.getByTestId("training-course-create-submit").click();
    await expect(
      page.getByTestId("training-course-create-error"),
    ).toContainText("already exists");
    await expect(page.getByTestId("training-course-name-input")).toHaveValue(
      DEMO_TRAINING_COURSES[0].name,
    );
    await expect(page).toHaveURL(/\/platform\/training\/courses/);

    const uniqueName = `Lockout Tagout ${Date.now()}`;
    const uniqueCode = `loto-${Date.now()}`;
    await page.getByTestId("training-course-name-input").fill(uniqueName);
    await page
      .getByTestId("training-course-custom-code-input")
      .fill(uniqueCode);
    await page.getByTestId("training-course-create-submit").click();
    await expect(page).toHaveURL(
      /\/platform\/training\/courses\/[0-9a-f-]{36}/,
    );
    await expect(page.getByTestId("training-course-code")).toHaveText(
      uniqueCode,
    );

    assertNoProductionRuntimeErrors();
  });

  test("published version stays read-only and successor draft remains available", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await signInAsDemoUser(page, "admin");
    const courseName = `Confined Space ${Date.now()}`;

    await page.goto("/platform/training/courses?new=1");
    await page.getByTestId("training-course-name-input").fill(courseName);
    await page.getByTestId("training-course-create-submit").click();
    await expect(
      page.getByTestId("training-course-draft-editor"),
    ).toBeVisible();
    await page
      .getByTestId("training-course-objectives-input")
      .fill("Enter only with a permit.");
    await page.getByTestId("training-course-publish").click();
    await expect(
      page.getByTestId("training-course-published-content"),
    ).toBeVisible();
    await expect(page.getByTestId("training-course-draft-editor")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("create-course-successor")).toBeVisible();

    await page.getByTestId("create-course-successor").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Successor draft created.",
    );
    await expect(page.getByText("Version 2")).toBeVisible();
    await expect(
      page.getByTestId("training-course-draft-editor"),
    ).toBeVisible();
    await expect(
      page.getByTestId("training-course-published-content"),
    ).toContainText("Enter only with a permit.");
    await expect(page.getByTestId("create-course-successor")).toHaveCount(0);

    assertNoProductionRuntimeErrors();
  });

  test("restricted roles keep read access and cannot author the catalogue", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/training/courses");
    await expect(page.getByTestId("training-courses-page")).toBeVisible();
    await expect(page.getByTestId("training-course-new-button")).toHaveCount(0);
    await expect(page.getByTestId("training-course-create-form")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: DEMO_TRAINING_COURSES[0].name }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: DEMO_TRAINING_COURSES[0].name })
      .click();
    await expect(page.getByTestId("training-course-detail-page")).toBeVisible();
    await expect(page.getByTestId("training-course-draft-editor")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("training-course-publish")).toHaveCount(0);
    await expect(page.getByTestId("create-course-successor")).toHaveCount(0);

    assertNoProductionRuntimeErrors();
  });

  test("desktop and narrow mobile catalogue layout stay usable", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await signInAsDemoUser(page, "admin");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/platform/training/courses");
    await expect(page.getByTestId("training-courses-page")).toBeVisible();
    await expect(page.getByTestId("training-course-new-button")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("training-courses-page")).toBeVisible();
    await expect(page.getByTestId("training-course-new-button")).toBeVisible();
    await page.getByTestId("training-course-new-button").click();
    await expect(page.getByTestId("training-course-create-form")).toBeVisible();
    await expect(
      page.getByTestId("training-course-create-submit"),
    ).toBeVisible();

    assertNoProductionRuntimeErrors();
  });
});
