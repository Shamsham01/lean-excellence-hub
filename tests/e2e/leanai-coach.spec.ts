import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  loginAndSelectOrganisation,
  provisionLeanAiContextE2eUser,
  resolveSupabaseEnv,
  type LeanAiContextE2eUser,
} from "./helpers/leanai-context";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function countAiUsageEvents(organisationName: string) {
  const { url, serviceRoleKey } = resolveSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase URL and service role key are required");
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const org = await admin
    .from("organisations")
    .select("id")
    .eq("name", organisationName)
    .maybeSingle();
  if (!org.data?.id) {
    return 0;
  }
  const usage = await admin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", org.data.id);
  return usage.count ?? 0;
}

async function screenshotIfPossible(page: Page, name: string) {
  try {
    await page.screenshot({
      path: `/opt/cursor/artifacts/${name}`,
      fullPage: true,
    });
  } catch {
    // Artifact directory is optional outside Cloud Agent runs.
  }
}

test.describe("LeanAI intervention engine and coach UI", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: LeanAiContextE2eUser;

  test.beforeAll(async () => {
    user = await provisionLeanAiContextE2eUser();
  });

  test("fresh organisation home shows a site setup coach without model usage", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await expect(page.getByTestId("platform-home-page")).toBeVisible();

    const coach = page.getByTestId("leanai-coach");
    await expect(coach).toBeVisible();
    await expect(coach).toHaveAttribute(
      "data-intervention-key",
      "sites_first_setup",
    );
    await expect(coach.getByText("LeanAI Coach")).toBeVisible();
    await expect(page.getByTestId("leanai-coach-setup")).toBeVisible();

    await page.getByTestId("leanai-coach-explain-toggle").click();
    await expect(page.getByTestId("leanai-coach-explain")).toBeVisible();
    await screenshotIfPossible(page, "leanai-coach-home-desktop.png");

    expect(await countAiUsageEvents(user.organisationAName)).toBe(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(coach).toBeVisible();
    await screenshotIfPossible(page, "leanai-coach-home-mobile.png");
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("later persists across reload and does not leak to another organisation", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await expect(page.getByTestId("leanai-coach")).toBeVisible();
    await page.getByTestId("leanai-coach-later").click();
    await expect(page.getByTestId("leanai-coach")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("platform-home-page")).toBeVisible();
    await expect(page.getByTestId("leanai-coach")).toHaveCount(0);

    await page.goto("/select-organisation");
    await page.getByRole("button", { name: user.organisationBName }).click();
    await expect(page).toHaveURL(/\/platform(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByTestId("leanai-coach")).toBeVisible();
    await expect(page.getByTestId("leanai-coach")).toHaveAttribute(
      "data-intervention-key",
      "sites_first_setup",
    );
  });

  test("snooze persists on module empty-state and setup completion changes home advice", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAndSelectOrganisation(page, user, user.organisationBName);
    await page.goto("/platform/maturity");
    await expect(page.getByTestId("maturity-overview-page")).toBeVisible();
    const maturityCoach = page.getByTestId("leanai-coach");
    await expect(maturityCoach).toBeVisible();
    await expect(maturityCoach).toHaveAttribute(
      "data-intervention-key",
      "maturity_first_setup",
    );
    await screenshotIfPossible(page, "leanai-coach-maturity-empty.png");
    await page.getByTestId("leanai-coach-snooze").click();
    await expect(page.getByTestId("leanai-coach")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("maturity-overview-page")).toBeVisible();
    await expect(page.getByTestId("leanai-coach")).toHaveCount(0);

    await page.goto("/platform/suggestions");
    await expect(page.getByTestId("suggestions-overview")).toBeVisible();
    await expect(page.getByTestId("leanai-coach")).toHaveAttribute(
      "data-intervention-key",
      "suggestions_programme_setup",
    );
    await screenshotIfPossible(page, "leanai-coach-suggestions-empty.png");

    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    const suffix = Date.now().toString(36);
    await page.locator("#unit-code").fill(`coach-site-${suffix}`.slice(0, 32));
    await page.locator("#unit-name").fill(`Coach Site ${suffix}`);
    await page.locator("#unit-type").fill("site");
    await page.getByRole("button", { name: "Create unit" }).click();
    await expect(page.getByText("Unit created.")).toBeVisible();

    await page.goto("/platform");
    await expect(page.getByTestId("platform-home-page")).toBeVisible();
    await expect(page.getByTestId("leanai-coach")).toHaveAttribute(
      "data-intervention-key",
      "people_job_functions_setup",
    );
  });
});
