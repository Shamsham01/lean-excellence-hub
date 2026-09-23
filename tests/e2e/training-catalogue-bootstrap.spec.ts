import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { DEMO_TRAINING_COURSES } from "../../scripts/demo-seed/constants";

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
  test.setTimeout(90_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: create, save, publish, and find course in catalogue", async ({
    page,
  }) => {
    const assertNoRuntimeErrors = trackProductionRuntimeErrors(page);
    const courseName = `E2E Training Catalogue ${Date.now()}`;
    const objectives = `Understand lean foundations ${Date.now()}`;

    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/training/courses");

    await expect(page.getByTestId("training-courses-page")).toBeVisible();
    await expect(
      page.getByTestId("training-course-create-submit"),
    ).toBeVisible();

    await page.getByTestId("training-course-name-input").fill(courseName);
    await page.getByTestId("training-course-category-input").fill("Foundation");
    await page
      .getByTestId("training-course-description-input")
      .fill("Bootstrap slice verification course.");
    await expect(
      page.getByTestId("training-course-generated-code"),
    ).not.toHaveText("Enter a course name to generate a code");

    await page.getByTestId("training-course-create-submit").click();
    await expect(page.getByTestId("training-course-detail-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: courseName })).toBeVisible();

    await page.getByTestId("training-course-validity-input").fill("365");
    await page.getByTestId("training-course-duration-input").fill("240");
    await page
      .getByTestId("training-course-delivery-select")
      .selectOption("classroom");
    await page.getByTestId("training-course-objectives-input").fill(objectives);
    await page.getByTestId("training-course-save-draft").click();
    await expect(page.getByTestId("authoring-save-feedback")).toContainText(
      "Course details saved.",
    );

    await page.reload();
    await expect(
      page.getByTestId("training-course-validity-input"),
    ).toHaveValue("365");
    await expect(
      page.getByTestId("training-course-objectives-input"),
    ).toHaveValue(objectives);

    await page.getByTestId("training-course-publish").click();
    await expect(page.getByTestId("authoring-save-feedback")).toContainText(
      "Published successfully.",
    );
    await expect(page.getByText(/v1 · Published/i)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/v1 · Published/i)).toBeVisible();

    await page.goto("/platform/training/courses");
    const courseRow = page.getByRole("link", { name: courseName });
    await expect(courseRow).toBeVisible();
    await expect(courseRow).toContainText("Published v1");

    assertNoRuntimeErrors();
  });

  test("admin: duplicate custom code shows a clear validation error", async ({
    page,
  }) => {
    const assertNoRuntimeErrors = trackProductionRuntimeErrors(page);
    const existingCode = DEMO_TRAINING_COURSES[0].code;

    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/training/courses");

    await page
      .getByTestId("training-course-name-input")
      .fill(`Duplicate code check ${Date.now()}`);
    await page.getByTestId("training-course-advanced-toggle").click();
    await page
      .getByTestId("training-course-custom-code-input")
      .fill(existingCode);
    await page.getByTestId("training-course-create-submit").click();

    await expect(
      page.getByTestId("training-course-create-error"),
    ).toContainText(/already exists/i);
    await expect(page.getByTestId("training-course-detail-page")).toHaveCount(
      0,
    );

    assertNoRuntimeErrors();
  });

  test("operator: cannot create or publish courses", async ({ page }) => {
    const assertNoRuntimeErrors = trackProductionRuntimeErrors(page);

    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/training/courses");

    await expect(page.getByTestId("training-course-create-submit")).toHaveCount(
      0,
    );

    await page
      .getByRole("link", { name: DEMO_TRAINING_COURSES[0].name })
      .click();
    await expect(page.getByTestId("training-course-detail-page")).toBeVisible();

    await expect(page.getByTestId("training-course-publish")).toHaveCount(0);
    await expect(page.getByTestId("training-course-save-draft")).toHaveCount(0);
    await expect(page.getByTestId("create-course-successor")).toHaveCount(0);

    assertNoRuntimeErrors();
  });

  test("admin: published course successor workflow remains available", async ({
    page,
  }) => {
    const assertNoRuntimeErrors = trackProductionRuntimeErrors(page);

    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/training/courses");
    await page
      .getByRole("link", { name: DEMO_TRAINING_COURSES[0].name })
      .click();

    if (await page.getByTestId("create-course-successor").isVisible()) {
      await page.getByTestId("create-course-successor").click();
      await expect(page.getByText(/Draft version/i)).toBeVisible();
      await expect(
        page.getByTestId("training-course-save-draft"),
      ).toBeVisible();
      await expect(page.getByTestId("create-course-successor")).toHaveCount(0);
    } else {
      await expect(page.getByText(/Published version/i)).toBeVisible();
    }

    assertNoRuntimeErrors();
  });

  test("admin: catalogue management layout fits a narrow viewport", async ({
    page,
  }) => {
    const assertNoRuntimeErrors = trackProductionRuntimeErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/training/courses");

    await expect(page.getByTestId("training-courses-page")).toBeVisible();
    await expect(
      page.getByTestId("training-course-create-submit"),
    ).toBeVisible();
    await expect(page.getByTestId("training-course-name-input")).toBeVisible();

    assertNoRuntimeErrors();
  });
});
