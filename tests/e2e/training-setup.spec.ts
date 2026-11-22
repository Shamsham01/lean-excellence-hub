import { expect, test } from "@playwright/test";

import { loginAsOnboardingUser } from "./helpers/onboarding-auth";
import {
  enableSkillsAuthoringAi,
  ensureSkillsAuthoringOrganisation,
} from "./helpers/skills-authoring-org";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Training setup journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a local Supabase database",
  );

  test("chooser, quick start mapping, and LeanAI page", async ({ page }) => {
    const organisation = await ensureSkillsAuthoringOrganisation();
    await enableSkillsAuthoringAi(organisation.organisationId);
    await loginAsOnboardingUser(
      page,
      { email: organisation.email, password: organisation.password },
      { organisationName: organisation.organisationName },
    );

    await page.goto("/platform/training/setup");
    await expect(page.getByTestId("training-setup-page")).toBeVisible();
    await expect(page.getByTestId("module-setup-mode-manual")).toBeVisible();
    await expect(
      page.getByTestId("module-setup-mode-quick-start"),
    ).toBeVisible();
    await expect(page.getByTestId("module-setup-mode-leanai")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByTestId("training-terminology-example"),
    ).toBeVisible();

    await page.goto("/platform/training/setup/quick-start");
    await expect(page.getByTestId("training-quick-start")).toBeVisible();
    await expect(
      page.getByTestId("training-pack-leh-manufacturing-training-starter"),
    ).toBeVisible();
    await page.getByTestId("training-role-map-0").selectOption({
      label: organisation.jobFunctionName,
    });
    await expect(page.getByTestId("training-quick-start-create")).toBeEnabled();

    await page.goto("/platform/training/setup/leanai");
    await expect(page.getByTestId("training-leanai-page")).toBeVisible();
    await expect(
      page
        .getByTestId("module-setup-input")
        .or(page.getByTestId("module-setup-builder-unavailable")),
    ).toBeVisible();
  });
});
