import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  expectExecutionHeaderLayout,
  selectFirstExecutionUnit,
} from "./helpers/execution-unit-select";
import { DEMO_GEMBA_DEFINITION } from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Milestone 6 Gemba journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: overview and definition detail", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/gemba");

    await expect(
      page.getByRole("heading", { name: "Gemba walks" }),
    ).toBeVisible();
    await expect(page.getByText("Completed walks")).toBeVisible();

    await page.getByRole("link", { name: "Definitions" }).click();
    await expect(page).toHaveURL(/\/platform\/gemba\/definitions/);
    await expect(page.getByText(DEMO_GEMBA_DEFINITION.name)).toBeVisible();

    await page.getByRole("link", { name: DEMO_GEMBA_DEFINITION.name }).click();
    await expect(
      page.getByRole("heading", { name: DEMO_GEMBA_DEFINITION.name }),
    ).toBeVisible();
    await expectExecutionHeaderLayout(page, {
      managementTestId: "gemba-management-actions",
      executionTestId: "gemba-execution-actions",
      unitSelectTestId: "gemba-unit-select",
      submitTestId: "gemba-start-walk",
    });
    await selectFirstExecutionUnit(page, "gemba-unit-select");
    await expect(page.getByTestId("gemba-start-walk")).toBeEnabled();
  });

  test("admin: walk history shows completed demo walk", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/gemba/history");
    await expect(
      page.getByRole("heading", { name: "Gemba history" }),
    ).toBeVisible();
    await expect(page.getByText(DEMO_GEMBA_DEFINITION.name)).toBeVisible();
  });

  test("admin: walk notes persist across navigation, refresh, and complete", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/gemba/definitions");

    const name = `E2E Gemba Notes ${Date.now()}`;
    const firstPrompt = `What abnormal condition is visible? ${Date.now()}`;
    const secondPrompt = `What help does the team need? ${Date.now()}`;
    const typedNotes = "Typed floor observation from packing.";
    const filledNotes = `${typedNotes} Pasted follow-up: labels drifting.`;

    await page.getByLabel("Name").fill(name);
    await page.getByTestId("applicable-unit-checkbox").first().check();
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.getByLabel("Section title").fill("Safety");
    await page.getByRole("button", { name: "Add section" }).click();
    await expect(page.getByTestId("authoring-section")).toContainText("Safety");

    await page.getByTestId("gemba-question-prompt").fill(firstPrompt);
    await page.getByRole("button", { name: "Add prompt" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(1);

    await page.getByTestId("gemba-question-prompt").fill(secondPrompt);
    await page.getByRole("button", { name: "Add prompt" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(2);

    await page.getByTestId("publish-gemba-definition").click();
    await expect(page.getByText(/v1 · published/)).toBeVisible();

    await selectFirstExecutionUnit(page, "gemba-unit-select");
    await page.getByRole("button", { name: "Start walk" }).click();
    await expect(page).toHaveURL(/\/platform\/gemba\/walks\//);
    await expect(page.getByTestId("gemba-walk-workspace")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: firstPrompt }),
    ).toBeVisible();

    const notes = page.getByTestId("gemba-walk-notes");
    await expect(notes).toBeVisible();
    await notes.click();
    await notes.pressSequentially(typedNotes);
    await expect(notes).toHaveValue(typedNotes);
    await notes.fill(filledNotes);
    await expect(notes).toHaveValue(filledNotes);
    await expect(page.getByTestId("answer-save-status")).toContainText("Saved");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("heading", { name: secondPrompt }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Previous" }).click();
    await expect(
      page.getByRole("heading", { name: firstPrompt }),
    ).toBeVisible();
    await expect(notes).toHaveValue(filledNotes);

    const walkUrl = page.url();
    await page.reload();
    await expect(page.getByTestId("gemba-walk-notes")).toHaveValue(filledNotes);

    await page.goto("/platform/gemba");
    await page.goto(walkUrl);
    await expect(page.getByTestId("gemba-walk-notes")).toHaveValue(filledNotes);

    await page.getByTestId("gemba-complete-walk").click();
    await expect(
      page.getByRole("heading", { name: "Gemba walk summary" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "History" }).click();
    await expect(
      page.getByRole("heading", { name: "Gemba history" }),
    ).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();
    await page.getByRole("link", { name }).click();
    await expect(
      page.getByRole("heading", { name: "Gemba walk summary" }),
    ).toBeVisible();
  });
});
