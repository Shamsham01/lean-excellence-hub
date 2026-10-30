import { existsSync, mkdirSync } from "node:fs";

import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { loginAsOnboardingUser } from "./helpers/onboarding-auth";
import {
  enableSkillsAuthoringAi,
  ensureSkillsAuthoringOrganisation,
  type SkillsAuthoringOrganisation,
} from "./helpers/skills-authoring-org";
import {
  readSkillsPreparation,
  readSkillsSetupSnapshot,
  recordPublishedSkillsAssessment,
  requirementsForBundle,
  type SkillsSetupSnapshot,
} from "./helpers/skills-setup-records";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const VIEWPORTS = [320, 360, 390, 430, 768, 1440] as const;
const CREATION_KEY_MISMATCH =
  "This setup was already created from different choices";
const ASSESSMENT_NOTES =
  "Observed on the published setup. Training attendance is not competence.";
const MANUAL_SKILL = "Operate and monitor the oven";

const longJobFunction =
  "Production Operator for the Bodmin night-shift deck oven and packing hall";
const longPacking = "Bodmin Packing Hall for the night-shift quality hold";
const longOven = "Bodmin Bakery Oven Hall";
const longExeter = "Exeter Bakery Oven Hall for the south line";
const nestedUnit =
  "Night Shift Deck Oven Line for packing and the quality hold";

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
  if (existsSync("/opt/cursor")) {
    mkdirSync("/opt/cursor/artifacts", { recursive: true });
    await page.screenshot({
      path: `/opt/cursor/artifacts/${name}.png`,
      fullPage: true,
    });
  }
}

async function expectNoDocumentOverflow(page: Page) {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
}

async function expectControlContained(page: Page, testId: string) {
  const main = await page.getByTestId("platform-main").boundingBox();
  const box = await page.getByTestId(testId).boundingBox();
  expect(main, "platform main").not.toBeNull();
  expect(box, testId).not.toBeNull();
  expect(box!.width).toBeGreaterThan(24);
  expect(box!.height).toBeGreaterThan(20);
  expect(box!.x).toBeGreaterThanOrEqual(main!.x - 1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(main!.x + main!.width + 1);
}

async function expectTextFits(locator: Locator) {
  await expect(locator).toBeVisible();
  const clipped = await locator.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  expect(clipped, await locator.innerText()).toBe(false);
}

function bundleIdFromUrl(url: string) {
  const match = url.match(/\/drafts\/([0-9a-f-]{36})/i);
  if (!match?.[1]) {
    throw new Error(`Bundle id was not in ${url}`);
  }
  return match[1];
}

async function waitForDraft(page: Page) {
  await page.waitForURL(/\/platform\/skills\/setup\/drafts\/[0-9a-f-]{36}/i, {
    timeout: 30_000,
  });
  return bundleIdFromUrl(page.url());
}

async function signIn(page: Page, organisation: SkillsAuthoringOrganisation) {
  await loginAsOnboardingUser(
    page,
    { email: organisation.email, password: organisation.password },
    { organisationName: organisation.organisationName },
  );
}

function bundle(snapshot: SkillsSetupSnapshot, bundleId: string) {
  const found = snapshot.bundles.find((item) => item.id === bundleId);
  expect(found, bundleId).toBeTruthy();
  return found!;
}

function unitNames(snapshot: SkillsSetupSnapshot, bundleId: string) {
  return requirementsForBundle(snapshot, bundleId).map(
    (requirement) => requirement.unitName,
  );
}

test.describe("Skills setup recovery and narrow setup forms", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a local Supabase database",
  );

  test("guided manual setup recovers, rejects a changed creation key, and keeps history", async ({
    page,
  }, testInfo) => {
    const organisation = await ensureSkillsAuthoringOrganisation();
    await signIn(page, organisation);

    await page.goto("/platform/skills/setup/manual");
    await page.getByTestId("skills-scale-name").fill("Site proficiency");
    await page.getByTestId("skills-save").click();
    await expect
      .poll(
        async () => {
          const state = (await readSkillsPreparation(
            organisation.organisationId,
            "manual",
            "",
          )) as { scaleName?: string } | null;
          return state?.scaleName ?? "";
        },
        { timeout: 20_000 },
      )
      .toBe("Site proficiency");
    await expect(page.getByTestId("skills-setup-error")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("skills-scale-name")).toHaveValue(
      "Site proficiency",
    );

    await page.getByTestId("skills-next").click();
    await page.getByTestId("skills-skill-name-0").fill(MANUAL_SKILL);
    await page.getByTestId("skills-next").click();
    await page.getByTestId("skills-applicability-units").check();
    await page
      .getByRole("checkbox", {
        name: organisation.bodminPackingPath,
        exact: true,
      })
      .check();
    await page
      .getByRole("checkbox", { name: organisation.bodminOvenPath, exact: true })
      .check();
    await page
      .getByTestId("skills-requirement-job-function")
      .selectOption({ label: organisation.jobFunctionName });
    await page
      .getByTestId("skills-requirement-level")
      .selectOption({ label: "Competent" });
    await page.getByTestId("skills-next").click();
    await expect(page.getByTestId("skills-preview-requirement")).toHaveCount(2);

    await page.getByTestId("skills-create-draft").click();
    const firstId = await waitForDraft(page);
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      "Draft",
    );
    await expect(page.getByTestId("skills-draft-requirement")).toHaveCount(2);
    await page.reload();
    await expect(page.getByTestId("skills-draft-requirement")).toHaveCount(2);
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      organisation.bodminPackingName,
    );
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      organisation.bodminOvenName,
    );
    await expect(page.getByTestId("skills-draft-review")).not.toContainText(
      organisation.exeterOvenName,
    );

    await page.goto("/platform/skills/setup/manual");
    await expect(page.getByTestId("skills-preview")).toBeVisible();
    await page.getByTestId("skills-create-draft").click();
    expect(await waitForDraft(page)).toBe(firstId);
    let snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(snapshot.bundles.map((item) => item.id)).toEqual([firstId]);
    expect(bundle(snapshot, firstId).status).toBe("draft");
    expect(bundle(snapshot, firstId).applicability).toBe("units");
    expect(
      requirementsForBundle(snapshot, firstId).map(
        (requirement) => requirement.levelLabel,
      ),
    ).toEqual(["Competent", "Competent"]);
    expect(unitNames(snapshot, firstId).sort()).toEqual(
      [organisation.bodminOvenName, organisation.bodminPackingName].sort(),
    );

    await page.goto("/platform/skills/setup/manual");
    await page.getByRole("button", { name: "Back" }).click();
    await page
      .getByTestId("skills-requirement-level")
      .selectOption({ label: "Aware" });
    await page.getByTestId("skills-next").click();
    await expect(page.getByTestId("skills-preview")).toContainText('"Aware"');
    await page.getByTestId("skills-create-draft").click();
    await expect(page.getByTestId("skills-setup-error")).toContainText(
      CREATION_KEY_MISMATCH,
      { timeout: 20_000 },
    );
    await expect(page).toHaveURL(/\/platform\/skills\/setup\/manual/);
    await capture(page, testInfo, "skills-recovery-manual-rejection");
    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(snapshot.bundles).toHaveLength(1);
    expect(
      requirementsForBundle(snapshot, firstId).every(
        (requirement) => requirement.levelLabel === "Competent",
      ),
    ).toBe(true);

    await page.goto(`/platform/skills/setup/drafts/${firstId}`);
    await page.getByTestId("skills-discard-open").click();
    await page.getByTestId("skills-discard-confirm").click();
    await page.waitForURL(/\/platform\/skills\/setup$/);
    await page.goto("/platform/skills/setup/manual");
    await expect(page.getByTestId("skills-preview")).toContainText('"Aware"');
    await page.getByTestId("skills-create-draft").click();
    const recreatedId = await waitForDraft(page);
    expect(recreatedId).not.toBe(firstId);
    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(bundle(snapshot, firstId).status).toBe("discarded");
    expect(bundle(snapshot, recreatedId).status).toBe("draft");
    expect(
      requirementsForBundle(snapshot, recreatedId).map(
        (requirement) => requirement.levelLabel,
      ),
    ).toEqual(["Aware", "Aware"]);

    await page.getByTestId("skills-publish").click();
    await page.waitForURL(/\/platform\/skills\/matrix/, { timeout: 30_000 });
    const assessment = await recordPublishedSkillsAssessment({
      organisationId: organisation.organisationId,
      bundleId: recreatedId,
      notes: ASSESSMENT_NOTES,
    });
    await page.goto(`/platform/skills/setup/drafts/${recreatedId}`);
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      "Published",
    );
    await expect(page.getByTestId("skills-discard-open")).toHaveCount(0);

    await page.goto("/platform/skills/setup/manual");
    await page.getByTestId("skills-start-new-setup").click();
    await expect(page.getByTestId("skills-start-new-setup")).toBeEnabled();
    await page.getByRole("button", { name: "Back" }).click();
    await page
      .getByTestId("skills-requirement-level")
      .selectOption({ label: "Developing" });
    await page.getByTestId("skills-next").click();
    await page.getByTestId("skills-create-draft").click();
    const changedId = await waitForDraft(page);
    expect(changedId).not.toBe(recreatedId);
    await page.getByTestId("skills-discard-open").click();
    await page.getByTestId("skills-discard-confirm").click();
    await page.waitForURL(/\/platform\/skills\/setup$/);

    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(bundle(snapshot, recreatedId).status).toBe("published");
    expect(bundle(snapshot, changedId).status).toBe("discarded");
    expect(
      requirementsForBundle(snapshot, recreatedId).map(
        (requirement) => requirement.levelLabel,
      ),
    ).toEqual(["Aware", "Aware"]);
    expect(
      requirementsForBundle(snapshot, recreatedId).every(
        (requirement) => requirement.skillStatus === "active",
      ),
    ).toBe(true);
    const publishedScale = snapshot.scaleVersions.find(
      (version) => version.id === bundle(snapshot, recreatedId).scaleVersionId,
    );
    expect(publishedScale?.status).toBe("published");
    expect(snapshot.assessments).toEqual([
      expect.objectContaining({
        id: assessment.assessmentId,
        skillId: assessment.skillId,
        levelId: assessment.levelId,
        notes: ASSESSMENT_NOTES,
        status: "active",
      }),
    ]);
  });

  test("Quick Start recovers, rejects a changed creation key, and keeps history", async ({
    page,
  }, testInfo) => {
    const organisation = await ensureSkillsAuthoringOrganisation();
    await signIn(page, organisation);
    await page.goto(
      "/platform/skills/setup/quick-start?pack=leh-food-production-skills",
    );
    await page
      .getByTestId("skills-map-Oven Operator")
      .selectOption({ label: organisation.jobFunctionName });
    await page.getByTestId("skills-quick-start-units").check();
    await page
      .getByRole("checkbox", {
        name: organisation.bodminPackingPath,
        exact: true,
      })
      .check();
    await page
      .getByRole("checkbox", { name: organisation.bodminOvenPath, exact: true })
      .check();
    await expect(page.getByTestId("skills-quick-start-preview")).toContainText(
      organisation.bodminOvenPath,
    );
    await expect
      .poll(
        async () => {
          const state = (await readSkillsPreparation(
            organisation.organisationId,
            "quick_start",
            "leh-food-production-skills",
          )) as {
            unitIds?: string[];
            roleMappings?: Array<{ jobFunctionId: string | null }>;
          } | null;
          return (
            (state?.unitIds?.length ?? 0) >= 2 &&
            Boolean(
              state?.roleMappings?.some((mapping) => mapping.jobFunctionId),
            )
          );
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByTestId("skills-selected-Oven Operator")).toHaveText(
      organisation.jobFunctionName,
    );
    await expect(
      page.getByRole("checkbox", {
        name: organisation.bodminPackingPath,
        exact: true,
      }),
    ).toBeChecked();

    await page.getByTestId("skills-create-setup-draft").click();
    const firstId = await waitForDraft(page);
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      "Sample",
    );
    await page.reload();
    await expect(
      page.getByTestId("skills-draft-requirement").first(),
    ).toBeVisible();
    let snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(bundle(snapshot, firstId).source).toBe("quick_start");
    expect(bundle(snapshot, firstId).applicability).toBe("units");
    expect(new Set(unitNames(snapshot, firstId))).toEqual(
      new Set([organisation.bodminPackingName, organisation.bodminOvenName]),
    );

    await page.goto(
      "/platform/skills/setup/quick-start?pack=leh-food-production-skills",
    );
    await page.getByTestId("skills-create-setup-draft").click();
    expect(await waitForDraft(page)).toBe(firstId);
    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(snapshot.bundles).toHaveLength(1);

    await page.goto(
      "/platform/skills/setup/quick-start?pack=leh-food-production-skills",
    );
    await page
      .getByRole("checkbox", { name: organisation.exeterOvenPath, exact: true })
      .check();
    await page.getByTestId("skills-create-setup-draft").click();
    await expect(page.getByTestId("skills-setup-error")).toContainText(
      CREATION_KEY_MISMATCH,
      { timeout: 20_000 },
    );
    await capture(page, testInfo, "skills-recovery-quick-start-rejection");
    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(snapshot.bundles).toHaveLength(1);
    expect(unitNames(snapshot, firstId)).not.toContain(
      organisation.exeterOvenName,
    );

    await page.goto(`/platform/skills/setup/drafts/${firstId}`);
    await page.getByTestId("skills-discard-open").click();
    await page.getByTestId("skills-discard-confirm").click();
    await page.waitForURL(/\/platform\/skills\/setup$/);
    await page.goto(
      "/platform/skills/setup/quick-start?pack=leh-food-production-skills",
    );
    await page.getByTestId("skills-create-setup-draft").click();
    const recreatedId = await waitForDraft(page);
    expect(recreatedId).not.toBe(firstId);
    await page.getByTestId("skills-publish").click();
    await page.waitForURL(/\/platform\/skills\/matrix/, { timeout: 30_000 });
    const assessment = await recordPublishedSkillsAssessment({
      organisationId: organisation.organisationId,
      bundleId: recreatedId,
      notes: ASSESSMENT_NOTES,
    });

    await page.goto(
      "/platform/skills/setup/quick-start?pack=leh-food-production-skills",
    );
    await page.getByTestId("skills-start-new-setup").click();
    await expect(page.getByTestId("skills-start-new-setup")).toBeEnabled();
    await page
      .getByRole("checkbox", { name: organisation.exeterOvenPath, exact: true })
      .uncheck();
    await page.getByTestId("skills-create-setup-draft").click();
    const changedId = await waitForDraft(page);
    expect(changedId).not.toBe(recreatedId);
    await page.getByTestId("skills-discard-open").click();
    await page.getByTestId("skills-discard-confirm").click();
    await page.waitForURL(/\/platform\/skills\/setup$/);

    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(bundle(snapshot, firstId).status).toBe("discarded");
    expect(bundle(snapshot, recreatedId).status).toBe("published");
    expect(bundle(snapshot, changedId).status).toBe("discarded");
    expect(new Set(unitNames(snapshot, recreatedId))).toEqual(
      new Set([
        organisation.bodminPackingName,
        organisation.bodminOvenName,
        organisation.exeterOvenName,
      ]),
    );
    expect(unitNames(snapshot, recreatedId).length).toBeGreaterThan(0);
    expect(
      requirementsForBundle(snapshot, recreatedId).every(
        (requirement) => requirement.skillStatus === "active",
      ),
    ).toBe(true);
    expect(snapshot.assessments).toEqual([
      expect.objectContaining({
        id: assessment.assessmentId,
        notes: ASSESSMENT_NOTES,
        status: "active",
      }),
    ]);
  });

  test("LeanAI proposal acceptance recovers and keeps published history", async ({
    page,
  }, testInfo) => {
    const organisation = await ensureSkillsAuthoringOrganisation();
    await enableSkillsAuthoringAi(organisation.organisationId);
    await signIn(page, organisation);
    await page.goto("/platform/skills/setup/leanai");
    await page
      .getByTestId("skills-builder-message")
      .fill("Set up oven capability for the Bodmin bakery.");
    await page.getByTestId("skills-builder-send").click();
    await expect(page.getByTestId("skills-builder-proposal-title")).toHaveText(
      "Bakery oven capability",
      { timeout: 30_000 },
    );
    await page.reload();
    await expect(page.getByTestId("skills-builder-proposal-title")).toHaveText(
      "Bakery oven capability",
    );
    await page
      .getByTestId("skills-builder-map-Oven Operator")
      .selectOption({ label: organisation.jobFunctionName });
    await page.getByTestId("skills-builder-units").check();
    await page
      .getByRole("checkbox", {
        name: organisation.bodminPackingPath,
        exact: true,
      })
      .check();
    await page
      .getByRole("checkbox", { name: organisation.bodminOvenPath, exact: true })
      .check();
    await expect
      .poll(
        async () => {
          const state = (await readSkillsPreparation(
            organisation.organisationId,
            "leanai",
            "leanai-skills-builder",
          )) as {
            unitIds?: string[];
            roleMappings?: Array<{ jobFunctionId: string | null }>;
          } | null;
          return (
            (state?.unitIds?.length ?? 0) >= 2 &&
            Boolean(
              state?.roleMappings?.some((mapping) => mapping.jobFunctionId),
            )
          );
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByTestId("skills-selected-Oven Operator")).toHaveText(
      organisation.jobFunctionName,
    );
    await expect(
      page.getByRole("checkbox", {
        name: organisation.bodminOvenPath,
        exact: true,
      }),
    ).toBeChecked();

    await page.getByTestId("skills-builder-create").click();
    const firstId = await waitForDraft(page);
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      "Operate and monitor the oven",
    );
    await page.reload();
    await expect(page.getByTestId("skills-draft-requirement")).toHaveCount(2);
    let snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(bundle(snapshot, firstId).source).toBe("leanai");
    expect(bundle(snapshot, firstId).title).toBe("Bakery oven capability");
    expect(bundle(snapshot, firstId).status).toBe("draft");
    expect(new Set(unitNames(snapshot, firstId))).toEqual(
      new Set([organisation.bodminPackingName, organisation.bodminOvenName]),
    );

    await page.goto("/platform/skills/setup/leanai");
    await expect(page.getByTestId("skills-builder-proposal-title")).toHaveText(
      "Bakery oven capability",
    );
    await page.getByTestId("skills-builder-create").click();
    expect(await waitForDraft(page)).toBe(firstId);
    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(snapshot.bundles).toHaveLength(1);

    await page.goto("/platform/skills/setup/leanai");
    await page
      .getByRole("checkbox", { name: organisation.exeterOvenPath, exact: true })
      .check();
    await page.getByTestId("skills-builder-create").click();
    await expect(page.getByTestId("skills-builder-error")).toContainText(
      CREATION_KEY_MISMATCH,
      { timeout: 20_000 },
    );
    await capture(page, testInfo, "skills-recovery-leanai-rejection");
    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(unitNames(snapshot, firstId)).not.toContain(
      organisation.exeterOvenName,
    );

    await page.goto(`/platform/skills/setup/drafts/${firstId}`);
    await page.getByTestId("skills-discard-open").click();
    await page.getByTestId("skills-discard-confirm").click();
    await page.waitForURL(/\/platform\/skills\/setup$/);
    await page.goto("/platform/skills/setup/leanai");
    await page.getByTestId("skills-builder-create").click();
    const recreatedId = await waitForDraft(page);
    expect(recreatedId).not.toBe(firstId);
    await page.getByTestId("skills-publish").click();
    await page.waitForURL(/\/platform\/skills\/matrix/, { timeout: 30_000 });
    const assessment = await recordPublishedSkillsAssessment({
      organisationId: organisation.organisationId,
      bundleId: recreatedId,
      notes: ASSESSMENT_NOTES,
    });

    await page.goto("/platform/skills/setup/leanai");
    await page.getByTestId("skills-start-new-setup").click();
    await expect(page.getByTestId("skills-start-new-setup")).toBeEnabled();
    await page
      .getByRole("checkbox", { name: organisation.exeterOvenPath, exact: true })
      .uncheck();
    await page.getByTestId("skills-builder-create").click();
    const changedId = await waitForDraft(page);
    expect(changedId).not.toBe(recreatedId);
    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(new Set(unitNames(snapshot, changedId))).toEqual(
      new Set([organisation.bodminPackingName, organisation.bodminOvenName]),
    );
    expect(new Set(unitNames(snapshot, recreatedId))).toEqual(
      new Set([
        organisation.bodminPackingName,
        organisation.bodminOvenName,
        organisation.exeterOvenName,
      ]),
    );
    await page.getByTestId("skills-discard-open").click();
    await page.getByTestId("skills-discard-confirm").click();
    await page.waitForURL(/\/platform\/skills\/setup$/);

    snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(bundle(snapshot, firstId).status).toBe("discarded");
    expect(bundle(snapshot, recreatedId).status).toBe("published");
    expect(bundle(snapshot, changedId).status).toBe("discarded");
    expect(
      requirementsForBundle(snapshot, recreatedId).every(
        (requirement) =>
          requirement.skillName === "Operate and monitor the oven" &&
          requirement.levelLabel === "Competent" &&
          requirement.skillStatus === "active",
      ),
    ).toBe(true);
    const publishedScale = snapshot.scaleVersions.find(
      (version) => version.id === bundle(snapshot, recreatedId).scaleVersionId,
    );
    expect(publishedScale?.status).toBe("published");
    expect(snapshot.assessments).toEqual([
      expect.objectContaining({
        id: assessment.assessmentId,
        notes: ASSESSMENT_NOTES,
        status: "active",
      }),
    ]);
  });

  test("setup forms stay usable from 320px through 1440px", async ({
    page,
  }, testInfo) => {
    for (const label of [
      longJobFunction,
      longPacking,
      longOven,
      longExeter,
      nestedUnit,
    ]) {
      expect(label.length).toBeLessThanOrEqual(160);
    }
    const organisation = await ensureSkillsAuthoringOrganisation({
      jobFunctionName: longJobFunction,
      bodminPackingName: longPacking,
      bodminOvenName: longOven,
      exeterOvenName: longExeter,
      nestedUnitName: nestedUnit,
    });
    expect(organisation.nestedUnitPath).toBeTruthy();
    await enableSkillsAuthoringAi(organisation.organisationId);
    await signIn(page, organisation);

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/platform/skills/setup/manual");
    await page
      .getByTestId("skills-scale-name")
      .fill("Morning bakery proficiency for the Bodmin oven teams");
    await page.getByTestId("skills-next").click();
    await page
      .getByTestId("skills-skill-name-0")
      .fill("Operate and monitor the deck oven through the night-shift bake");
    await page.getByTestId("skills-next").click();
    await page.getByTestId("skills-applicability-units").check();
    await expectTextFits(
      page
        .getByTestId("skills-unit-list")
        .getByText(organisation.nestedUnitPath!, { exact: true }),
    );
    await page
      .getByRole("checkbox", {
        name: organisation.bodminPackingPath,
        exact: true,
      })
      .check();
    await page
      .getByRole("checkbox", {
        name: organisation.nestedUnitPath!,
        exact: true,
      })
      .check();
    await page
      .getByTestId("skills-requirement-job-function")
      .selectOption({ label: longJobFunction });
    await page
      .getByTestId("skills-requirement-level")
      .selectOption({ label: "Competent" });
    await expect(page.getByTestId("skills-selected-job-function")).toHaveText(
      longJobFunction,
    );
    await expectTextFits(page.getByTestId("skills-selected-job-function"));
    await expectNoDocumentOverflow(page);
    await expectControlContained(page, "skills-manual-setup");
    await expectControlContained(page, "skills-requirement-job-function");
    await expectControlContained(page, "skills-next");
    await capture(page, testInfo, "skills-setup-manual-320");
    await page.getByTestId("skills-next").click();

    await page.setViewportSize({ width: 360, height: 740 });
    await expect(page.getByTestId("skills-preview")).toContainText(
      organisation.nestedUnitPath!,
    );
    await expect(page.getByTestId("skills-preview")).toContainText(
      longJobFunction,
    );
    await expectTextFits(
      page
        .getByTestId("skills-preview")
        .getByText(organisation.nestedUnitPath!, { exact: false })
        .first(),
    );
    await expectNoDocumentOverflow(page);
    await expectControlContained(page, "skills-create-draft");
    await expectControlContained(page, "skills-publish-setup");
    await capture(page, testInfo, "skills-setup-manual-preview-360");
    await page.getByTestId("skills-create-draft").click();
    const manualDraftId = await waitForDraft(page);
    await expect(page.getByTestId("skills-draft-requirement")).toHaveCount(2);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      "/platform/skills/setup/quick-start?pack=leh-food-production-skills",
    );
    await page
      .getByTestId("skills-map-Oven Operator")
      .selectOption({ label: longJobFunction });
    await page.getByTestId("skills-quick-start-units").check();
    await page
      .getByRole("checkbox", {
        name: organisation.nestedUnitPath!,
        exact: true,
      })
      .check();
    await expect(page.getByTestId("skills-selected-Oven Operator")).toHaveText(
      longJobFunction,
    );
    await expect(page.getByTestId("skills-quick-start-preview")).toContainText(
      organisation.nestedUnitPath!,
    );
    await expectTextFits(
      page
        .getByTestId("skills-unit-list")
        .getByText(organisation.nestedUnitPath!, { exact: true }),
    );
    await expectNoDocumentOverflow(page);
    await expectControlContained(page, "skills-create-setup-draft");
    await expectControlContained(page, "skills-map-Oven Operator");
    await capture(page, testInfo, "skills-setup-quick-start-390");
    await page.getByTestId("skills-create-setup-draft").click();
    const quickStartDraftId = await waitForDraft(page);

    await page.setViewportSize({ width: 430, height: 932 });
    await page.getByTestId("skills-discard-open").click();
    await expect(page.getByTestId("skills-discard-preview")).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectControlContained(page, "skills-discard-confirm");
    await capture(page, testInfo, "skills-setup-discard-430");
    await page.getByTestId("skills-discard-confirm").click();
    await page.waitForURL(/\/platform\/skills\/setup$/);
    await page.goto(`/platform/skills/setup/drafts/${manualDraftId}`);
    await expectControlContained(page, "skills-publish");
    await expectControlContained(page, "skills-discard-open");
    await capture(page, testInfo, "skills-setup-publish-430");
    await page.getByTestId("skills-publish").click();
    await page.waitForURL(/\/platform\/skills\/matrix/, { timeout: 30_000 });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/platform/skills/setup/leanai");
    await page
      .getByTestId("skills-builder-message")
      .fill("Map the oven role for the long Bodmin line.");
    await page.getByTestId("skills-builder-send").click();
    await expect(page.getByTestId("skills-builder-proposal-title")).toHaveText(
      "Bakery oven capability",
      { timeout: 30_000 },
    );
    await page
      .getByTestId("skills-builder-map-Oven Operator")
      .selectOption({ label: longJobFunction });
    await page.getByTestId("skills-builder-units").check();
    await page
      .getByRole("checkbox", {
        name: organisation.nestedUnitPath!,
        exact: true,
      })
      .check();
    await expect(page.getByTestId("skills-selected-Oven Operator")).toHaveText(
      longJobFunction,
    );
    await expectTextFits(
      page
        .getByTestId("skills-unit-list")
        .getByText(organisation.nestedUnitPath!, { exact: true }),
    );
    await expectNoDocumentOverflow(page);
    await expectControlContained(page, "skills-builder-create");
    await expectControlContained(page, "skills-builder-map-Oven Operator");
    await capture(page, testInfo, "skills-setup-leanai-768");
    await page.getByTestId("skills-builder-create").click();
    await waitForDraft(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      organisation.nestedUnitName!,
    );
    await expectNoDocumentOverflow(page);
    await expectControlContained(page, "skills-publish");
    await expectControlContained(page, "skills-discard-open");
    await page.getByTestId("skills-discard-open").click();
    await expect(page.getByTestId("skills-discard-preview")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("skills-discard-preview")).toBeHidden();
    await capture(page, testInfo, "skills-setup-draft-1440");
    await page.getByTestId("skills-publish").click();
    await page.waitForURL(/\/platform\/skills\/matrix/, { timeout: 30_000 });

    const snapshot = await readSkillsSetupSnapshot(organisation.organisationId);
    expect(bundle(snapshot, manualDraftId).status).toBe("published");
    expect(bundle(snapshot, quickStartDraftId).status).toBe("discarded");
    const leanAiBundle = snapshot.bundles.find(
      (item) => item.source === "leanai",
    );
    expect(leanAiBundle?.status).toBe("published");
    expect(VIEWPORTS).toEqual([320, 360, 390, 430, 768, 1440]);
  });
});
