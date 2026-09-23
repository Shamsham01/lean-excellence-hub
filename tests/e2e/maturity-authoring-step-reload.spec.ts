import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const RELOAD_COUNT = 3;

type AuthoringStep = "details" | "scopes" | "levels" | "pillars";

function trackProductionRuntimeErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`[console.error] ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(`[pageerror] ${error.message}`);
  });

  return () => {
    expect(
      pageErrors,
      pageErrors.length > 0
        ? `Unexpected uncaught page errors:\n${pageErrors.join("\n")}`
        : undefined,
    ).toEqual([]);
    expect(
      consoleErrors,
      consoleErrors.length > 0
        ? `Unexpected console.error output:\n${consoleErrors.join("\n")}`
        : undefined,
    ).toEqual([]);
  };
}

async function assertAuthoringStepVisible(page: Page, step: AuthoringStep) {
  await expect(page.getByTestId("framework-editor")).toBeVisible();

  switch (step) {
    case "details":
      await expect(page.getByTestId("framework-details-form")).toBeVisible();
      await expect(page.getByLabel("Level name")).toHaveCount(0);
      break;
    case "scopes":
      await expect(
        page.getByRole("button", { name: "Save assessment scopes" }),
      ).toBeVisible();
      await expect(page.getByTestId("framework-details-form")).toHaveCount(0);
      break;
    case "levels":
      await expect(page.getByLabel("Level name")).toBeVisible();
      await expect(page.getByTestId("framework-details-form")).toHaveCount(0);
      break;
    case "pillars":
      await expect(page.getByLabel("Pillar name")).toBeVisible();
      await expect(page.getByTestId("framework-details-form")).toHaveCount(0);
      break;
  }

  await expect(page.getByTestId(`framework-step-${step}`)).toBeVisible();
}

test.describe("Maturity authoring step reload hydration", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("direct ?step= URL, reloads, tab changes, back/forward, and save confirmation stay hydration-safe", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);

    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/maturity/models");

    const frameworkName = `E2E Step Reload ${Date.now()}`;
    await page.getByLabel("Name").fill(frameworkName);
    await page.getByRole("button", { name: "Create draft framework" }).click();
    await expect(page.getByTestId("framework-editor")).toBeVisible();

    const modelUrl = page.url();
    expect(modelUrl).toMatch(/\/platform\/maturity\/models\//);

    await page.goto(`${modelUrl}?step=levels`);
    await assertAuthoringStepVisible(page, "levels");

    await page.reload();
    await assertAuthoringStepVisible(page, "levels");

    for (let reload = 0; reload < RELOAD_COUNT; reload += 1) {
      await page.reload();
      await assertAuthoringStepVisible(page, "levels");
    }

    await page.getByTestId("framework-step-pillars").click();
    await expect(page).toHaveURL(/\?step=pillars(?:$|&)/);
    await assertAuthoringStepVisible(page, "pillars");

    // Step clicks use replaceState, so exercise back/forward with full navigations
    // that create history entries and re-render from server-derived ?step= values.
    await page.goto(`${modelUrl}?step=levels`);
    await assertAuthoringStepVisible(page, "levels");
    await page.goto(`${modelUrl}?step=pillars`);
    await assertAuthoringStepVisible(page, "pillars");
    await page.goBack();
    await assertAuthoringStepVisible(page, "levels");
    await page.goForward();
    await assertAuthoringStepVisible(page, "pillars");

    await page.goto(`${modelUrl}?step=details`);
    await assertAuthoringStepVisible(page, "details");

    const updatedName = `${frameworkName} revised`;
    await page.getByLabel("Display name").fill(updatedName);
    await page.getByRole("button", { name: "Save framework details" }).click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Saved.",
    );
    await expect(page.getByLabel("Display name")).toHaveValue(updatedName);

    await page.getByTestId("framework-step-scopes").click();
    await expect(page).toHaveURL(/\?step=scopes(?:$|&)/);
    await assertAuthoringStepVisible(page, "scopes");

    assertNoProductionRuntimeErrors();
  });
});
