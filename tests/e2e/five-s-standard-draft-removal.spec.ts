import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  openFiveSAddCategory,
  openFiveSAddQuestion,
} from "./helpers/form-dialogs";
import {
  clickExecutionStartSubmit,
  selectFirstExecutionUnit,
} from "./helpers/execution-unit-select";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("5S standard draft structural authoring", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("successor draft: remove category and question, publish, discard", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    const name = `E2E 5S Remove ${Date.now()}`;
    const keepPrompt = `Keep this check ${Date.now()}`;
    const dropPrompt = `Drop this check ${Date.now()}`;

    await page.goto("/platform/5s/standards");
    await page.getByLabel("Name").fill(name);
    await page.getByTestId("applicable-unit-checkbox").first().check();
    await page.getByRole("button", { name: "Create draft standard" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    const standardPath = new URL(page.url()).pathname;

    await openFiveSAddCategory(page);
    await page.getByLabel("Category name").fill("Sort");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByTestId("authoring-section")).toContainText("Sort");

    await openFiveSAddQuestion(page);
    await page.getByTestId("five-s-question-prompt").fill(keepPrompt);
    await page.getByRole("button", { name: "Add question" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(1);

    await openFiveSAddQuestion(page);
    await page.getByTestId("five-s-question-prompt").fill(dropPrompt);
    await page.getByRole("button", { name: "Add question" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(2);

    await openFiveSAddCategory(page);
    await page.getByLabel("Category name").fill("Set");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByTestId("authoring-section")).toHaveCount(2);

    await page.getByTestId("publish-five-s-standard").click();
    await expect(page.getByText(/v1 · published/i)).toBeVisible();
    await expect(page.getByTestId("create-successor")).toBeVisible();

    await selectFirstExecutionUnit(page, "five-s-unit-select");
    await clickExecutionStartSubmit(page, "five-s-start-audit");
    await expect(page).toHaveURL(/\/platform\/5s\/audits\//);
    const v1AuditUrl = page.url();
    const workspace = page.getByTestId("five-s-audit-workspace");
    await expect(workspace.getByText(keepPrompt)).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(workspace.getByText(dropPrompt)).toBeVisible();

    await page.goto(standardPath);

    await page.getByTestId("create-successor").click();
    await expect(page.getByText(/Draft v2/i)).toBeVisible();
    await expect(page.getByTestId("create-successor")).toHaveCount(0);
    await expect(page.getByTestId("five-s-discard-draft-open")).toBeVisible();

    const dropQuestion = page
      .getByTestId("authoring-question")
      .filter({ hasText: dropPrompt });
    await dropQuestion
      .getByRole("button", {
        name: new RegExp(`Remove question ${dropPrompt}`),
      })
      .click();
    await expect(
      page.getByTestId("five-s-remove-structural-dialog"),
    ).toBeVisible();
    await page.getByTestId("five-s-remove-structural-confirm").click();
    await expect(
      page.getByTestId("five-s-remove-structural-dialog"),
    ).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(dropPrompt)).toHaveCount(0);

    const setSection = page
      .getByTestId("authoring-section")
      .filter({ hasText: "Set" });
    await setSection
      .getByRole("button", { name: "Remove category Set" })
      .click();
    await page.getByTestId("five-s-remove-structural-confirm").click();
    await expect(page.getByTestId("authoring-section")).toHaveCount(1);

    await page.getByTestId("publish-five-s-standard").click();
    await expect(page.getByText(/v2 · published/i)).toBeVisible();

    await selectFirstExecutionUnit(page, "five-s-unit-select");
    await clickExecutionStartSubmit(page, "five-s-start-audit");
    const v2Workspace = page.getByTestId("five-s-audit-workspace");
    await expect(v2Workspace.getByText(keepPrompt)).toBeVisible();
    await expect(v2Workspace.getByText(dropPrompt)).toHaveCount(0);

    await page.goto(standardPath);
    await expect(page.getByTestId("create-successor")).toBeVisible();
    await page.getByTestId("create-successor").click();
    await expect(page.getByText(/Draft v3/i)).toBeVisible();

    await page.getByTestId("five-s-discard-draft-open").click();
    await expect(page.getByTestId("five-s-discard-draft-dialog")).toBeVisible();
    await page.getByTestId("five-s-discard-draft-confirm").click();
    await expect(page.getByText(/Draft discarded/i)).toBeVisible();
    await expect(page.getByText(/Draft v3/i)).toHaveCount(0);
    await expect(page.getByTestId("create-successor")).toBeVisible();

    await page.goto(v1AuditUrl);
    await expect(page.getByTestId("five-s-audit-workspace")).toContainText(
      keepPrompt,
    );
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByTestId("five-s-audit-workspace")).toContainText(
      dropPrompt,
    );
  });
});
