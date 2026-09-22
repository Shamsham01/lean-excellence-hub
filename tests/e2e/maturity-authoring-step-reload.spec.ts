import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const RELOAD_COUNT = 3;

function trackHydrationConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const text = message.text();
    if (
      /hydration/i.test(text) ||
      /did not match/i.test(text) ||
      /Text content does not match/i.test(text)
    ) {
      errors.push(text);
    }
  });
  return () => {
    expect(errors, errors.join("\n")).toEqual([]);
  };
}

async function assertLevelsStepVisible(page: Page) {
  await expect(page.getByTestId("framework-editor")).toBeVisible();
  await expect(page.getByLabel("Level name")).toBeVisible();
  await expect(page.getByTestId("framework-details-form")).toHaveCount(0);
  await expect(page.getByTestId("framework-step-levels")).toBeVisible();
}

test.describe("Maturity authoring step reload hydration", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("direct ?step=levels URL survives hard reload without hydration errors", async ({
    page,
  }) => {
    const assertNoHydrationErrors = trackHydrationConsoleErrors(page);

    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/maturity/models");

    const frameworkName = `E2E Step Reload ${Date.now()}`;
    await page.getByLabel("Name").fill(frameworkName);
    await page.getByRole("button", { name: "Create draft framework" }).click();
    await expect(page.getByTestId("framework-editor")).toBeVisible();

    const modelUrl = page.url();
    expect(modelUrl).toMatch(/\/platform\/maturity\/models\//);

    await page.goto(`${modelUrl}?step=levels`);
    await assertLevelsStepVisible(page);

    await page.reload();
    await assertLevelsStepVisible(page);

    for (let reload = 0; reload < RELOAD_COUNT; reload += 1) {
      await page.reload();
      await assertLevelsStepVisible(page);
    }

    assertNoHydrationErrors();
  });
});
