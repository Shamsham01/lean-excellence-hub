import { expect, test, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  expectExecutionHeaderLayout,
  selectFirstExecutionUnit,
} from "./helpers/execution-unit-select";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const NAVIGATION_CYCLES = 12;
const GEMBA_SAVE_NAV_CYCLES = 10;
const MODULE_ROUTES = [
  "/platform",
  "/platform/gemba",
  "/platform/people",
  "/platform/suggestions",
  "/platform/gemba",
] as const;

async function expectWorkspaceHealthy(page: Page) {
  await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);
  await expect(page.locator("#__next_error__")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /couldn’t load/i }),
  ).toHaveCount(0);
}

test.describe("platform reliability after shared RSC refresh", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("repeated module navigation and refresh stay on compiled pages", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");

    for (let cycle = 0; cycle < NAVIGATION_CYCLES; cycle += 1) {
      for (const route of MODULE_ROUTES) {
        await page.goto(route);
        await expect(page).toHaveURL(new RegExp(`${route}(?:\\?|$)`));
        await expectWorkspaceHealthy(page);
      }

      await page.reload();
      await expectWorkspaceHealthy(page);
    }
  });

  test("Gemba save then Next/Previous survives repeated server-action RSC refreshes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/gemba/definitions");

    const name = `Reliability Gemba ${Date.now()}`;
    const firstPrompt = `Reliability prompt A ${Date.now()}`;
    const secondPrompt = `Reliability prompt B ${Date.now()}`;

    await page.getByLabel("Name").fill(name);
    await page.getByTestId("applicable-unit-checkbox").first().check();
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.getByLabel("Section title").fill("Reliability");
    await page.getByRole("button", { name: "Add section" }).click();
    await expect(page.getByTestId("authoring-section")).toContainText(
      "Reliability",
    );

    await page.getByTestId("gemba-question-prompt").fill(firstPrompt);
    await page.getByRole("button", { name: "Add prompt" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(1);

    await page.getByTestId("gemba-question-prompt").fill(secondPrompt);
    await page.getByRole("button", { name: "Add prompt" }).click();
    await expect(page.getByTestId("authoring-question")).toHaveCount(2);

    await page.getByTestId("publish-gemba-definition").click();
    await expect(page.getByText(/v1 · published/)).toBeVisible();

    await selectFirstExecutionUnit(page, "gemba-unit-select");
    await expectExecutionHeaderLayout(page, {
      managementTestId: "gemba-management-actions",
      executionTestId: "gemba-execution-actions",
      unitSelectTestId: "gemba-unit-select",
      submitTestId: "gemba-start-walk",
    });
    await page.getByRole("button", { name: "Start walk" }).click();
    await expect(page).toHaveURL(/\/platform\/gemba\/walks\//);
    await expect(page.getByTestId("gemba-walk-workspace")).toBeVisible();
    await expectWorkspaceHealthy(page);

    const notes = page.getByTestId("gemba-walk-notes");
    for (let cycle = 0; cycle < GEMBA_SAVE_NAV_CYCLES; cycle += 1) {
      const value = `Saved observation ${cycle + 1}`;
      await notes.fill(value);
      await expect(page.getByTestId("answer-save-status")).toContainText(
        "Saved",
      );
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: secondPrompt }),
      ).toBeVisible();
      await expectWorkspaceHealthy(page);

      await page.getByRole("button", { name: "Previous", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: firstPrompt }),
      ).toBeVisible();
      await expect(notes).toHaveValue(value);
      await expectWorkspaceHealthy(page);
    }

    const switcher = page.getByTestId("site-context-switcher");
    if (await switcher.isVisible()) {
      const options = switcher.locator("option");
      const count = await options.count();
      if (count > 1) {
        const firstValue = await options.nth(0).getAttribute("value");
        const secondValue = await options.nth(1).getAttribute("value");
        if (firstValue && secondValue && firstValue !== secondValue) {
          await switcher.selectOption(secondValue);
          await expect(switcher).toHaveValue(secondValue, { timeout: 15_000 });
          await expectWorkspaceHealthy(page);
          await switcher.selectOption(firstValue);
          await expect(switcher).toHaveValue(firstValue, { timeout: 15_000 });
          await expectWorkspaceHealthy(page);
        }
      }
    }
  });
});
