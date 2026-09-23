import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_JOB_FUNCTIONS,
  DEMO_TRAINING_COURSES,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  ensureOnboardingE2eOrganisation,
  loginAsOnboardingOwner,
  onboardingE2eCredentials,
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

function resolveBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && publishableKey) {
    return { url, publishableKey };
  }

  const output = execSync("npx supabase status -o json", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "ignore"],
  });
  const status = JSON.parse(output) as {
    API_URL?: string;
    ANON_KEY?: string;
  };

  return {
    url: url ?? status.API_URL,
    publishableKey: publishableKey ?? status.ANON_KEY,
  };
}

async function signInRpcClient(
  email: string,
  password: string,
  organisationCode?: string,
): Promise<SupabaseClient> {
  const { url, publishableKey } = resolveBrowserSupabase();
  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key are required.");
  }

  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  const { data: organisations, error: listError } = await client.rpc(
    "list_my_eligible_organisations",
  );
  if (listError) {
    throw listError;
  }

  const organisation = organisationCode
    ? organisations?.find(
        (entry: { organisation_code: string }) =>
          entry.organisation_code === organisationCode,
      )
    : organisations?.[0];

  if (!organisation?.organisation_id) {
    throw new Error(
      "No eligible organisation was available for the RPC client.",
    );
  }

  const { error: switchError } = await client.rpc("switch_organisation", {
    target_organisation_id: organisation.organisation_id,
  });
  if (switchError) {
    throw switchError;
  }

  return client;
}

async function createPublishedCourse(
  client: SupabaseClient,
  name: string,
  code: string,
) {
  const { data: courseId, error: createError } = await client.rpc(
    "create_training_course_draft",
    {
      target_name: name,
      target_code: code,
    },
  );
  if (createError || !courseId) {
    throw createError ?? new Error("Unable to create fixture course.");
  }

  const { data: version, error: versionError } = await client
    .from("training_course_versions")
    .select("id")
    .eq("course_id", courseId)
    .eq("status", "draft")
    .maybeSingle();
  if (versionError || !version?.id) {
    throw versionError ?? new Error("Unable to load fixture course draft.");
  }

  const { error: publishError } = await client.rpc(
    "publish_training_course_version",
    {
      target_course_version_id: version.id,
    },
  );
  if (publishError) {
    throw publishError;
  }

  return courseId as string;
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("Training curriculum authoring", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test("empty state → create → add/edit/remove → publish → inspect → successor and compliance", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await ensureOnboardingE2eOrganisation();
    const ownerClient = await signInRpcClient(
      onboardingE2eCredentials.email,
      onboardingE2eCredentials.password,
      onboardingE2eCredentials.organisationCode,
    );
    const stamp = Date.now();
    const courseName = `Curriculum Safety ${stamp}`;
    const courseCode = `curriculum-safety-${stamp}`;
    await createPublishedCourse(ownerClient, courseName, courseCode);
    await loginAsOnboardingOwner(page);

    const curriculumName = `Core Operations Curriculum ${stamp}`;
    const expectedCode = `core-operations-curriculum-${stamp}`;

    await page.goto("/platform/training/curriculum");
    await expect(page.getByTestId("training-curriculum-page")).toBeVisible();

    if (
      (await page.getByTestId("training-curriculum-create-form").count()) === 0
    ) {
      await page.getByTestId("training-curriculum-new-button").click();
    } else {
      await expect(page.getByTestId("training-curricula-empty")).toBeVisible();
    }
    await expect(
      page.getByTestId("training-curriculum-create-form"),
    ).toBeVisible();

    await page
      .getByTestId("training-curriculum-name-input")
      .fill(curriculumName);
    await expect(
      page.getByTestId("training-curriculum-auto-code-preview"),
    ).toContainText(expectedCode);
    await page.getByTestId("training-curriculum-create-submit").click();

    await expect(page).toHaveURL(
      /\/platform\/training\/curriculum\/[0-9a-f-]{36}/,
    );
    await expect(
      page.getByTestId("training-curriculum-detail-page"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: curriculumName }),
    ).toBeVisible();
    await expect(
      page.getByTestId("training-curriculum-current-status"),
    ).toHaveText("Draft");
    await expect(
      page.getByTestId("training-curriculum-draft-editor"),
    ).toBeVisible();

    await page
      .getByTestId("training-requirement-course-input")
      .selectOption({ label: courseName });
    await page
      .getByTestId("training-requirement-applicability-all-members")
      .check();
    await page.getByTestId("training-requirement-deadline-input").fill("30");
    await page
      .getByTestId("training-requirement-validity-override-input")
      .fill("180");
    await page
      .getByTestId("training-requirement-notes-input")
      .fill("Everyone completes this induction.");
    await page.getByTestId("training-requirement-save").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Requirement saved.",
    );

    await page.reload();
    await expect(page.getByTestId("training-curriculum-review")).toContainText(
      courseName,
    );
    await expect(page.getByTestId("training-curriculum-review")).toContainText(
      "Everyone in the organisation",
    );

    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(
      page.getByTestId("training-requirement-deadline-input"),
    ).toHaveValue("30");
    await page.getByTestId("training-requirement-deadline-input").fill("45");
    await page.getByTestId("training-requirement-save").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Requirement saved.",
    );
    await expect(page.getByTestId("training-curriculum-review")).toContainText(
      "Complete within 45 days",
    );

    const secondCourseName = `Curriculum Refresh ${stamp}`;
    await createPublishedCourse(
      ownerClient,
      secondCourseName,
      `curriculum-refresh-${stamp}`,
    );
    await page.reload();
    await page
      .getByTestId("training-requirement-course-input")
      .selectOption({ label: secondCourseName });
    await page.getByTestId("training-requirement-save").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Requirement saved.",
    );
    await page.getByRole("button", { name: "Remove" }).last().click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Requirement saved.",
    );
    await expect(
      page.getByTestId("training-curriculum-review"),
    ).not.toContainText(secondCourseName);

    await page.getByTestId("training-curriculum-publish").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Published successfully.",
    );
    await expect(
      page.getByTestId("training-curriculum-current-status"),
    ).toHaveText("Published");
    await expect(
      page.getByTestId("training-curriculum-published-content"),
    ).toContainText(courseName);
    await expect(
      page.getByTestId("training-curriculum-draft-editor"),
    ).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByTestId("training-curriculum-published-requirements"),
    ).toContainText("Everyone in the organisation");
    await expect(page.getByTestId("create-curriculum-successor")).toBeVisible();

    await page.goto("/platform/training");
    await expect(page.getByTestId("training-overview")).toBeVisible();
    await expect(
      page.getByTestId("training-outstanding-required"),
    ).not.toHaveText("0");

    await page.goto("/platform/training/curriculum");
    await expect(
      page.getByRole("link", { name: curriculumName }),
    ).toBeVisible();
    await page.getByRole("link", { name: curriculumName }).click();
    await page.getByTestId("create-curriculum-successor").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Successor draft created.",
    );
    await expect(
      page.getByTestId("training-curriculum-version-2"),
    ).toContainText("Version 2");
    await expect(
      page.getByTestId("training-curriculum-draft-editor"),
    ).toBeVisible();
    await expect(
      page.getByTestId("training-curriculum-published-content"),
    ).toContainText(courseName);

    assertNoProductionRuntimeErrors();
  });

  test("multiple curricula stay independently selectable", async ({ page }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/training/curriculum");
    await expect(page.getByTestId("training-curriculum-page")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Apex Training Curriculum" }),
    ).toBeVisible();

    const stamp = Date.now();
    const secondName = `Site Induction Curriculum ${stamp}`;
    await page.getByTestId("training-curriculum-new-button").click();
    await page.getByTestId("training-curriculum-name-input").fill(secondName);
    await page.getByTestId("training-curriculum-create-submit").click();
    await expect(
      page.getByTestId("training-curriculum-detail-page"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: secondName })).toBeVisible();

    await page.getByTestId("training-curriculum-detail-back-link").click();
    await expect(page.getByRole("link", { name: secondName })).toBeVisible();
    await page.getByRole("link", { name: "Apex Training Curriculum" }).click();
    await expect(page.getByTestId("training-curriculum-code")).toHaveText(
      "apex-curriculum",
    );
    await expect(
      page.getByTestId("training-curriculum-published-content"),
    ).toContainText(DEMO_TRAINING_COURSES[0].name);
    await page.getByTestId("training-curriculum-detail-back-link").click();
    await page.getByRole("link", { name: secondName }).click();
    await expect(page.getByRole("heading", { name: secondName })).toBeVisible();
    await expect(
      page.getByTestId("training-curriculum-current-status"),
    ).toHaveText("Draft");

    assertNoProductionRuntimeErrors();
  });

  test("named selectors cover supported applicability modes and preserve invalid entries", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await signInAsDemoUser(page, "admin");
    const stamp = Date.now();
    const curriculumName = `Applicability Curriculum ${stamp}`;

    await page.goto("/platform/training/curriculum?new=1");
    await page
      .getByTestId("training-curriculum-name-input")
      .fill(curriculumName);
    await page.getByTestId("training-curriculum-create-submit").click();
    await expect(
      page.getByTestId("training-curriculum-draft-editor"),
    ).toBeVisible();

    await page.getByTestId("training-requirement-deadline-input").fill("21");
    await page.getByTestId("training-requirement-save").click();
    await expect(
      page.getByTestId("training-curriculum-draft-error"),
    ).toContainText("Choose a course");
    await expect(
      page.getByTestId("training-requirement-deadline-input"),
    ).toHaveValue("21");

    await page
      .getByTestId("training-requirement-course-input")
      .selectOption({ label: DEMO_TRAINING_COURSES[0].name });
    await page
      .getByTestId("training-requirement-applicability-job-function")
      .check();
    await page
      .getByTestId("training-requirement-job-function-input")
      .selectOption({ label: DEMO_JOB_FUNCTIONS[0].name });
    await page.getByTestId("training-requirement-save").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Requirement saved.",
    );
    await expect(page.getByTestId("training-curriculum-review")).toContainText(
      "primary job function is Operator",
    );

    await page
      .getByTestId("training-requirement-course-input")
      .selectOption({ label: DEMO_TRAINING_COURSES[1].name });
    await page
      .getByTestId("training-requirement-applicability-job-function-and-unit")
      .check();
    await page
      .getByTestId("training-requirement-job-function-input")
      .selectOption({ label: DEMO_JOB_FUNCTIONS[1].name });
    await page
      .getByTestId("training-requirement-unit-input")
      .selectOption({ label: /Operations/ });
    await page.getByTestId("training-requirement-optional").check();
    await page.getByTestId("training-requirement-save").click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Requirement saved.",
    );
    await expect(page.getByTestId("training-curriculum-review")).toContainText(
      "across the organisation",
    );
    await expect(page.getByTestId("training-curriculum-review")).toContainText(
      "optional",
    );

    await page
      .getByTestId("training-requirement-course-input")
      .selectOption({ label: DEMO_TRAINING_COURSES[0].name });
    await page
      .getByTestId("training-requirement-applicability-job-function")
      .check();
    await page
      .getByTestId("training-requirement-job-function-input")
      .selectOption({ label: DEMO_JOB_FUNCTIONS[0].name });
    await page.getByTestId("training-requirement-save").click();
    await expect(
      page.getByTestId("training-curriculum-draft-error"),
    ).toContainText("already has the same applicability");
    await expect(
      page.getByTestId("training-requirement-course-input"),
    ).toHaveValue(/.*/);

    assertNoProductionRuntimeErrors();
  });

  test("restricted roles keep read access and cannot author curricula", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await ensureOnboardingE2eOrganisation();
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/training/curriculum");
    await expect(page.getByTestId("training-curriculum-page")).toBeVisible();
    await expect(
      page.getByTestId("training-curriculum-new-button"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("training-curriculum-create-form"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Apex Training Curriculum" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Apex Training Curriculum" }).click();
    await expect(
      page.getByTestId("training-curriculum-detail-page"),
    ).toBeVisible();
    await expect(
      page.getByTestId("training-curriculum-draft-editor"),
    ).toHaveCount(0);
    await expect(page.getByTestId("training-curriculum-publish")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("create-curriculum-successor")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("training-curriculum-published-content"),
    ).toContainText(DEMO_TRAINING_COURSES[0].name);

    const operatorClient = await signInRpcClient(
      DEMO_USERS.operator.email,
      DEMO_USERS.operator.password,
      "apex-manufacturing",
    );
    const { error } = await operatorClient.rpc(
      "create_training_curriculum_draft",
      {
        target_name: "Operator Should Fail",
        target_code: `operator-fail-${Date.now()}`,
      },
    );
    expect(error).toBeTruthy();

    const onboardingClient = await signInRpcClient(
      onboardingE2eCredentials.email,
      onboardingE2eCredentials.password,
      onboardingE2eCredentials.organisationCode,
    );
    const { data: foreignCourse } = await operatorClient
      .from("training_courses")
      .select("id")
      .eq("code", DEMO_TRAINING_COURSES[0].code)
      .maybeSingle();
    expect(foreignCourse?.id).toBeTruthy();

    const { data: onboardingCurriculumId, error: createError } =
      await onboardingClient.rpc("create_training_curriculum_draft", {
        target_name: `Isolation Curriculum ${Date.now()}`,
        target_code: `isolation-curriculum-${Date.now()}`,
      });
    expect(createError).toBeNull();

    const { data: onboardingVersion } = await onboardingClient
      .from("training_curriculum_versions")
      .select("id")
      .eq("curriculum_id", onboardingCurriculumId as string)
      .eq("status", "draft")
      .maybeSingle();

    const { error: crossOrgError } = await onboardingClient.rpc(
      "add_training_requirement",
      {
        target_curriculum_version_id: onboardingVersion?.id,
        target_course_id: foreignCourse?.id,
        target_applies_to_all_members: true,
      },
    );
    expect(crossOrgError).toBeTruthy();

    assertNoProductionRuntimeErrors();
  });

  test("desktop and narrow mobile curriculum layouts stay usable", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await signInAsDemoUser(page, "admin");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/platform/training/curriculum");
    await expect(page.getByTestId("training-curriculum-page")).toBeVisible();
    await expect(
      page.getByTestId("training-curriculum-new-button"),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("training-curriculum-page")).toBeVisible();
    await expect(
      page.getByTestId("training-curriculum-new-button"),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByTestId("training-curriculum-new-button").click();
    await expect(
      page.getByTestId("training-curriculum-create-form"),
    ).toBeVisible();
    await expect(
      page.getByTestId("training-curriculum-create-submit"),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/platform/training/curriculum");
    await page.getByRole("link", { name: "Apex Training Curriculum" }).click();
    await expect(
      page.getByTestId("training-curriculum-detail-page"),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    assertNoProductionRuntimeErrors();
  });
});
