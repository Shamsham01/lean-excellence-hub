import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  loginAndSelectOrganisation,
  provisionLeanAiContextE2eUser,
  resolveSupabaseEnv,
  type LeanAiContextE2eUser,
} from "./helpers/leanai-context";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const STARTER =
  "Assess how consistently our sites apply our own operating standards";
const RENAMED_PILLAR = "Quality Built In";

async function screenshotIfPossible(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
) {
  try {
    await page.screenshot({
      path: `/opt/cursor/artifacts/${name}`,
      fullPage: options.fullPage ?? true,
    });
  } catch {
    // Artifact directory is optional outside Cloud Agent runs.
  }
}

async function organisationClient(
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

async function tenantCounts(user: LeanAiContextE2eUser, organisation: string) {
  const client = await organisationClient(user, organisation);
  const [usage, models, published] = await Promise.all([
    client.from("ai_usage_events").select("id", { count: "exact", head: true }),
    client.from("maturity_models").select("id", { count: "exact", head: true }),
    client
      .from("maturity_model_versions")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
  ]);
  for (const result of [usage, models, published]) {
    if (result.error) {
      throw result.error;
    }
  }
  return {
    usage: usage.count ?? 0,
    models: models.count ?? 0,
    published: published.count ?? 0,
  };
}

async function enableOrganisationAi(
  user: LeanAiContextE2eUser,
  organisation: string,
) {
  const client = await organisationClient(user, organisation);
  const enabled = await client.rpc("update_organisation_ai_settings", {
    target_ai_enabled: true,
    target_monthly_token_ceiling: 200000,
  });
  if (enabled.error) {
    throw enabled.error;
  }
}

async function expectPreviewCount(
  preview: Locator,
  label: string,
  value: number,
) {
  await expect(
    preview
      .locator("dt", { hasText: label })
      .locator("xpath=following-sibling::dd"),
  ).toHaveText(String(value));
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function startOverIfNeeded(page: Page) {
  const discard = page.getByTestId("maturity-builder-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
    await page.getByTestId("maturity-builder-confirm-discard").click();
    await expect(page.getByTestId("maturity-builder-starters")).toBeVisible({
      timeout: 15_000,
    });
  }
}

test.describe("Maturity framework builder with LeanAI", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: LeanAiContextE2eUser;

  test.beforeAll(async () => {
    user = await provisionLeanAiContextE2eUser();
  });

  test("organisation AI disabled keeps Quick Start and manual paths without a model call", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);

    await page.goto("/platform/maturity/models");
    await expect(
      page.getByTestId("maturity-build-with-leanai-section"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId("maturity-build-with-leanai-unavailable"),
    ).toContainText(/LeanAI is turned off/i);
    await expect(page.getByTestId("maturity-build-with-leanai")).toHaveCount(0);
    await expect(page.getByTestId("maturity-quick-start-card")).toBeVisible();
    await expect(page.locator("#maturity-manual-create")).toBeVisible();

    await page.goto("/platform/maturity/builder");
    await expect(
      page.getByTestId("maturity-builder-unavailable"),
    ).toBeVisible();
    await expect(page.getByTestId("maturity-builder-workspace")).toHaveCount(0);

    expect(await tenantCounts(user, user.organisationAName)).toEqual({
      usage: 0,
      models: 0,
      published: 0,
    });
  });

  test("discovery, proposal, refinement and acceptance create an editable draft only", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await enableOrganisationAi(user, user.organisationAName);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);

    await page.goto("/platform/maturity/models");
    const entry = page.getByTestId("maturity-build-with-leanai");
    await expect(entry).toHaveText("Build with LeanAI", { timeout: 30_000 });
    await screenshotIfPossible(page, "maturity-ai-builder-entry-desktop.png");
    await entry.click();

    await expect(page).toHaveURL(/\/platform\/maturity\/builder$/);
    await expect(page.getByTestId("maturity-builder-starters")).toBeVisible();
    await expect(
      page.getByTestId("maturity-builder-understanding"),
    ).toBeVisible();
    expect((await tenantCounts(user, user.organisationAName)).usage).toBe(0);
    await screenshotIfPossible(page, "maturity-ai-builder-empty-desktop.png");

    await page
      .getByTestId("maturity-builder-starters")
      .getByRole("button", { name: STARTER })
      .click();
    await expect(page.getByTestId("maturity-builder-input")).toHaveValue(
      STARTER,
    );
    await page.getByTestId("maturity-builder-send").click();

    await expect(
      page.getByTestId("maturity-builder-assistant-turn"),
    ).toHaveCount(1, { timeout: 45_000 });
    await expect(page.getByTestId("maturity-builder-questions")).toContainText(
      "Where will you run assessments?",
    );
    await expect(
      page.getByTestId("maturity-builder-understanding"),
    ).toContainText(STARTER);
    await expect(page.getByTestId("maturity-builder-proposal")).toHaveCount(0);
    await screenshotIfPossible(
      page,
      "maturity-ai-builder-discovery-desktop.png",
    );

    await page
      .getByTestId("maturity-builder-questions")
      .getByRole("button", { name: "Sites" })
      .click();
    await expect(page.getByTestId("maturity-builder-input")).toHaveValue(
      /Sites/,
    );
    await page.getByTestId("maturity-builder-input").fill("");
    await page.getByTestId("maturity-builder-propose").click();

    const proposal = page.getByTestId("maturity-builder-proposal");
    await expect(proposal).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("maturity-builder-proposal-name")).toHaveText(
      `${user.organisationAName} Operational Excellence Framework`,
    );
    await expect(
      page.getByTestId("maturity-builder-proposal-badge"),
    ).toContainText(/not saved/i);
    await expect(page.getByTestId("maturity-builder-revision")).toContainText(
      "1",
    );
    const proposalCounts = page.getByTestId("maturity-builder-proposal-counts");
    await expectPreviewCount(proposalCounts, "Levels", 4);
    await expectPreviewCount(proposalCounts, "Pillars", 3);
    await expect(page.getByTestId("maturity-builder-pillar-1")).toContainText(
      "Quality at Source",
    );
    await expect(
      page.getByTestId("maturity-builder-proposal-name"),
    ).toBeFocused();
    await screenshotIfPossible(
      page,
      "maturity-ai-builder-proposal-desktop.png",
    );

    let counts = await tenantCounts(user, user.organisationAName);
    expect(counts.models).toBe(0);
    expect(counts.usage).toBe(2);

    await page
      .getByTestId("maturity-builder-pillar-1")
      .locator("summary")
      .click();
    await page.getByTestId("maturity-builder-refine-pillar-1").click();
    await expect(
      page.getByTestId("maturity-builder-refine-target"),
    ).toContainText("Quality at Source");
    await expect(page.getByTestId("maturity-builder-input")).toBeFocused();
    await page
      .getByTestId("maturity-builder-input")
      .fill(`Rename it to ${RENAMED_PILLAR}`);
    await page.getByTestId("maturity-builder-send").click();

    await expect(page.getByTestId("maturity-builder-revision")).toContainText(
      "2",
      { timeout: 45_000 },
    );
    await expect(page.getByTestId("maturity-builder-pillar-1")).toContainText(
      RENAMED_PILLAR,
    );
    await expect(
      page.getByTestId("maturity-builder-change-summary"),
    ).toContainText(
      `Renamed pillar “Quality at Source” to “${RENAMED_PILLAR}”.`,
    );
    await expect(page.getByTestId("maturity-builder-pillar-0")).toContainText(
      "Safe Work",
    );
    await screenshotIfPossible(page, "maturity-ai-builder-refined-desktop.png");

    counts = await tenantCounts(user, user.organisationAName);
    expect(counts.models).toBe(0);
    expect(counts.usage).toBe(3);

    await page.reload();
    await expect(page.getByTestId("maturity-builder-pillar-1")).toContainText(
      RENAMED_PILLAR,
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("maturity-builder-revision")).toContainText(
      "2",
    );

    await page.getByTestId("maturity-builder-create-draft").click();
    const dialog = page.getByTestId("maturity-builder-create-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Nothing is published/i);
    await screenshotIfPossible(page, "maturity-ai-builder-create-dialog.png", {
      fullPage: false,
    });
    await page.getByTestId("maturity-builder-confirm-create").click();

    await expect(page.getByTestId("framework-editor")).toBeVisible({
      timeout: 45_000,
    });
    await expect(page).toHaveURL(
      /\/platform\/maturity\/models\/.+[?&]step=review/,
    );
    await expect(page.getByText(/v1 · draft/i)).toBeVisible();
    const preview = page.getByTestId("draft-structure-preview");
    await expect(preview).toBeVisible();
    await expectPreviewCount(preview, "Levels", 4);
    await expectPreviewCount(preview, "Pillars", 3);
    await expectPreviewCount(preview, "Criteria", 5);
    await expectPreviewCount(preview, "Scored questions", 7);
    await expect(preview).toContainText(RENAMED_PILLAR);
    await expect(preview).toContainText(
      "Are quality checks built into the process at each step?",
    );
    await expect(page.getByTestId("active-version-heading")).toHaveCount(0);
    await screenshotIfPossible(page, "maturity-ai-builder-draft-editor.png");

    counts = await tenantCounts(user, user.organisationAName);
    expect(counts.models).toBe(1);
    expect(counts.published).toBe(0);
    expect(counts.usage).toBe(3);

    await page.getByTestId("framework-step-levels").click();
    const levelForm = page.getByTestId("edit-level-1");
    await expect(levelForm).toBeVisible();
    await levelForm.getByLabel("Level name").fill("Reacting");
    await levelForm.getByRole("button", { name: "Save level" }).click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Saved.",
    );

    await page.reload();
    await expect(
      page.getByTestId("edit-level-1").getByLabel("Level name"),
    ).toHaveValue("Reacting");
    await page.getByTestId("framework-step-review").click();
    await expect(page.getByTestId("draft-structure-preview")).toContainText(
      "Reacting",
    );
    await expect(page.getByTestId("draft-structure-preview")).toContainText(
      RENAMED_PILLAR,
    );
    await expect(page.getByTestId("active-version-heading")).toHaveCount(0);
    expect((await tenantCounts(user, user.organisationAName)).published).toBe(
      0,
    );

    await page.goto("/platform/maturity/builder");
    await expect(page.getByTestId("maturity-builder-starters")).toBeVisible();
    await expect(page.getByTestId("maturity-builder-proposal")).toHaveCount(0);
  });

  test("malformed LeanAI output is rejected, recorded and retryable", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.goto("/platform/maturity/builder");
    await expect(page.getByTestId("maturity-builder-workspace")).toBeVisible({
      timeout: 30_000,
    });
    await startOverIfNeeded(page);
    const before = await tenantCounts(user, user.organisationAName);

    await page
      .getByTestId("maturity-builder-input")
      .fill("MALFORMED_PROPOSAL_TEST for our sites");
    await page.getByTestId("maturity-builder-send").click();

    await expect(
      page.getByTestId("maturity-builder-invalid-proposal"),
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("maturity-builder-proposal")).toHaveCount(0);
    await expect(page.getByTestId("maturity-builder-retry")).toBeVisible();
    await screenshotIfPossible(page, "maturity-ai-builder-invalid-output.png");

    let after = await tenantCounts(user, user.organisationAName);
    expect(after.usage).toBe(before.usage + 1);
    expect(after.models).toBe(before.models);

    await page.getByTestId("maturity-builder-retry").click();
    await expect(
      page.getByTestId("maturity-builder-invalid-proposal"),
    ).toBeVisible({ timeout: 45_000 });
    after = await tenantCounts(user, user.organisationAName);
    expect(after.usage).toBe(before.usage + 2);
    expect(after.models).toBe(before.models);

    await startOverIfNeeded(page);
    await expect(
      page.getByTestId("maturity-builder-invalid-proposal"),
    ).toHaveCount(0);
  });

  test("mobile keyboard journey reaches a reviewable proposal at 390×844", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.goto("/platform/maturity/builder");
    await expect(page.getByTestId("maturity-builder-workspace")).toBeVisible({
      timeout: 30_000,
    });
    await startOverIfNeeded(page);
    await expectNoHorizontalOverflow(page);
    await screenshotIfPossible(page, "maturity-ai-builder-empty-mobile.png", {
      fullPage: false,
    });

    const prompt = "Assess 5S and visual management in our areas";
    const input = page.getByTestId("maturity-builder-input");
    const send = page.getByTestId("maturity-builder-send");
    await input.scrollIntoViewIfNeeded();
    await expect(send).toBeDisabled();
    await expect(async () => {
      await input.click();
      await expect(input).toBeFocused();
      await input.fill("");
      await input.pressSequentially(prompt);
      await expect(input).toHaveValue(prompt);
      await expect(send).toBeEnabled();
    }).toPass({ timeout: 15_000 });
    await input.press("Control+Enter");
    await expect(
      page.getByTestId("maturity-builder-assistant-turn"),
    ).toHaveCount(1, { timeout: 45_000 });

    const propose = page.getByTestId("maturity-builder-propose");
    await propose.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("maturity-builder-view-toggle")).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      page.getByTestId("maturity-builder-view-proposal"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("maturity-builder-proposal")).toBeVisible();
    await expect(
      page.getByTestId("maturity-builder-conversation-pane"),
    ).toBeHidden();
    await expect(
      page.getByTestId("maturity-builder-create-draft"),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshotIfPossible(
      page,
      "maturity-ai-builder-proposal-mobile.png",
      {
        fullPage: false,
      },
    );

    await page.getByTestId("maturity-builder-refine-criterion-0-0").focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByTestId("maturity-builder-conversation-pane"),
    ).toBeVisible();
    await expect(
      page.getByTestId("maturity-builder-refine-target"),
    ).toContainText("Standard work");
    await expect(input).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByTestId("maturity-builder-refine-target"),
    ).toHaveCount(0);

    await page.getByTestId("maturity-builder-view-proposal").click();
    await page.getByTestId("maturity-builder-create-draft").focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByTestId("maturity-builder-create-dialog"),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByTestId("maturity-builder-create-dialog"),
    ).toBeHidden();
    await expect(
      page.getByTestId("maturity-builder-create-draft"),
    ).toBeFocused();

    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshotIfPossible(
      page,
      "maturity-ai-builder-proposal-mobile-dark.png",
      { fullPage: false },
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await screenshotIfPossible(
      page,
      "maturity-ai-builder-proposal-desktop-dark.png",
    );
    await page.emulateMedia({ colorScheme: "light" });

    expect((await tenantCounts(user, user.organisationAName)).models).toBe(1);
  });

  test("sibling organisation sees no builder conversation or draft", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAndSelectOrganisation(page, user, user.organisationBName);
    await page.goto("/platform/maturity/builder");
    await expect(page.getByTestId("maturity-builder-unavailable")).toBeVisible({
      timeout: 30_000,
    });

    await enableOrganisationAi(user, user.organisationBName);
    await page.reload();
    await expect(page.getByTestId("maturity-builder-starters")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("maturity-builder-transcript")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("maturity-builder-proposal")).toHaveCount(0);
    await expect(page.getByText(RENAMED_PILLAR)).toHaveCount(0);

    expect(await tenantCounts(user, user.organisationBName)).toEqual({
      usage: 0,
      models: 0,
      published: 0,
    });
  });
});
