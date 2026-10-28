import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import { selectFirstExecutionUnit } from "./helpers/execution-unit-select";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

let discreteStandardPath = "";

test.describe("5S scoring scale", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("standard setup explains the scale separately from the pass threshold", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s/standards");
    await expect(page.getByTestId("five-s-scoring-scale-fields")).toBeVisible();
    await expect(page.getByLabel("Pass threshold (%)")).toBeVisible();
    await expect(page.getByTestId("five-s-scale-preview")).toContainText(
      "1 is 0%",
    );
    await expect(page.getByTestId("five-s-scale-preview")).toContainText(
      "5 is 100%",
    );

    await page.goto("/platform/5s/setup/quick-start");
    await expect(
      page.getByText("Scoring scale", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("1 to 5", { exact: true })).toBeVisible();
    await expect(page.getByText("Starting threshold")).toBeVisible();
  });

  test("admin completes a 1 to 5 audit and keeps the historical result", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    const name = `E2E 5S Scale ${Date.now()}`;
    const scorePrompt = `Score the aisle ${Date.now()}`;
    const yesPrompt = `Can this check be skipped ${Date.now()}`;

    await page.goto("/platform/5s/standards");
    await page.getByLabel("Name").fill(name);
    await page.getByTestId("applicable-unit-checkbox").first().check();
    await page.getByRole("button", { name: "Create draft standard" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByTestId("five-s-scale-summary")).toContainText(
      "1 to 5",
    );
    discreteStandardPath = new URL(page.url()).pathname;

    await page.getByLabel("Category name").fill("Sort");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByTestId("authoring-section")).toContainText("Sort");

    await page.getByTestId("five-s-question-prompt").fill(scorePrompt);
    await page.locator('select[name="questionType"]').selectOption("score");
    await page.getByRole("button", { name: "Add question" }).click();
    await expect(page.getByTestId("authoring-question")).toContainText(
      scorePrompt,
    );

    const versionId = await page
      .locator('input[name="versionId"]')
      .first()
      .inputValue();
    const sectionId = await page
      .locator('input[name="sectionId"]')
      .first()
      .inputValue();
    const client = await demoAdminClient();
    const { error: questionError } = await client.rpc("add_five_s_question", {
      target_standard_version_id: versionId,
      target_section_id: sectionId,
      target_question_type: "yes_no",
      target_prompt: yesPrompt,
      target_position: 2,
      target_is_required: true,
      target_allows_not_applicable: true,
      target_contributes_to_score: true,
      target_scoring_metadata: {
        type: "yes_no",
        yes_value: 100,
        no_value: 0,
      },
    });
    expect(questionError).toBeNull();

    await page.reload();
    await expect(page.getByTestId("authoring-question")).toHaveCount(2);
    await page.getByTestId("publish-five-s-standard").click();
    await expect(page.getByText(/v1 · published/i)).toBeVisible();
    await expect(page.getByTestId("five-s-scale-summary")).toContainText(
      "1 to 5",
    );

    await selectFirstExecutionUnit(page, "five-s-unit-select");
    await page.getByTestId("five-s-start-audit").click();
    await expect(page).toHaveURL(/\/platform\/5s\/audits\//);
    const auditId = page.url().split("/").pop() ?? "";

    const group = page.getByRole("radiogroup", {
      name: "Score — choose 1 to 5",
    });
    await expect(group).toBeVisible();
    const options = group.getByRole("radio");
    await expect(options).toHaveCount(5);
    expect(
      await options.evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLInputElement).value),
      ),
    ).toEqual(["1", "2", "3", "4", "5"]);
    await expect(page.getByLabel("Score", { exact: true })).toHaveCount(0);

    await options.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(options.nth(1)).toBeChecked();
    await expectSaved(page);

    await group.getByText("3", { exact: true }).click();
    await expect(options.nth(2)).toBeChecked();
    await expectSaved(page);
    await page.reload();
    await expect(scoreGroup(page).getByRole("radio").nth(2)).toBeChecked();

    await scoreGroup(page).getByText("5", { exact: true }).click();
    await expectSaved(page);
    await page.reload();
    await expect(scoreGroup(page).getByRole("radio").nth(4)).toBeChecked();

    const questionId =
      (
        await scoreGroup(page).getByRole("radio").nth(4).getAttribute("name")
      )?.replace("five-s-score-", "") ?? "";
    expect(questionId).not.toEqual("");
    const rejected = await client.rpc("upsert_five_s_audit_answer", {
      target_audit_id: auditId,
      target_question_id: questionId,
      target_is_not_applicable: false,
      target_number_value: 13,
    });
    expect(rejected.error?.message ?? "").toMatch(
      /not on the published scale/i,
    );
    const { data: stored, error: storedError } = await client
      .from("template_answers")
      .select("number_value")
      .eq("question_id", questionId)
      .maybeSingle();
    expect(storedError).toBeNull();
    expect(Number(stored?.number_value)).toBe(5);
    await page.reload();
    await expect(scoreGroup(page).getByRole("radio").nth(4)).toBeChecked();

    await auditButton(page, "Next").click();
    await expect(page.getByRole("heading", { name: yesPrompt })).toBeVisible();
    await page.getByRole("button", { name: "Yes" }).click();
    await expectSaved(page);
    await page.reload();
    await auditButton(page, "Next").click();
    await expect(page.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "N/A" }).click();
    await expectSaved(page);
    await expect(page.getByTestId("evidence-uploader")).toBeVisible();
    await expect(page.getByTestId("evidence-file-input")).toBeEnabled();
    await page.reload();
    await auditButton(page, "Next").click();
    await expect(page.getByRole("button", { name: "N/A" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await auditButton(page, "Previous").click();
    await scoreGroup(page).getByText("3", { exact: true }).click();
    await expectSaved(page);
    await page.getByTestId("five-s-complete-audit").click();
    await expect(page.getByTestId("five-s-audit-result-page")).toBeVisible();
    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    await expect(page.getByText(scorePrompt)).toBeVisible();
    await expect(page.getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByText(yesPrompt)).toBeVisible();
    await expect(page.getByText("Not applicable.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    await expect(page.getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByText("Not applicable.")).toBeVisible();

    await page.goto("/platform/5s/history");
    const historyLink = page.getByRole("link", { name: new RegExp(name) });
    await expect(historyLink).toBeVisible();
    await expect(historyLink).toContainText("50%");
    await historyLink.click();
    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    await expect(page.getByText("3", { exact: true })).toBeVisible();
  });

  test("a wide scale uses a number input on a phone-width screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "admin");
    const name = `E2E 5S Wide ${Date.now()}`;

    await page.goto("/platform/5s/standards");
    await page.getByLabel("Name").fill(name);
    await page.locator("#create-scoring-scale-preset").selectOption("0-100");
    await expect(page.getByTestId("five-s-scale-preview")).toContainText(
      "0 is 0%",
    );
    await expect(page.getByTestId("five-s-scale-preview")).toContainText(
      "100 is 100%",
    );
    await page.getByTestId("applicable-unit-checkbox").first().check();
    await page.getByRole("button", { name: "Create draft standard" }).click();
    await expect(page.getByTestId("five-s-scale-summary")).toContainText(
      "0 to 100",
    );

    await page.getByLabel("Category name").fill("Sort");
    await page.getByRole("button", { name: "Add category" }).click();
    await page.getByTestId("five-s-question-prompt").fill("Wide score");
    await page.locator('select[name="questionType"]').selectOption("score");
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByTestId("publish-five-s-standard").click();
    await expect(page.getByText(/v1 · published/i)).toBeVisible();

    await selectFirstExecutionUnit(page, "five-s-unit-select");
    await page.getByTestId("five-s-start-audit").click();
    await expect(page).toHaveURL(/\/platform\/5s\/audits\//);

    const input = page.getByLabel("Score");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "number");
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    const box = await input.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await input.focus();
    await page.keyboard.type("40");
    await input.blur();
    await expectSaved(page);
    await page.reload();
    await expect(page.getByLabel("Score")).toHaveValue("40");

    await page.getByLabel("Score").fill("101");
    await page.getByLabel("Score").blur();
    await expect(page.getByTestId("five-s-score-invalid")).toBeVisible();
    await expect(page.getByTestId("answer-save-status")).not.toContainText(
      "Saved",
    );
    await page.reload();
    await expect(page.getByLabel("Score")).toHaveValue("40");

    const auditId = page.url().split("/").pop() ?? "";
    const client = await demoAdminClient();
    const { data: auditRow, error: auditError } = await client
      .from("five_s_audits")
      .select("submission_id")
      .eq("id", auditId)
      .single();
    expect(auditError).toBeNull();
    const { data: answer, error: answerError } = await client
      .from("template_answers")
      .select("question_id, number_value")
      .eq("submission_id", auditRow?.submission_id)
      .maybeSingle();
    expect(answerError).toBeNull();
    expect(Number(answer?.number_value)).toBe(40);
    const rejected = await client.rpc("upsert_five_s_audit_answer", {
      target_audit_id: auditId,
      target_question_id: answer?.question_id,
      target_is_not_applicable: false,
      target_number_value: 101,
    });
    expect(rejected.error?.message ?? "").toMatch(
      /not on the published scale/i,
    );
    await page.reload();
    await expect(page.getByLabel("Score")).toHaveValue("40");

    expect(discreteStandardPath).not.toEqual("");
    await page.goto(discreteStandardPath);
    await selectFirstExecutionUnit(page, "five-s-unit-select");
    await page.getByTestId("five-s-start-audit").click();
    const narrowGroup = scoreGroup(page);
    await expect(narrowGroup).toBeVisible();
    const narrowOptions = narrowGroup.getByRole("radio");
    await expect(narrowOptions).toHaveCount(5);
    for (const option of await narrowOptions.all()) {
      const labelBox = await option.locator("xpath=..").boundingBox();
      expect(labelBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await narrowOptions.nth(2).focus();
    await page.keyboard.press("ArrowRight");
    await expect(narrowOptions.nth(3)).toBeChecked();
    await expectSaved(page);
  });
});

function scoreGroup(page: Page) {
  return page.getByRole("radiogroup", { name: "Score — choose 1 to 5" });
}

function auditButton(page: Page, name: "Next" | "Previous") {
  return page
    .getByTestId("five-s-audit-workspace")
    .getByRole("button", { name, exact: true });
}

async function expectSaved(page: Page) {
  await expect(page.getByTestId("answer-save-status")).toContainText("Saved", {
    timeout: 10_000,
  });
}

async function demoAdminClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Supabase browser env is not configured");
  }
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: DEMO_USERS.admin.email,
    password: DEMO_USERS.admin.password,
  });
  if (error) throw error;
  const { data: organisations, error: listError } = await client.rpc(
    "list_my_eligible_organisations",
  );
  if (listError) throw listError;
  const organisation = organisations?.find(
    (entry: { organisation_code: string; organisation_id: string }) =>
      entry.organisation_code === DEMO_ORGANISATION.code,
  );
  if (!organisation?.organisation_id) {
    throw new Error("Demo organisation was not available");
  }
  const { error: switchError } = await client.rpc("switch_organisation", {
    target_organisation_id: organisation.organisation_id,
  });
  if (switchError) throw switchError;
  return client;
}
