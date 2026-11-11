// VERIFY draft for PR #391 (Spec A): the validation dialog opens with no
// method, save is blocked until one is chosen, and practical_observation is
// persisted (UI history after reload + database row).
//
// Idempotent across retries/re-runs: it picks whichever assessable skill the
// demo operator still has instead of a fixed "5S Auditing" / "Advanced (4)"
// (the PR's own spec turns that gap into "meets" on first run, so a retry
// finds no option). Does NOT depend on tests/e2e/helpers/skills-setup-records.ts.
import { expect, test } from "@playwright/test";

import { DEMO_USERS } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import { queryDatabase } from "./helpers/workforce-provisioning";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const EXPECTED_OPTIONS = [
  "Select method…",
  "Manager assessment",
  "Practical observation",
  "Qualification",
  "Trainer sign-off",
  "External certification",
];

test.describe("Skill assessment method persistence (Spec A)", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("dialog has no default method; practical observation saves and persists", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/people");
    await page
      .getByRole("link", { name: DEMO_USERS.operator.displayName })
      .click();
    await expect(page.getByTestId("capability-profile-page")).toBeVisible();

    const historyRows = page.locator("li", {
      hasText: "· Practical observation",
    });
    const before = await historyRows.count();

    await page.getByTestId("open-skill-assessment").click();
    const dialog = page.getByTestId("skill-assessment-dialog");
    await expect(dialog).toBeVisible();

    const method = page.getByTestId("skill-assessment-method");
    await expect(method).toHaveValue("");
    await expect(method.locator("option")).toHaveText(EXPECTED_OPTIONS);
    await expect(page.getByTestId("skill-assessment-save")).toBeDisabled();

    const skill = page.getByTestId("skill-assessment-skill");
    const skillValues = await skill
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter(Boolean),
      );
    expect(
      skillValues.length,
      "demo operator needs at least one assessable skill (reseed if all met)",
    ).toBeGreaterThan(0);
    await skill.selectOption(skillValues[0]);

    const level = page.getByTestId("skill-assessment-level");
    const levelValues = await level
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter(Boolean),
      );
    expect(levelValues.length).toBeGreaterThan(0);
    // Lowest level keeps the gap open so the test stays re-runnable.
    await level.selectOption(levelValues[0]);

    // Skill + level chosen but still no method: save stays blocked.
    await expect(page.getByTestId("skill-assessment-save")).toBeDisabled();

    await method.selectOption({ label: "Practical observation" });
    await expect(method).toHaveValue("practical_observation");
    await expect(page.getByTestId("skill-assessment-save")).toBeEnabled();
    await page.getByTestId("skill-assessment-save").click();

    await expect(dialog.getByRole("button", { name: "Done" })).toBeVisible();
    await dialog.getByRole("button", { name: "Done" }).click();

    await page.reload();
    await expect(page.getByTestId("capability-profile-page")).toBeVisible();
    await expect(historyRows).toHaveCount(before + 1);

    const rows = queryDatabase<{
      assessment_method: string;
      assertion_type: string;
    }>(
      `select assessment_row.assessment_method, assessment_row.assertion_type
       from public.membership_skill_assessments assessment_row
       join public.organisation_memberships membership_row
         on membership_row.organisation_id = assessment_row.organisation_id
        and membership_row.id = assessment_row.membership_id
       where membership_row.user_id = '${DEMO_USERS.operator.id}'
       order by assessment_row.created_at desc
       limit 1`,
    );
    expect(rows[0]).toEqual({
      assessment_method: "practical_observation",
      assertion_type: "validated",
    });
  });

  test("reopening the dialog resets the method to the placeholder", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/people");
    await page
      .getByRole("link", { name: DEMO_USERS.operator.displayName })
      .click();
    await page.getByTestId("open-skill-assessment").click();
    await page
      .getByTestId("skill-assessment-method")
      .selectOption({ label: "Qualification" });
    await page
      .getByTestId("skill-assessment-dialog")
      .getByRole("button", { name: "Cancel" })
      .click();
    await page.getByTestId("open-skill-assessment").click();
    await expect(page.getByTestId("skill-assessment-method")).toHaveValue("");
    await expect(page.getByTestId("skill-assessment-save")).toBeDisabled();
  });
});
