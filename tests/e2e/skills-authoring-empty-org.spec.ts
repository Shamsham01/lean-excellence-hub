import { existsSync, mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { loginAsOnboardingUser } from "./helpers/onboarding-auth";
import { ensureSkillsAuthoringOrganisation } from "./helpers/skills-authoring-org";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function capture(page: Page, name: string) {
  if (!existsSync("/opt/cursor")) {
    return;
  }

  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  await page.screenshot({
    path: `/opt/cursor/artifacts/${name}.png`,
    fullPage: true,
  });
}

async function expectNoDocumentOverflow(page: Page) {
  const overflows = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(overflows).toBe(false);
}

async function runEmptyOrganisationJourney(
  page: Page,
  viewport: { width: number; height: number; label: "desktop" | "mobile" },
) {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });

  const organisation = await ensureSkillsAuthoringOrganisation();
  await loginAsOnboardingUser(
    page,
    { email: organisation.email, password: organisation.password },
    { organisationName: organisation.organisationName },
  );

  await page.goto("/platform/skills");
  await expect(page.getByTestId("skills-empty-state")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Build your skills framework" }),
  ).toBeVisible();
  await expect(page.getByTestId("skills-setup-scales")).toBeVisible();
  await expect(page.getByTestId("skills-setup-catalogue")).toBeVisible();
  await expect(page.getByTestId("skills-setup-requirements")).toBeVisible();
  await expect(page.getByTestId("skills-setup-matrix")).toBeVisible();
  await expectNoDocumentOverflow(page);
  await capture(page, `skills-empty-${viewport.label}`);

  await page.getByTestId("skills-setup-primary").click();
  await expect(page).toHaveURL(/\/platform\/skills\/scales\/new/);
  await expect(page.getByTestId("scale-create-form")).toBeVisible();

  await page.getByTestId("scale-name-input").fill("Operational Proficiency");
  const levels = [
    ["Awareness", "Understands the basic principles."],
    ["Supported", "Can perform with support."],
    ["Competent", "Can perform independently."],
    ["Advanced", "Can coach others and resolve non-standard situations."],
  ] as const;

  for (const [index, [label, description]] of levels.entries()) {
    if (index > 1) {
      await page.getByTestId("scale-add-level").click();
    }
    await page.getByTestId(`scale-level-label-${index}`).fill(label);
    await page
      .getByTestId(`scale-level-description-${index}`)
      .fill(description);
  }

  await expectNoDocumentOverflow(page);
  await capture(page, `skills-scale-draft-${viewport.label}`);
  await page.getByTestId("scale-create-submit").click();
  await expect(page).toHaveURL(/\/platform\/skills\/scales\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("scale-status")).toContainText("Draft");
  await expect(page.getByTestId("scale-saved-levels")).toContainText(
    "Competent",
  );
  await page.getByTestId("scale-publish").click();
  await expect(page.getByTestId("scale-status")).toContainText("Published");
  await expect(page.getByTestId("scale-readonly-note")).toBeVisible();
  await capture(page, `skills-scale-published-${viewport.label}`);

  await page.goto("/platform/skills/catalog?new=1");
  await expect(page.getByTestId("skill-create-form")).toBeVisible();
  await page.getByTestId("skill-name-input").fill("Machine Setup");
  await expect(page.getByTestId("skill-auto-code-preview")).toContainText(
    "machine-setup",
  );
  await page
    .getByTestId("skill-evidence-input")
    .fill("Practical observation on the line.");
  await expectNoDocumentOverflow(page);
  await capture(page, `skills-new-skill-${viewport.label}`);
  await page.getByTestId("skill-create-submit").click();
  await expect(page).toHaveURL(/\/platform\/skills\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Machine Setup" }),
  ).toBeVisible();
  await expect(page.getByTestId("skill-code")).toHaveText("machine-setup");

  await page.goto("/platform/skills/catalog?new=1");
  await page.getByTestId("skill-name-input").fill("Line Clearance");
  await page.getByTestId("skill-create-submit").click();
  await expect(
    page.getByRole("heading", { name: "Line Clearance" }),
  ).toBeVisible();

  await page.goto("/platform/skills/standards/new");
  await page
    .getByTestId("standard-name-input")
    .fill("Production Operator Skills");
  await expect(page.getByTestId("standard-auto-code-preview")).toContainText(
    "production-operator-skills",
  );
  await page.getByTestId("standard-create-submit").click();
  await expect(page).toHaveURL(/\/platform\/skills\/standards\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("standard-status")).toContainText("Draft");
  await page
    .getByTestId("requirement-job-function")
    .selectOption({ label: organisation.jobFunctionName });
  await page.getByTestId("requirement-skill").selectOption({
    label: "Machine Setup",
  });
  await page.getByTestId("requirement-level").selectOption({
    label: "3 — Competent",
  });
  await expect(page.getByTestId("requirement-mandatory")).toBeChecked();
  await page.getByTestId("requirement-evidence").fill("Practical observation");
  await expectNoDocumentOverflow(page);
  await capture(page, `skills-requirement-${viewport.label}`);
  await page.getByTestId("requirement-add").click();
  await expect(page.getByTestId("skills-authoring-feedback")).toHaveText(
    "Requirement saved.",
  );
  await expect(page.getByTestId("standard-requirements")).toContainText(
    "Machine Setup",
  );
  await page.getByTestId("standard-publish").click();
  await expect(page.getByTestId("standard-status")).toContainText("Published");

  await page.goto("/platform/skills/matrix");
  await expect(page.getByTestId("skills-matrix")).toBeVisible();
  const person = page
    .getByRole("link", { name: organisation.displayName })
    .filter({ visible: true })
    .first();
  await expect(person).toBeVisible();
  const personHref = await person.getAttribute("href");
  expect(personHref).toMatch(/\/platform\/people\/[0-9a-f-]{36}$/);
  const membershipId = personHref?.split("/").pop();
  const machineSetup = page
    .getByRole("link", { name: "Machine Setup" })
    .filter({ visible: true })
    .first();
  const skillHref = await machineSetup.getAttribute("href");
  const skillId = skillHref?.split("/").pop();
  const status = page
    .locator(`[data-testid="skills-matrix-status-${membershipId}-${skillId}"]`)
    .filter({ visible: true });
  await expect(status).toContainText("Not assessed");
  await expectNoDocumentOverflow(page);
  await capture(page, `skills-matrix-before-${viewport.label}`);

  await person.click();
  await expect(page.getByTestId("capability-profile-page")).toBeVisible();
  await page.getByTestId("open-skill-assessment").click();
  await expect(page.getByTestId("skill-assessment-dialog")).toBeVisible();
  await page.getByTestId("skill-assessment-skill").selectOption({
    label: "Machine Setup",
  });
  await page.getByTestId("skill-assessment-level").selectOption({
    label: "Competent (3)",
  });
  await capture(page, `skills-assessment-${viewport.label}`);
  await page.getByTestId("skill-assessment-save").click();
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.goto("/platform/skills/matrix");
  await page.reload();
  const updated = page
    .locator(`[data-testid="skills-matrix-status-${membershipId}-${skillId}"]`)
    .filter({ visible: true });
  await expect(updated).toContainText("Meets requirement");
  await capture(page, `skills-matrix-after-${viewport.label}`);
}

test.describe("Skills authoring from an empty organisation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test("desktop: empty state through published matrix assessment", async ({
    page,
  }) => {
    await runEmptyOrganisationJourney(page, {
      width: 1440,
      height: 900,
      label: "desktop",
    });
  });

  test("mobile: setup, requirements, and matrix at 390×844", async ({
    page,
  }) => {
    await runEmptyOrganisationJourney(page, {
      width: 390,
      height: 844,
      label: "mobile",
    });
  });
});
