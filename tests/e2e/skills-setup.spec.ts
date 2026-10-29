import { existsSync, mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { loginAsOnboardingUser } from "./helpers/onboarding-auth";
import { ensureSkillsAuthoringOrganisation } from "./helpers/skills-authoring-org";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

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
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
}

test.describe("Skills setup journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a local Supabase database",
  );

  test("guided setup, Quick Start, discard, and narrow viewports", async ({
    page,
  }) => {
    const organisation = await ensureSkillsAuthoringOrganisation();
    await loginAsOnboardingUser(
      page,
      { email: organisation.email, password: organisation.password },
      { organisationName: organisation.organisationName },
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/platform/skills/setup");
    await expect(page.getByTestId("skills-setup-page")).toBeVisible();
    await expect(page.getByTestId("skills-terminology")).toBeVisible();
    await expect(page.getByTestId("module-setup-mode-manual")).toBeVisible();
    await expect(
      page.getByTestId("module-setup-mode-quick-start"),
    ).toBeVisible();
    await expect(page.getByTestId("module-setup-mode-leanai")).toBeVisible();
    await capture(page, "skills-setup-chooser-desktop");

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expect(
        page.getByTestId("skills-terminology-example"),
      ).toBeVisible();
      await expectNoDocumentOverflow(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, "skills-setup-chooser-mobile");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/platform/skills/setup/manual");
    await expect(page.getByTestId("skills-manual-setup")).toBeVisible();
    await page.getByTestId("skills-scale-name").fill("Site proficiency");
    const saved = page.waitForResponse((response) => {
      const body = response.request().postData() ?? "";
      return (
        response.request().method() === "POST" &&
        body.includes("Site proficiency")
      );
    });
    await page.getByTestId("skills-save").click();
    const savedResponse = await saved;
    expect(savedResponse.ok()).toBe(true);
    await expect(page.getByTestId("skills-setup-error")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("skills-scale-name")).toHaveValue(
      "Site proficiency",
    );

    await page.getByTestId("skills-next").click();
    await expect(page.getByTestId("skills-catalogue-step")).toBeVisible();
    await page.getByTestId("skills-skill-name-0").fill("Line Operator");
    await expect(page.getByTestId("skills-name-warning")).toBeVisible();
    await page
      .getByTestId("skills-skill-name-0")
      .fill("Operate and monitor the oven");
    await expect(page.getByTestId("skills-name-warning")).toHaveCount(0);
    await page.getByTestId("skills-next").click();
    await expect(page.getByTestId("skills-requirements-step")).toBeVisible();
    await page
      .getByTestId("skills-requirement-job-function")
      .selectOption({ label: organisation.jobFunctionName });
    await page
      .getByTestId("skills-requirement-level")
      .selectOption({ label: "Competent" });
    await page.getByTestId("skills-next").click();
    await expect(page.getByTestId("skills-preview")).toContainText(
      organisation.jobFunctionName,
    );
    await expect(page.getByTestId("skills-preview")).toContainText(
      "Operate and monitor the oven",
    );
    await expect(page.getByTestId("skills-preview")).toContainText(
      "Not assessed is not a low score",
    );
    await capture(page, "skills-setup-manual-preview-desktop");
    await page.getByTestId("skills-publish-setup").click();
    await expect(page.getByTestId("skills-draft-review")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      "Published",
    );
    await expect(page.getByTestId("skills-draft-requirement")).toContainText(
      "Operate and monitor the oven",
    );

    await page.goto("/platform/skills/catalog");
    await expect(page.getByText("Operate and monitor the oven")).toBeVisible();

    await page.goto(
      "/platform/skills/setup/quick-start?pack=leh-general-manufacturing-skills",
    );
    await expect(page.getByTestId("skills-quick-start-form")).toBeVisible();
    await page
      .getByTestId("skills-map-Line Operator")
      .selectOption({ label: organisation.jobFunctionName });
    await expect(page.getByTestId("skills-quick-start-preview")).toContainText(
      organisation.jobFunctionName,
    );
    await page.getByTestId("skills-create-setup-draft").click();
    await expect(page.getByTestId("skills-draft-review")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      "Draft",
    );
    await page.setViewportSize({ width: 320, height: 720 });
    await page.getByTestId("skills-discard-open").click();
    await expect(page.getByTestId("skills-discard-preview")).toBeVisible();
    await expectNoDocumentOverflow(page);
    await capture(page, "skills-setup-discard-mobile");
    await page.getByTestId("skills-discard-confirm").click();
    await expect(page.getByTestId("skills-setup-page")).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/platform/skills/catalog");
    await expect(page.getByText("Operate and monitor the oven")).toBeVisible();

    await page.goto(
      "/platform/skills/setup/quick-start?pack=leh-food-production-skills",
    );
    await expect(page.getByTestId("skills-pack-disclaimer")).toContainText(
      "not a certification",
    );
    await page
      .getByTestId("skills-map-Oven Operator")
      .selectOption({ label: organisation.jobFunctionName });
    await page.getByTestId("skills-create-setup-draft").click();
    await expect(page.getByTestId("skills-draft-review")).toContainText(
      "Sample",
      { timeout: 20_000 },
    );
    await page.getByTestId("skills-discard-open").click();
    await page.getByTestId("skills-discard-confirm").click();
    await expect(page.getByTestId("skills-setup-page")).toBeVisible();

    await page.goto("/platform/skills/setup/leanai");
    await expect(page.getByTestId("skills-builder-quick-start")).toBeVisible();
    await expect(
      page
        .getByTestId("skills-builder-unavailable")
        .or(page.getByTestId("skills-builder")),
    ).toBeVisible();
    await capture(page, "skills-setup-leanai-desktop");
  });
});
