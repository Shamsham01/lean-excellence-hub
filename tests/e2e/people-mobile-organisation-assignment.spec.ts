import { expect, test, type Locator, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { DEMO_USERS } from "../../scripts/demo-seed/constants";
import {
  createDemoAdminSession,
  queryDatabase,
} from "./helpers/workforce-provisioning";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const viewports = [
  { name: "320", width: 320, height: 700, columns: 1 },
  { name: "360", width: 360, height: 740, columns: 1 },
  { name: "390", width: 390, height: 844, columns: 1 },
  { name: "430", width: 430, height: 932, columns: 1 },
  { name: "768", width: 768, height: 1024, columns: 2 },
  { name: "1440", width: 1440, height: 900, columns: 2 },
] as const;

type AssignmentFixture = {
  organisationId: string;
  operatorMembershipId: string;
  adminMembershipId: string;
  jobFunctionId: string;
  jobFunctionName: string;
  lineUnitId: string;
  lineName: string;
  unitIdsLeafFirst: string[];
  originalJobFunctionId: string;
  originalUnitId: string;
  mutated: boolean;
};

let fixture: AssignmentFixture;

function unbrokenLabel(prefix: string, length: number) {
  const alphabet = "ContinuousImprovementCoordinator";
  let value = prefix;
  while (value.length < length) {
    value += alphabet;
  }
  return value.slice(0, length);
}

function organisationSection(page: Page) {
  return page.getByTestId("organisation-assignment-section");
}

async function signInForAssignmentCheck(
  page: Page,
  user: keyof typeof DEMO_USERS,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await signInAsDemoUser(page, user);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(3_000);
    }
  }
  throw lastError;
}

async function measureHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const measure = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }
      return {
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    };

    return {
      document: measure(document.documentElement),
      body: measure(document.body),
      main: measure(document.querySelector("[data-testid='platform-main']")),
      card: measure(
        document.querySelector("[data-testid='member-admin-card']"),
      ),
      section: measure(
        document.querySelector(
          "[data-testid='organisation-assignment-section']",
        ),
      ),
      summary: measure(
        document.querySelector(
          "[data-testid='organisation-assignment-summary']",
        ),
      ),
      form: measure(
        document.querySelector("[data-testid='organisation-assignment-form']"),
      ),
      grid: measure(
        document.querySelector("[data-testid='organisation-assignment-grid']"),
      ),
    };
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await measureHorizontalOverflow(page);
  expect(metrics).toEqual(
    expect.objectContaining({
      document: expect.any(Object),
      body: expect.any(Object),
      main: expect.any(Object),
      card: expect.any(Object),
      section: expect.any(Object),
      summary: expect.any(Object),
      form: expect.any(Object),
      grid: expect.any(Object),
    }),
  );

  for (const [name, value] of Object.entries(metrics)) {
    expect(value, `${name} was not measured`).not.toBeNull();
    expect(
      value!.scrollWidth,
      `${name} scrollWidth ${value!.scrollWidth} exceeds clientWidth ${value!.clientWidth}`,
    ).toBeLessThanOrEqual(value!.clientWidth + 1);
  }
}

async function expectBoxInside(
  label: string,
  child: Locator,
  container: Locator,
  viewportWidth: number,
) {
  const childBox = await child.boundingBox();
  const containerBox = await container.boundingBox();
  expect(childBox, `${label} bounding box`).not.toBeNull();
  expect(containerBox, `${label} container bounding box`).not.toBeNull();

  const childRight = childBox!.x + childBox!.width;
  const containerRight = containerBox!.x + containerBox!.width;
  expect(childBox!.width, `${label} width`).toBeGreaterThan(0);
  expect(childBox!.height, `${label} height`).toBeGreaterThan(0);
  expect(
    childBox!.x,
    `${label} starts left of its card`,
  ).toBeGreaterThanOrEqual(containerBox!.x - 1);
  expect(childRight, `${label} extends past its card`).toBeLessThanOrEqual(
    containerRight + 1,
  );
  expect(
    childBox!.x,
    `${label} starts left of the viewport`,
  ).toBeGreaterThanOrEqual(-1);
  expect(childRight, `${label} extends past the viewport`).toBeLessThanOrEqual(
    viewportWidth + 1,
  );
}

async function expectWrappedText(label: string, element: Locator) {
  const metrics = await element.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
      fontSize: Number.parseFloat(style.fontSize),
    };
  });
  expect(
    metrics.scrollWidth,
    `${label} text scrollWidth ${metrics.scrollWidth} exceeds clientWidth ${metrics.clientWidth}`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.fontSize, `${label} text size`).toBeGreaterThanOrEqual(14);
}

async function expectClosedSelectsContained(
  page: Page,
  viewport: (typeof viewports)[number],
) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });

  const section = organisationSection(page);
  const card = page.getByTestId("member-admin-card");
  const grid = page.getByTestId("organisation-assignment-grid");
  const jobSelect = page.locator("#member-job-function");
  const unitSelect = page.locator("#member-primary-unit");
  const saveButton = page.getByTestId("save-organisation-assignment");

  await section.scrollIntoViewIfNeeded();
  await expect(jobSelect).toBeVisible();
  await expect(unitSelect).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const columnCount = await grid.evaluate(
    (element) =>
      getComputedStyle(element)
        .gridTemplateColumns.split(" ")
        .filter((track) => track.trim().length > 0).length,
  );
  expect(columnCount, `${viewport.name} column count`).toBe(viewport.columns);

  const jobBox = await jobSelect.boundingBox();
  const unitBox = await unitSelect.boundingBox();
  expect(jobBox).not.toBeNull();
  expect(unitBox).not.toBeNull();
  if (viewport.columns === 1) {
    expect(unitBox!.y).toBeGreaterThanOrEqual(jobBox!.y + jobBox!.height - 1);
    expect(Math.abs(jobBox!.x - unitBox!.x)).toBeLessThanOrEqual(2);
  } else {
    expect(Math.abs(jobBox!.y - unitBox!.y)).toBeLessThanOrEqual(4);
    expect(unitBox!.x).toBeGreaterThan(jobBox!.x + 40);
  }

  await expectBoxInside("Job function select", jobSelect, card, viewport.width);
  await expectBoxInside(
    "Primary organisation unit select",
    unitSelect,
    card,
    viewport.width,
  );

  await saveButton.scrollIntoViewIfNeeded();
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  await expect(saveButton).toBeInViewport();
  await expectBoxInside(
    "Save organisation assignment",
    saveButton,
    card,
    viewport.width,
  );

  const selectMetrics = await jobSelect.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      tagName: element.tagName,
      fontSize: Number.parseFloat(style.fontSize),
      width: box.width,
      right: box.right,
    };
  });
  expect(selectMetrics.tagName).toBe("SELECT");
  expect(selectMetrics.fontSize).toBeGreaterThanOrEqual(14);
  expect(selectMetrics.right).toBeLessThanOrEqual(viewport.width + 1);
  expect(selectMetrics.width).toBeLessThanOrEqual(viewport.width);
}

async function expectAssignmentLayout(
  page: Page,
  viewport: (typeof viewports)[number],
) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });

  const section = organisationSection(page);
  const card = page.getByTestId("member-admin-card");
  const savedJob = page.getByTestId("saved-job-function");
  const savedUnit = page.getByTestId("saved-primary-unit");

  await expectClosedSelectsContained(page, viewport);
  await savedJob.scrollIntoViewIfNeeded();
  await expect(savedJob).toHaveText(fixture.jobFunctionName);
  await expect(savedUnit).toHaveText(fixture.lineName);
  await expectWrappedText("Saved job function", savedJob);
  await expectWrappedText("Saved organisation unit", savedUnit);
  await expectBoxInside("Saved job function", savedJob, card, viewport.width);
  await expectBoxInside(
    "Saved organisation unit",
    savedUnit,
    card,
    viewport.width,
  );

  if (viewport.width === 390 || viewport.width === 1440) {
    await section.screenshot({
      path: test.info().outputPath(`people-mobile-001-${viewport.width}.png`),
    });
  }
}

test.describe("PEOPLE-MOBILE-001 organisation assignment", () => {
  test.describe.configure({ mode: "default" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test.beforeAll(async () => {
    const rows = queryDatabase<{
      operator_membership_id: string;
      admin_membership_id: string;
      organisation_id: string;
      operations_unit_id: string;
      original_job_function_id: string | null;
      original_unit_id: string | null;
    }>(`
      select
        operator_membership.id as operator_membership_id,
        admin_membership.id as admin_membership_id,
        operator_membership.organisation_id,
        operations.id as operations_unit_id,
        assignment.job_function_id as original_job_function_id,
        assignment.organisational_unit_id as original_unit_id
      from public.organisation_memberships operator_membership
      join auth.users operator_user
        on operator_user.id = operator_membership.user_id
      join public.organisation_memberships admin_membership
        on admin_membership.organisation_id = operator_membership.organisation_id
      join auth.users admin_user
        on admin_user.id = admin_membership.user_id
      join public.organisation_units operations
        on operations.organisation_id = operator_membership.organisation_id
       and operations.code = 'operations'
       and operations.status = 'active'
      left join public.membership_job_function_assignments assignment
        on assignment.organisation_id = operator_membership.organisation_id
       and assignment.membership_id = operator_membership.id
       and assignment.is_primary = true
       and assignment.valid_to is null
      where operator_user.email = 'operator@apex.local'
        and admin_user.email = 'admin@apex.local'
    `);

    const baseline = rows[0];
    if (
      !baseline?.original_job_function_id ||
      !baseline.original_unit_id ||
      !baseline.operations_unit_id
    ) {
      throw new Error(
        "Demo operator assignment is unavailable for PEOPLE-MOBILE-001.",
      );
    }

    const runKey = Date.now().toString(36);
    const jobFunctionName = unbrokenLabel("JobFunction", 160);
    const areaName =
      "Primary Production Excellence Coordination Area For Cornwall Manufacturing And Continuous Improvement";
    const teamName = unbrokenLabel("TeamUnit", 160);
    const lineName = unbrokenLabel("LineUnit", 160);
    expect(jobFunctionName).toHaveLength(160);
    expect(teamName).toHaveLength(160);
    expect(lineName).toHaveLength(160);
    expect(areaName.length).toBeLessThanOrEqual(160);
    expect(jobFunctionName).not.toMatch(/\s/);
    expect(lineName).not.toMatch(/\s/);

    const { client, organisationId } = await createDemoAdminSession();
    if (organisationId !== baseline.organisation_id) {
      throw new Error("Demo admin session resolved a different organisation.");
    }

    const { data: jobFunctionId, error: jobFunctionError } = await client.rpc(
      "create_job_function",
      {
        target_name: jobFunctionName,
        target_code: `pm001-job-${runKey}`,
      },
    );
    if (jobFunctionError || !jobFunctionId) {
      throw new Error(
        jobFunctionError?.message ?? "Long job function was not created.",
      );
    }

    const unitPlan = [
      {
        code: `pm001-area-${runKey}`,
        name: areaName,
        type: "area",
        parentId: baseline.operations_unit_id,
      },
      {
        code: `pm001-team-${runKey}`,
        name: teamName,
        type: "team",
        parentId: "",
      },
      {
        code: `pm001-line-${runKey}`,
        name: lineName,
        type: "line",
        parentId: "",
      },
    ];
    const createdUnitIds: string[] = [];
    for (const unit of unitPlan) {
      const parentId =
        unit.parentId || createdUnitIds[createdUnitIds.length - 1];
      const { data: unitId, error: unitError } = await client.rpc(
        "create_organisation_unit",
        {
          target_organisation_id: organisationId,
          target_parent_unit_id: parentId,
          unit_code: unit.code,
          unit_name: unit.name,
          unit_type: unit.type,
        },
      );
      if (unitError || !unitId) {
        throw new Error(
          unitError?.message ?? `Unit ${unit.code} was not created.`,
        );
      }
      createdUnitIds.push(unitId as string);
    }

    const lineUnitId = createdUnitIds[createdUnitIds.length - 1]!;
    const { error: assignError } = await client.rpc(
      "assign_membership_job_function",
      {
        target_membership_id: baseline.operator_membership_id,
        target_job_function_id: jobFunctionId,
        target_primary: true,
        target_organisational_unit_id: lineUnitId,
        target_assignment_reason: "PEOPLE-MOBILE-001 layout fixture",
      },
    );
    if (assignError) {
      throw new Error(assignError.message);
    }

    fixture = {
      organisationId,
      operatorMembershipId: baseline.operator_membership_id,
      adminMembershipId: baseline.admin_membership_id,
      jobFunctionId: jobFunctionId as string,
      jobFunctionName,
      lineUnitId,
      lineName,
      unitIdsLeafFirst: [...createdUnitIds].reverse(),
      originalJobFunctionId: baseline.original_job_function_id,
      originalUnitId: baseline.original_unit_id,
      mutated: true,
    };
  });

  test.afterAll(async () => {
    if (!fixture) {
      return;
    }

    const { client } = await createDemoAdminSession();
    if (fixture.mutated) {
      const { error: restoreError } = await client.rpc(
        "assign_membership_job_function",
        {
          target_membership_id: fixture.operatorMembershipId,
          target_job_function_id: fixture.originalJobFunctionId,
          target_primary: true,
          target_organisational_unit_id: fixture.originalUnitId,
          target_assignment_reason:
            "Restore assignment after PEOPLE-MOBILE-001 regression",
        },
      );
      if (restoreError) {
        throw new Error(restoreError.message);
      }
    }

    const { error: deactivateError } = await client.rpc(
      "deactivate_job_function",
      { target_job_function_id: fixture.jobFunctionId },
    );
    if (deactivateError) {
      throw new Error(deactivateError.message);
    }

    for (const unitId of fixture.unitIdsLeafFirst) {
      const { error: retireError } = await client.rpc(
        "set_organisation_unit_status",
        {
          target_organisation_id: fixture.organisationId,
          target_unit_id: unitId,
          target_status: "retired",
          change_reason: "Remove PEOPLE-MOBILE-001 layout fixture",
        },
      );
      if (retireError) {
        throw new Error(retireError.message);
      }
    }
  });

  test("operator cannot assign organisation values for self or others", async ({
    page,
  }) => {
    await signInForAssignmentCheck(page, "operator");
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`/platform/people/${fixture.operatorMembershipId}/admin`);

    await expect(page.getByTestId("member-admin-page")).toBeVisible();
    await expect(page.locator("#member-job-function")).toHaveCount(0);
    await expect(page.locator("#member-primary-unit")).toHaveCount(0);
    await expect(page.getByTestId("save-organisation-assignment")).toHaveCount(
      0,
    );
    await expect(
      page.getByText(
        "Your organisation assignment is managed by an administrator.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("saved-job-function")).toHaveText(
      fixture.jobFunctionName,
    );
    await expect(page.getByTestId("saved-primary-unit")).toHaveText(
      fixture.lineName,
    );
    await expectWrappedText(
      "Saved job function",
      page.getByTestId("saved-job-function"),
    );
    await expectWrappedText(
      "Saved organisation unit",
      page.getByTestId("saved-primary-unit"),
    );

    const selfMetrics = await page.evaluate(() => ({
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      mainScrollWidth:
        document.querySelector("[data-testid='platform-main']")?.scrollWidth ??
        0,
      mainClientWidth:
        document.querySelector("[data-testid='platform-main']")?.clientWidth ??
        0,
      sectionScrollWidth:
        document.querySelector(
          "[data-testid='organisation-assignment-section']",
        )?.scrollWidth ?? 0,
      sectionClientWidth:
        document.querySelector(
          "[data-testid='organisation-assignment-section']",
        )?.clientWidth ?? 0,
    }));
    expect(selfMetrics.documentScrollWidth).toBeLessThanOrEqual(
      selfMetrics.documentClientWidth + 1,
    );
    expect(selfMetrics.mainScrollWidth).toBeLessThanOrEqual(
      selfMetrics.mainClientWidth + 1,
    );
    expect(selfMetrics.sectionScrollWidth).toBeLessThanOrEqual(
      selfMetrics.sectionClientWidth + 1,
    );

    await page.goto(`/platform/people/${fixture.adminMembershipId}/admin`);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(page.locator("#member-job-function")).toHaveCount(0);
  });

  test("long labels stay inside the card, save, and persist", async ({
    page,
  }) => {
    await signInForAssignmentCheck(page, "admin");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/platform/people/${fixture.operatorMembershipId}/admin`);

    await expect(page.getByTestId("member-admin-page")).toBeVisible();
    await expect(organisationSection(page)).toBeVisible();

    const jobSelect = page.getByLabel("Job function", { exact: true });
    const unitSelect = page.getByLabel("Primary organisation unit", {
      exact: true,
    });
    await expect(jobSelect).toHaveAttribute("id", "member-job-function");
    await expect(unitSelect).toHaveAttribute("id", "member-primary-unit");
    await expect(jobSelect).toHaveJSProperty("tagName", "SELECT");
    await expect(unitSelect).toHaveJSProperty("tagName", "SELECT");

    // Persist different values first so the long-label save below cannot pass
    // simply by reloading the assignment installed by beforeAll.
    await jobSelect.selectOption(fixture.originalJobFunctionId);
    await unitSelect.selectOption(fixture.originalUnitId);
    await page.getByTestId("save-organisation-assignment").click();
    await expect(page.getByRole("status")).toHaveText(
      "Organisation assignment updated.",
      { timeout: 30_000 },
    );
    await page.reload();
    await expect(jobSelect).toHaveValue(fixture.originalJobFunctionId);
    await expect(unitSelect).toHaveValue(fixture.originalUnitId);
    expect(fixture.originalJobFunctionId).not.toBe(fixture.jobFunctionId);
    expect(fixture.originalUnitId).not.toBe(fixture.lineUnitId);

    await jobSelect.focus();
    await expect(jobSelect).toBeFocused();
    const valueBeforeKeyboard = await jobSelect.inputValue();
    await page.keyboard.press("ArrowDown");
    await expect(jobSelect).not.toHaveValue(valueBeforeKeyboard);

    await jobSelect.selectOption(fixture.jobFunctionId);
    await unitSelect.selectOption(fixture.lineUnitId);
    await expect(jobSelect).toHaveValue(fixture.jobFunctionId);
    await expect(unitSelect).toHaveValue(fixture.lineUnitId);

    const selectedUnitText = await unitSelect.evaluate((element) => {
      const select = element as HTMLSelectElement;
      return select.selectedOptions[0]?.textContent ?? "";
    });
    expect(selectedUnitText).toContain(" › ");
    expect(selectedUnitText).toContain(fixture.lineName);
    expect(selectedUnitText.length).toBeGreaterThan(fixture.lineName.length);

    await expectClosedSelectsContained(page, {
      name: "390",
      width: 390,
      height: 844,
      columns: 1,
    });

    await page.getByTestId("save-organisation-assignment").click();
    await expect(page.getByRole("status")).toHaveText(
      "Organisation assignment updated.",
      { timeout: 30_000 },
    );
    fixture.mutated = true;

    await page.reload();
    await expect(page.locator("#member-job-function")).toHaveValue(
      fixture.jobFunctionId,
    );
    await expect(page.locator("#member-primary-unit")).toHaveValue(
      fixture.lineUnitId,
    );
    await expect(page.getByTestId("saved-job-function")).toHaveText(
      fixture.jobFunctionName,
    );
    await expect(page.getByTestId("saved-primary-unit")).toHaveText(
      fixture.lineName,
    );

    for (const viewport of viewports) {
      await expectAssignmentLayout(page, viewport);
    }
  });
});
