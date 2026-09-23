import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { createPublishableClient } from "./helpers/workforce-provisioning";
import {
  DEMO_ORGANISATION,
  DEMO_TRAINING_COURSES,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

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

async function createDraftCourse(page: Page, courseName: string) {
  await page.goto("/platform/training/courses");
  await page.getByTestId("training-course-name-input").fill(courseName);
  await page.getByTestId("training-course-create-submit").click();
  await expect(page.getByTestId("training-course-detail-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: courseName })).toBeVisible();
}

async function fillDraftDetails(
  page: Page,
  input: {
    validityDays: string;
    durationMinutes: string;
    objectives: string;
  },
) {
  await page
    .getByTestId("training-course-validity-input")
    .fill(input.validityDays);
  await page
    .getByTestId("training-course-duration-input")
    .fill(input.durationMinutes);
  await page
    .getByTestId("training-course-delivery-select")
    .selectOption("classroom");
  await page
    .getByTestId("training-course-objectives-input")
    .fill(input.objectives);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function signInDemoSupabase(user: keyof typeof DEMO_USERS) {
  const client = createPublishableClient();
  const { error } = await client.auth.signInWithPassword({
    email: DEMO_USERS[user].email,
    password: DEMO_USERS[user].password,
  });
  if (error) {
    throw error;
  }

  const { data: organisations, error: organisationError } = await client.rpc(
    "list_my_eligible_organisations",
  );
  if (organisationError) {
    throw organisationError;
  }

  const organisation = (
    organisations as Array<{
      organisation_id: string;
      organisation_code: string;
    }> | null
  )?.find((entry) => entry.organisation_code === DEMO_ORGANISATION.code);

  if (!organisation) {
    throw new Error("Demo organisation was not available after sign-in.");
  }

  const { error: switchError } = await client.rpc("switch_organisation", {
    target_organisation_id: organisation.organisation_id,
  });
  if (switchError) {
    throw switchError;
  }

  return client;
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
    await createDraftCourse(page, courseName);
    await fillDraftDetails(page, {
      validityDays: "365",
      durationMinutes: "240",
      objectives,
    });
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

  test("admin: publish saves unsaved draft edits", async ({ page }) => {
    const assertNoRuntimeErrors = trackProductionRuntimeErrors(page);
    const courseName = `E2E Publish Saves Edits ${Date.now()}`;
    const objectives = `Unsaved publish objectives ${Date.now()}`;

    await signInAsDemoUser(page, "admin");
    await createDraftCourse(page, courseName);
    await fillDraftDetails(page, {
      validityDays: "180",
      durationMinutes: "90",
      objectives,
    });
    await page.getByTestId("training-course-publish").click();
    await expect(page.getByTestId("authoring-save-feedback")).toContainText(
      "Published successfully.",
    );

    await page.reload();
    await expect(page.getByText(/v1 · Published/i)).toBeVisible();
    await expect(page.getByText("180 days")).toBeVisible();
    await expect(page.getByText("90 minutes")).toBeVisible();
    await expect(page.getByText(objectives)).toBeVisible();

    assertNoRuntimeErrors();
  });

  test("admin: draft save preserves evidence requirements", async ({
    page,
  }) => {
    const assertNoRuntimeErrors = trackProductionRuntimeErrors(page);
    const courseName = `E2E Evidence Preserve ${Date.now()}`;
    const evidence = { attendance: `signed-register-${Date.now()}` };

    await signInAsDemoUser(page, "admin");
    await createDraftCourse(page, courseName);
    const courseId = page.url().match(/\/courses\/([^/?#]+)/)?.[1];
    expect(courseId).toBeTruthy();

    const admin = await signInDemoSupabase("admin");
    const { data: version, error: versionError } = await admin
      .from("training_course_versions")
      .select("id")
      .eq("course_id", courseId!)
      .eq("status", "draft")
      .maybeSingle();
    expect(versionError).toBeNull();
    expect(version?.id).toBeTruthy();

    const { error: evidenceError } = await admin.rpc(
      "update_training_course_draft_version",
      {
        target_course_version_id: version!.id,
        target_evidence_requirements: evidence,
        target_validity_days: 30,
      },
    );
    expect(evidenceError).toBeNull();

    await page.reload();
    await page.getByTestId("training-course-validity-input").fill("120");
    await page.getByTestId("training-course-duration-input").fill("45");
    await page.getByTestId("training-course-save-draft").click();
    await expect(page.getByTestId("authoring-save-feedback")).toContainText(
      "Course details saved.",
    );

    const { data: savedVersion, error: savedError } = await admin
      .from("training_course_versions")
      .select("evidence_requirements, validity_days, duration_minutes")
      .eq("id", version!.id)
      .maybeSingle();
    expect(savedError).toBeNull();
    expect(savedVersion?.evidence_requirements).toEqual(evidence);
    expect(savedVersion?.validity_days).toBe(120);
    expect(savedVersion?.duration_minutes).toBe(45);

    assertNoRuntimeErrors();
  });

  test("admin: invalid draft save preserves entered values", async ({
    page,
  }) => {
    const assertNoRuntimeErrors = trackProductionRuntimeErrors(page);
    const courseName = `E2E Draft Validation ${Date.now()}`;
    const objectives = `Keep these objectives ${Date.now()}`;

    await signInAsDemoUser(page, "admin");
    await createDraftCourse(page, courseName);
    await page.getByTestId("training-course-objectives-input").fill(objectives);
    await page.getByTestId("training-course-duration-input").fill("0");
    await page.getByTestId("training-course-save-draft").click();

    await expect(page.getByTestId("training-course-draft-error")).toContainText(
      /Duration must be a positive number/i,
    );
    await expect(
      page.getByTestId("training-course-objectives-input"),
    ).toHaveValue(objectives);
    await expect(
      page.getByTestId("training-course-duration-input"),
    ).toHaveValue("0");
    await expect(page.getByTestId("training-course-detail-page")).toBeVisible();

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

  test("operator: cannot create, edit, or publish through UI or direct actions", async ({
    page,
  }) => {
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

    const operator = await signInDemoSupabase("operator");
    const createResult = await operator.rpc("create_training_course_draft", {
      target_name: `Hostile operator course ${Date.now()}`,
      target_code: `hostile-operator-${Date.now()}`,
    });
    expect(createResult.error?.message.toLowerCase()).toMatch(/not authorised/);

    const updateResult = await operator.rpc(
      "update_training_course_draft_version",
      {
        target_course_version_id: "00000000-0000-4000-8000-000000000001",
        target_validity_days: 10,
      },
    );
    expect(updateResult.error?.message.toLowerCase()).toMatch(/not authorised/);

    const publishResult = await operator.rpc(
      "publish_training_course_version",
      {
        target_course_version_id: "00000000-0000-4000-8000-000000000001",
      },
    );
    expect(publishResult.error?.message.toLowerCase()).toMatch(
      /not authorised/,
    );

    assertNoRuntimeErrors();
  });

  test("admin: published course successor workflow creates a new draft", async ({
    page,
  }) => {
    const assertNoRuntimeErrors = trackProductionRuntimeErrors(page);
    const courseName = `E2E Successor ${Date.now()}`;

    await signInAsDemoUser(page, "admin");
    await createDraftCourse(page, courseName);
    await fillDraftDetails(page, {
      validityDays: "365",
      durationMinutes: "120",
      objectives: "Successor source version",
    });
    await page.getByTestId("training-course-publish").click();
    await expect(page.getByText(/v1 · Published/i)).toBeVisible();
    await expect(page.getByTestId("create-course-successor")).toBeVisible();

    await page.getByTestId("create-course-successor").click();
    await expect(page.getByText(/Draft version 2/i)).toBeVisible();
    await expect(page.getByTestId("training-course-save-draft")).toBeVisible();
    await expect(page.getByTestId("create-course-successor")).toHaveCount(0);
    await expect(page.getByText(/Published version 1/i)).toBeVisible();

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
    await assertNoHorizontalOverflow(page);

    const firstCourse = page
      .getByRole("link", { name: DEMO_TRAINING_COURSES[0].name })
      .first();
    await firstCourse.click();
    await expect(page.getByTestId("training-course-detail-page")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    assertNoRuntimeErrors();
  });
});
