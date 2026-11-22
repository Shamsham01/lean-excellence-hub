import { expect, type Page } from "@playwright/test";

/** Deterministic structure-first path aligned with `/onboarding/setup?step=` routing. */
export async function completeStructureFirstSetupToPlatform(page: Page) {
  await expect(page.getByTestId("onboarding-setup")).toBeVisible({
    timeout: 30_000,
  });

  if (await page.getByTestId("structure-first-organisation-step").isVisible()) {
    await page.getByTestId("structure-first-continue-context").click();
    await page.waitForURL(/\/onboarding\/setup\?step=structure/, {
      timeout: 30_000,
    });
  }

  await page.goto("/onboarding/setup?step=structure");
  await expect(page.getByTestId("structure-first-structure-step")).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId("structure-first-start-simple").click();
  await page.waitForURL(/\/onboarding\/setup\?step=job_functions/, {
    timeout: 45_000,
    waitUntil: "load",
  });
  await expect(
    page.getByTestId("structure-first-job-functions-step"),
  ).toBeVisible({
    timeout: 30_000,
  });

  const skipJob = page.getByTestId("structure-first-skip-job-functions");
  const continueJob = page.getByTestId(
    "structure-first-continue-job-functions",
  );
  if (await skipJob.isVisible()) {
    await skipJob.click();
  } else {
    await continueJob.click();
  }

  await expect(page.getByTestId("structure-first-people-step")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("structure-first-skip-people").click();

  await expect(page.getByTestId("structure-first-readiness-step")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("structure-first-continue-setup").click();
  await expect(page).toHaveURL(/\/platform\/setup(?:\?|$)/, {
    timeout: 30_000,
  });
}

/** Manual structure path with department + Operator job function for go-live journeys. */
export async function completeStructureFirstFoundationSetup(
  page: Page,
  siteName: string,
) {
  await expect(page.getByTestId("onboarding-setup")).toBeVisible({
    timeout: 30_000,
  });

  if (await page.getByTestId("structure-first-organisation-step").isVisible()) {
    await page.getByTestId("structure-first-continue-context").click();
    await page.waitForURL(/\/onboarding\/setup\?step=structure/, {
      timeout: 30_000,
    });
  }

  await page.goto("/onboarding/setup?step=structure");
  await expect(page.getByTestId("structure-first-structure-step")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("structure-first-build-manual").click();
  await page.getByTestId("add-unit-button").click();
  await expect(page.getByTestId("unit-create-form")).toBeVisible();
  await page.locator("#unit-name").fill("Operations");
  await page.getByTestId("unit-type-choice").selectOption("department");
  await page.getByTestId("unit-create-submit").click();
  await expect(
    page.locator('[data-testid^="org-unit-node-"]').filter({
      hasText: "Operations",
    }),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid^="org-unit-node-"]').filter({
      hasText: siteName,
    }),
  ).toBeVisible();

  await page.getByTestId("structure-first-continue-structure").click();
  await expect(
    page.getByTestId("structure-first-job-functions-step"),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("structure-first-job-suggestion-operator").click();
  await expect(page.getByTestId("job-function-item-operator")).toBeVisible();
  await page.getByTestId("structure-first-continue-job-functions").click();
  await expect(page.getByTestId("structure-first-people-step")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("structure-first-skip-people").click();
  await expect(page.getByTestId("structure-first-readiness-step")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("structure-first-continue-setup").click();
  await expect(page).toHaveURL(/\/platform\/setup(?:\?|$)/, {
    timeout: 30_000,
  });
}
