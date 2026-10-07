import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  loginAndSelectOrganisation,
  provisionLeanAiContextE2eUser,
  resolveSupabaseEnv,
  type LeanAiContextE2eUser,
} from "./helpers/leanai-context";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `/opt/cursor/artifacts/${name}`,
    fullPage: true,
  });
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
  return { client, organisationId: match.organisation_id };
}

async function ensureSite(
  user: LeanAiContextE2eUser,
  organisationName: string,
  unitCode: string,
) {
  const { client, organisationId } = await organisationClient(
    user,
    organisationName,
  );
  const existing = await client
    .from("organisation_units")
    .select("id")
    .eq("code", unitCode)
    .maybeSingle();
  if (existing.data?.id) {
    return;
  }
  const created = await client.rpc("create_organisation_unit", {
    target_organisation_id: organisationId,
    target_parent_unit_id: null,
    unit_code: unitCode,
    unit_name: "Packing Site",
    unit_type: "site",
  });
  if (created.error) {
    throw created.error;
  }
}

async function setOrganisationAi(
  user: LeanAiContextE2eUser,
  organisationName: string,
  enabled: boolean,
  ceiling: number,
) {
  const { client } = await organisationClient(user, organisationName);
  const updated = await client.rpc("update_organisation_ai_settings", {
    target_ai_enabled: enabled,
    target_monthly_token_ceiling: ceiling,
  });
  if (updated.error) {
    throw updated.error;
  }
}

async function usageCount(
  user: LeanAiContextE2eUser,
  organisationName: string,
) {
  const { client } = await organisationClient(user, organisationName);
  const usage = await client
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true });
  if (usage.error) {
    throw usage.error;
  }
  return usage.count ?? 0;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function chooseFirstUnit(page: Page) {
  await page.getByTestId("applicable-unit-checkbox").first().check();
}

test.describe("5S and Gemba guided setup", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: LeanAiContextE2eUser;

  test.beforeAll(async () => {
    user = await provisionLeanAiContextE2eUser();
    await ensureSite(user, user.organisationAName, "setup-site-a");
    await ensureSite(user, user.organisationBName, "setup-site-b");
    await setOrganisationAi(user, user.organisationAName, true, 200000);
  });

  test("5S Quick Start creates an editable unpublished draft", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.goto("/platform/5s");
    await page.getByRole("link", { name: "Set up 5S" }).click();
    await expect(page.getByTestId("module-setup-chooser")).toBeVisible();
    await expect(page.getByTestId("module-setup-mode-manual")).toBeVisible();
    await expect(
      page.getByTestId("module-setup-mode-quick-start"),
    ).toBeVisible();
    await expect(page.getByTestId("module-setup-mode-leanai")).toBeVisible();
    await screenshot(page, "5s-setup-chooser-desktop.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "5s-setup-chooser-mobile.png");
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.getByTestId("module-setup-mode-quick-start").click();
    await expect(
      page.getByRole("heading", { name: "LEH Workplace 5S Standard" }),
    ).toBeVisible();
    await expect(
      page.getByText("Are unused items removed from the work area?"),
    ).toBeVisible();
    await screenshot(page, "5s-quick-start-preview.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await chooseFirstUnit(page);
    await page.getByTestId("module-setup-deploy").click();
    await expect(
      page.getByRole("heading", { name: "LEH Workplace 5S Standard" }),
    ).toBeVisible();
    await expect(page.getByTestId("five-s-draft-boundary")).toBeVisible();
    await expect(page.getByTestId("authoring-section")).toHaveCount(5);
    await expect(page.getByText(/v1 · published/i)).toHaveCount(0);
    await page
      .getByTestId("five-s-question-prompt")
      .first()
      .fill("Extra packing check");
    await page.getByRole("button", { name: "Add question" }).first().click();
    await expect(page.getByText("Extra packing check")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Extra packing check")).toBeVisible();
    await screenshot(page, "5s-created-draft.png");
    await page.getByTestId("publish-five-s-standard").click();
    await expect(page.getByText(/v1 · published/i)).toBeVisible();

    await page.goto("/platform/5s");
    await expect(page.getByTestId("five-s-overview-page")).toBeVisible();
    await expect(page.getByTestId("five-s-standard-list")).toContainText(
      "LEH Workplace 5S Standard",
    );
    await expect(page.getByTestId("five-s-new-standard")).toBeVisible();
  });

  test("5S LeanAI proposes a draft only after an explicit turn", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const before = await usageCount(user, user.organisationAName);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.goto("/platform/5s/setup/leanai");
    await expect(page.getByTestId("module-setup-builder")).toBeVisible();
    await expect(page.getByTestId("module-setup-proposal")).toContainText(
      "Nothing is proposed yet",
    );
    expect(await usageCount(user, user.organisationAName)).toBe(before);

    await page
      .getByTestId("module-setup-input")
      .fill("Packing area workplace check");
    await page.getByTestId("module-setup-send").click();
    await expect(page.getByTestId("module-setup-question")).toBeVisible({
      timeout: 30_000,
    });
    expect(await usageCount(user, user.organisationAName)).toBe(before + 1);

    await page.getByTestId("module-setup-propose").click();
    await expect(page.getByTestId("module-setup-proposal-name")).toHaveText(
      "Packing 5S Standard",
      { timeout: 30_000 },
    );
    await screenshot(page, "5s-leanai-proposal.png");

    await page.getByRole("button", { name: "Refine" }).first().click();
    await page
      .getByTestId("module-setup-input")
      .fill("Use plainer category language");
    await page.getByTestId("module-setup-send").click();
    await expect(
      page.getByRole("heading", { name: "Sort and separate" }),
    ).toBeVisible({
      timeout: 30_000,
    });

    await page
      .getByTestId("module-setup-input")
      .fill("MALFORMED_PROPOSAL_TEST");
    await page.getByTestId("module-setup-propose").click();
    await expect(page.getByTestId("module-setup-proposal-issues")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("module-setup-proposal-name")).toHaveText(
      "Packing 5S Standard",
    );

    await page.getByTestId("module-setup-create-draft").click();
    await page
      .locator('input[name="proposalMessageId"]')
      .evaluate((element) => {
        (element as HTMLInputElement).value =
          "00000000-0000-4000-8000-000000000099";
      });
    await page.getByTestId("module-setup-confirm-create").click();
    await expect(page.getByTestId("module-setup-create-error")).toContainText(
      "no longer the latest",
    );

    await page.goto("/platform/5s/setup/leanai");
    await expect(page.getByTestId("module-setup-proposal-name")).toHaveText(
      "Packing 5S Standard",
    );
    await page.getByTestId("module-setup-create-draft").click();
    await chooseFirstUnit(page);
    await page.getByTestId("module-setup-confirm-create").click();
    await expect(
      page.getByRole("heading", { name: "Packing 5S Standard" }),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("five-s-draft-boundary")).toBeVisible();
    await expect(
      page.getByText("Are unused items removed from the packing area?"),
    ).toBeVisible();
    await expect(page.getByText(/v1 · published/i)).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Packing 5S Standard" }),
    ).toBeVisible();
  });

  test("Gemba Quick Start creates an editable unpublished draft", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.goto("/platform/gemba");
    await page.getByRole("link", { name: "Set up Gemba" }).click();
    await expect(page.getByTestId("module-setup-chooser")).toBeVisible();
    await screenshot(page, "gemba-setup-chooser.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "gemba-setup-chooser-mobile.png");
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.getByTestId("module-setup-mode-quick-start").click();
    await expect(
      page.getByRole("heading", { name: "LEH Operational Gemba Walk" }),
    ).toBeVisible();
    await expect(
      page.getByText("Where is flow being interrupted?"),
    ).toBeVisible();
    await screenshot(page, "gemba-quick-start-preview.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    await chooseFirstUnit(page);
    await page.getByTestId("module-setup-deploy").click();
    await expect(
      page.getByRole("heading", { name: "LEH Operational Gemba Walk" }),
    ).toBeVisible();
    await expect(page.getByTestId("gemba-draft-boundary")).toBeVisible();
    await expect(page.getByTestId("authoring-section")).toHaveCount(6);
    await expect(page.getByText(/v1 · published/i)).toHaveCount(0);
    await page
      .getByTestId("gemba-question-prompt")
      .first()
      .fill("What else is visible?");
    await page.getByRole("button", { name: "Add prompt" }).first().click();
    await expect(page.getByText("What else is visible?")).toBeVisible();
    await screenshot(page, "gemba-created-draft.png");
    await page.getByTestId("publish-gemba-definition").click();
    await expect(page.getByText(/v1 · published/i)).toBeVisible();

    await page.goto("/platform/gemba");
    await expect(page.getByTestId("gemba-overview-page")).toBeVisible();
    await expect(page.getByTestId("gemba-definition-list")).toContainText(
      "LEH Operational Gemba Walk",
    );
  });

  test("Gemba LeanAI creates a draft from the trusted proposal", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const before = await usageCount(user, user.organisationAName);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.goto("/platform/gemba/setup/leanai");
    await expect(page.getByTestId("module-setup-builder")).toBeVisible();
    expect(await usageCount(user, user.organisationAName)).toBe(before);

    await page
      .getByTestId("module-setup-input")
      .fill("Leaders should notice interruptions");
    await page.getByTestId("module-setup-propose").click();
    await expect(page.getByTestId("module-setup-proposal-name")).toHaveText(
      "Operational Gemba Walk",
      { timeout: 30_000 },
    );
    await screenshot(page, "gemba-leanai-proposal.png");
    await page.getByRole("button", { name: "Refine" }).first().click();
    await page
      .getByTestId("module-setup-input")
      .fill("Keep the safety prompts observational");
    await page.getByTestId("module-setup-send").click();
    await expect(
      page.getByRole("heading", { name: "Safety at the workplace" }),
    ).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTestId("module-setup-create-draft").click();
    await chooseFirstUnit(page);
    await page.getByTestId("module-setup-confirm-create").click();
    await expect(
      page.getByRole("heading", { name: "Operational Gemba Walk" }),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("gemba-draft-boundary")).toBeVisible();
    await expect(
      page.getByText("Where is flow being interrupted?"),
    ).toBeVisible();
    await expect(page.getByText(/v1 · published/i)).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Operational Gemba Walk" }),
    ).toBeVisible();
  });

  test("disabled LeanAI and a usage ceiling leave Manual and Quick Start available", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAndSelectOrganisation(page, user, user.organisationBName);
    await page.goto("/platform/5s/setup/leanai");
    await expect(
      page.getByTestId("module-setup-builder-unavailable"),
    ).toContainText(/turned off/i);
    await page.goto("/platform/5s/setup");
    await expect(page.getByTestId("module-setup-mode-manual")).toBeVisible();
    await expect(
      page.getByTestId("module-setup-mode-quick-start"),
    ).toBeVisible();
    expect(await usageCount(user, user.organisationBName)).toBe(0);

    await setOrganisationAi(user, user.organisationBName, true, 1);
    await page.goto("/platform/5s/setup/leanai");
    await page.getByTestId("module-setup-input").fill("A short packing check");
    await page.getByTestId("module-setup-send").click();
    await expect(page.getByTestId("module-setup-question")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("module-setup-propose").click();
    await expect(page.getByTestId("module-setup-error")).toContainText(
      /usage limits/i,
      { timeout: 30_000 },
    );
    await page.goto("/platform/5s/setup");
    await expect(page.getByTestId("module-setup-mode-manual")).toBeVisible();
    await expect(
      page.getByTestId("module-setup-mode-quick-start"),
    ).toBeVisible();
  });
});
