import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  loginAndSelectOrganisation,
  provisionLeanAiContextE2eUser,
  resolveSupabaseEnv,
  type LeanAiContextE2eUser,
} from "./helpers/leanai-context";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function asOrganisationClient(
  user: LeanAiContextE2eUser,
  organisationName: string,
) {
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
  const organisations = await client.rpc("list_my_eligible_organisations");
  if (organisations.error) {
    throw organisations.error;
  }
  const match = (
    organisations.data as Array<{
      organisation_id: string;
      organisation_name: string;
    }>
  ).find((row) => row.organisation_name === organisationName);
  if (!match) {
    throw new Error(`Organisation ${organisationName} was not listed`);
  }
  const switched = await client.rpc("switch_organisation", {
    target_organisation_id: match.organisation_id,
  });
  if (switched.error) {
    throw switched.error;
  }
  return client;
}

async function countUsage(
  user: LeanAiContextE2eUser,
  organisationName: string,
) {
  const client = await asOrganisationClient(user, organisationName);
  const usage = await client
    .from("ai_usage_events")
    .select("id, model", { count: "exact" });
  if (usage.error) {
    throw usage.error;
  }
  return { count: usage.count ?? 0, rows: usage.data ?? [] };
}

test.describe("LeanAI Coach intelligent Explain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: LeanAiContextE2eUser;

  test.beforeAll(async () => {
    user = await provisionLeanAiContextE2eUser();
  });

  test("explicit Explain uses economy routing and records usage", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const client = await asOrganisationClient(user, user.organisationAName);
    const enabled = await client.rpc("update_organisation_ai_settings", {
      target_ai_enabled: true,
      target_monthly_token_ceiling: 100000,
    });
    if (enabled.error) {
      throw enabled.error;
    }

    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await expect(page.getByTestId("leanai-coach")).toBeVisible();
    const before = await countUsage(user, user.organisationAName);
    expect(before.count).toBe(0);

    await page.getByTestId("leanai-coach-explain-toggle").click();
    await expect(page.getByTestId("leanai-coach-explain")).toBeVisible();
    await expect(page.getByTestId("leanai-coach-explain")).toHaveAttribute(
      "data-explanation-source",
      "ai",
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("leanai-coach-explain-ai")).toContainText(
      /setup step is still incomplete|recommended Lean Excellence Hub route/i,
    );
    await expect(page.getByText("AI-generated guidance")).toBeVisible();
    await page.screenshot({
      path: "/opt/cursor/artifacts/leanai-coach-explain-ai-desktop.png",
      fullPage: true,
    });

    const after = await countUsage(user, user.organisationAName);
    expect(after.count).toBeGreaterThan(0);
    expect(after.rows.some((row) => row.model === "gpt-4.1-nano")).toBe(true);

    await page
      .getByTestId("leanai-coach-follow-up")
      .fill("What should we do after the first site exists?");
    await page.getByTestId("leanai-coach-follow-up-send").click();
    await expect(page.getByTestId("leanai-coach-explain")).toHaveAttribute(
      "data-explanation-source",
      "ai",
    );
    const afterFollowUp = await countUsage(user, user.organisationAName);
    expect(afterFollowUp.count).toBeGreaterThan(after.count);
  });

  test("organisation switch does not leak Coach history", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAndSelectOrganisation(page, user, user.organisationBName);
    await expect(page.getByTestId("leanai-coach")).toBeVisible();
    await expect(page.getByTestId("leanai-coach-explain")).toHaveCount(0);
    await page.getByTestId("leanai-coach-explain-toggle").click();
    await expect(page.getByTestId("leanai-coach-explain")).toBeVisible();
    await expect(page.getByTestId("leanai-coach-explain")).toHaveAttribute(
      "data-explanation-source",
      "static",
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("leanai-coach-explain-static")).toContainText(
      "A site is the first unit",
    );
    expect((await countUsage(user, user.organisationBName)).count).toBe(0);
  });

  test("exhausted monthly ceiling falls back without another billable call", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const client = await asOrganisationClient(user, user.organisationAName);
    const limited = await client.rpc("update_organisation_ai_settings", {
      target_ai_enabled: true,
      target_monthly_token_ceiling: 1,
    });
    if (limited.error) {
      throw limited.error;
    }

    await loginAndSelectOrganisation(page, user, user.organisationAName);
    const before = await countUsage(user, user.organisationAName);
    await page.getByTestId("leanai-coach-explain-toggle").click();
    await expect(page.getByTestId("leanai-coach-explain")).toBeVisible();
    await expect(page.getByTestId("leanai-coach-explain")).toHaveAttribute(
      "data-explanation-source",
      "static",
      { timeout: 30_000 },
    );
    const after = await countUsage(user, user.organisationAName);
    expect(after.count).toBe(before.count);
  });
});
