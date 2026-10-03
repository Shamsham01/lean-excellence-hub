import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  loginAndSelectOrganisation,
  provisionLeanAiContextE2eUser,
  resolveSupabaseEnv,
  ensureLeanAiAssistantOpen,
  type LeanAiContextE2eUser,
} from "./helpers/leanai-context";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

type LeanAiContextSnapshot = {
  applicationAiAvailable: boolean;
  journey: {
    organisationId: string;
    interventionStates: Array<{
      interventionKey: string;
      lastEventKey: string;
      lastDismissedAt: string | null;
      snoozedUntil: string | null;
    }>;
  };
};

async function countAiUsageEvents(page: Page, user: LeanAiContextE2eUser) {
  const snapshot = await readContextualSnapshot(page);
  const { url, publishableKey } = resolveSupabaseEnv();
  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key are required");
  }
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (signedIn.error) {
    throw signedIn.error;
  }
  const switched = await client.rpc("switch_organisation", {
    target_organisation_id: snapshot.journey.organisationId,
  });
  if (switched.error) {
    throw switched.error;
  }
  const usage = await client
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true });
  if (usage.error) {
    throw usage.error;
  }
  return usage.count ?? 0;
}

async function expireInterventionSnooze(page: Page, interventionKey: string) {
  const occurredAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const response = await page.request.post("/api/leanai/context", {
    data: {
      eventKey: "leanai.intervention_snoozed",
      interventionKey,
      moduleKey: "maturity",
      metadata: { snooze_minutes: 15 },
      occurredAt,
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(response.status()).toBe(201);
}

async function readContextualSnapshot(page: Page) {
  const response = await page.request.get("/api/leanai/context");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as LeanAiContextSnapshot;
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
    await ensureLeanAiAssistantOpen(page);

    const coach = page.getByTestId("leanai-coach");
    await expect(coach).toBeVisible();
    await expect(coach).toHaveAttribute(
      "data-intervention-key",
      "sites_first_setup",
    );
    await expect(coach.getByText("LeanAI Coach")).toBeVisible();
    await expect(page.getByTestId("leanai-coach-setup")).toBeVisible();
    await page.getByTestId("leanai-coach-explain-toggle").focus();
    await expect(page.getByTestId("leanai-coach-explain-toggle")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("leanai-coach-explain")).toBeVisible();
    await expect(page.getByTestId("leanai-coach-explain")).not.toHaveAttribute(
      "data-explanation-source",
      "loading",
      { timeout: 30_000 },
    );
    await screenshotIfPossible(page, "leanai-coach-home-desktop.png");

    const snapshot = await readContextualSnapshot(page);
    if (process.env.AI_ENABLED === "0") {
      expect(snapshot.applicationAiAvailable).toBe(false);
    }
    expect(await countAiUsageEvents(page, user)).toBe(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await ensureLeanAiAssistantOpen(page);
    await expect(page.getByTestId("leanai-coach")).toBeVisible();
    await screenshotIfPossible(page, "leanai-coach-home-mobile.png");
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto("/platform/setup");
    await expect(page.getByTestId("setup-page")).toBeVisible();
    await ensureLeanAiAssistantOpen(page);
    await expect(page.getByTestId("leanai-coach")).toHaveAttribute(
      "data-intervention-key",
      "sites_first_setup",
    );
    await screenshotIfPossible(page, "leanai-coach-setup.png");
  });

  test("later persists across reload and does not leak to another organisation", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await ensureLeanAiAssistantOpen(page);
    await expect(page.getByTestId("leanai-coach")).toBeVisible();
    await expect(page.getByTestId("leanai-coach")).toHaveAttribute(
      "data-intervention-key",
      "sites_first_setup",
    );
    await page.getByTestId("leanai-coach-later").click();
    await expect(page.getByTestId("leanai-coach")).toHaveCount(0);

    const afterLater = await readContextualSnapshot(page);
    const dismissed = afterLater.journey.interventionStates.find(
      (state) => state.interventionKey === "sites_first_setup",
    );
    expect(dismissed?.lastEventKey).toBe("leanai.intervention_dismissed");
    expect(dismissed?.lastDismissedAt).toBeTruthy();

    await page.reload();
    await expect(page.getByTestId("platform-home-page")).toBeVisible();
    await ensureLeanAiAssistantOpen(page);
    const afterReload = page.getByTestId("leanai-coach");
    await expect(afterReload).toBeVisible();
    await expect(afterReload).not.toHaveAttribute(
      "data-intervention-key",
      "sites_first_setup",
    );
    await expect(afterReload).toHaveAttribute(
      "data-intervention-key",
      "people_job_functions_setup",
    );

    await page.goto("/select-organisation");
    await page.getByRole("button", { name: user.organisationBName }).click();
    await expect(page).toHaveURL(/\/platform(?:\?|$)/, { timeout: 30_000 });
    await ensureLeanAiAssistantOpen(page);
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
    await ensureLeanAiAssistantOpen(page);
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

    await expireInterventionSnooze(page, "maturity_first_setup");
    await page.reload();
    await expect(page.getByTestId("maturity-overview-page")).toBeVisible();
    await ensureLeanAiAssistantOpen(page);
    await expect(page.getByTestId("leanai-coach")).toHaveAttribute(
      "data-intervention-key",
      "maturity_first_setup",
    );

    await page.goto("/platform/suggestions");
    await expect(page.getByTestId("suggestions-overview")).toBeVisible();
    await ensureLeanAiAssistantOpen(page);
    await expect(page.getByTestId("leanai-coach")).toHaveAttribute(
      "data-intervention-key",
      "suggestions_programme_setup",
    );
    await screenshotIfPossible(page, "leanai-coach-suggestions-empty.png");

    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await page.getByTestId("add-unit-button").click();
    const suffix = Date.now().toString(36);
    await page.locator("#unit-name").fill(`Coach Site ${suffix}`);
    await page.getByTestId("unit-type-choice").selectOption("custom");
    await page.getByTestId("unit-type").fill("site");
    await page.getByTestId("unit-code-edit").click();
    await page.locator("#unit-code").fill(`coach-site-${suffix}`.slice(0, 32));
    await page.getByRole("button", { name: "Create unit" }).click();
    await expect(
      page
        .getByTestId("organisation-unit-tree")
        .getByText(`Coach Site ${suffix}`),
    ).toBeVisible();

    await page.goto("/platform");
    await expect(page.getByTestId("platform-home-page")).toBeVisible();
    await ensureLeanAiAssistantOpen(page);
    await expect(page.getByTestId("leanai-coach")).toHaveAttribute(
      "data-intervention-key",
      "people_job_functions_setup",
    );
    expect(await countAiUsageEvents(page, user)).toBe(0);
  });
});
