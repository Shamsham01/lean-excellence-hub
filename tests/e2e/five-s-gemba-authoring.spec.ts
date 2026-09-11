import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("5S and Gemba draft authoring persistence", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin: 5S question persists after refresh and incomplete publish stays blocked", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s/standards");

    const name = `E2E 5S Authoring ${Date.now()}`;
    const firstPrompt = `Is the packing table clear? ${Date.now()}`;
    const secondPrompt = `Are waste bins labelled? ${Date.now()}`;

    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Create draft standard" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByTestId("create-schedule-link")).toHaveCount(0);
    await expect(page.getByTestId("publish-five-s-standard")).toBeDisabled();
    await expect(page.getByTestId("publish-blocked-reason")).toBeVisible();

    await page.getByLabel("Category name").fill("Sort");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByTestId("authoring-section")).toContainText("Sort");
    await expect(page.getByTestId("publish-five-s-standard")).toBeDisabled();

    await page.getByTestId("five-s-question-prompt").fill(firstPrompt);
    await page.getByRole("button", { name: "Add question" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(1);
    await expect(page.getByTestId("authoring-question")).toContainText(
      firstPrompt,
    );

    await page.reload();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByTestId("authoring-question")).toHaveCount(1);
    await expect(page.getByTestId("authoring-question")).toContainText(
      firstPrompt,
    );

    await page.getByTestId("five-s-question-prompt").fill(secondPrompt);
    await page.getByRole("button", { name: "Add question" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(2);
    await expect(page.getByTestId("authoring-question").nth(0)).toContainText(
      firstPrompt,
    );
    await expect(page.getByTestId("authoring-question").nth(1)).toContainText(
      secondPrompt,
    );

    await page.reload();
    await expect(page.getByTestId("authoring-question")).toHaveCount(2);
    await expect(page.getByTestId("authoring-question").nth(0)).toContainText(
      firstPrompt,
    );
    await expect(page.getByTestId("authoring-question").nth(1)).toContainText(
      secondPrompt,
    );
    await expect(page.getByTestId("publish-five-s-standard")).toBeEnabled();

    await page.getByTestId("publish-five-s-standard").click();
    await expect(page.getByText(/v1 · published/)).toBeVisible();
    await expect(page.getByTestId("create-schedule-link")).toBeVisible();
  });

  test("admin: Gemba section and prompt persist after refresh and incomplete publish stays blocked", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/gemba/definitions");

    const name = `E2E Gemba Authoring ${Date.now()}`;
    const firstPrompt = `What abnormal condition is visible? ${Date.now()}`;
    const secondPrompt = `What help does the team need? ${Date.now()}`;

    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByTestId("create-schedule-link")).toHaveCount(0);
    await expect(page.getByTestId("publish-gemba-definition")).toBeDisabled();
    await expect(page.getByTestId("publish-blocked-reason")).toBeVisible();

    await page.getByLabel("Section title").fill("Safety");
    await page.getByRole("button", { name: "Add section" }).click();
    await expect(page.getByTestId("authoring-section")).toContainText("Safety");
    await expect(page.getByTestId("authoring-question")).toHaveCount(0);
    await expect(page.getByTestId("publish-gemba-definition")).toBeDisabled();

    await page.reload();
    await expect(page.getByTestId("authoring-section")).toContainText("Safety");
    await expect(page.getByTestId("authoring-section")).toHaveCount(1);

    await page.getByTestId("gemba-question-prompt").fill(firstPrompt);
    await page.getByRole("button", { name: "Add prompt" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(1);
    await expect(page.getByTestId("authoring-question")).toContainText(
      firstPrompt,
    );

    await page.reload();
    await expect(page.getByTestId("authoring-question")).toHaveCount(1);
    await expect(page.getByTestId("authoring-question")).toContainText(
      firstPrompt,
    );

    await page.getByTestId("gemba-question-prompt").fill(secondPrompt);
    await page.getByRole("button", { name: "Add prompt" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(2);
    await expect(page.getByTestId("authoring-question").nth(0)).toContainText(
      firstPrompt,
    );
    await expect(page.getByTestId("authoring-question").nth(1)).toContainText(
      secondPrompt,
    );

    await page.reload();
    await expect(page.getByTestId("authoring-question")).toHaveCount(2);
    await expect(page.getByTestId("publish-gemba-definition")).toBeEnabled();

    await page.getByTestId("publish-gemba-definition").click();
    await expect(page.getByText(/v1 · published/)).toBeVisible();
    await expect(page.getByTestId("create-schedule-link")).toBeVisible();
  });
});
