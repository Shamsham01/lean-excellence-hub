import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { ALL_SITES_COOKIE_VALUE } from "@/modules/organisation/site-context";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { loginAsCookieWorksPersona } from "./helpers/cookieworks-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function selectActiveSite(page: Page, label: string) {
  const switcher = page.getByTestId("site-context-switcher");
  await expect(switcher).toBeVisible();
  const value = await switcher
    .locator("option", { hasText: new RegExp(`^${label}$`) })
    .getAttribute("value");
  expect(value).toBeTruthy();
  await switcher.selectOption(value!);
  await expect(switcher).toHaveValue(value!, { timeout: 15_000 });
}

test.describe("Schedule activity picker", () => {
  test.setTimeout(120_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("lists published activities when a concrete site is active", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/schedule/new");
    await expect(page.getByTestId("schedule-new-page")).toBeVisible();
    await expect(page.getByTestId("schedule-activity-picker")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Choose activity" }),
    ).toBeVisible();
    await expect(
      page.getByTestId(/schedule-activity-select-/).first(),
    ).toBeVisible();
  });

  test("Schedule list New schedule opens activity picker", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/schedule");
    await page.getByTestId("schedule-new-link").click();
    await expect(page).toHaveURL(/\/platform\/schedule\/new(?:\?|$)/);
    await expect(page.getByTestId("schedule-activity-picker")).toBeVisible();
  });
});

test.describe("Schedule activity picker site context", () => {
  test.setTimeout(120_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and CookieWorks site-boundary seed",
  );

  test.beforeAll(() => {
    execSync("npm run qa:site-boundary:reset", {
      cwd: join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
      env: {
        ...process.env,
        LEANHUB_ALLOW_QA_TENANT: "1",
      },
      stdio: "pipe",
    });
  });

  test("All sites shows choose-site state instead of publish empty", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "admin");
    await selectActiveSite(page, "All sites");
    await expect(page.getByTestId("site-context-switcher")).toHaveValue(
      ALL_SITES_COOKIE_VALUE,
    );
    await page.goto("/platform/schedule/new");
    await expect(
      page.getByTestId("schedule-activity-picker-choose-site"),
    ).toBeVisible();
    await expect(
      page.getByText("Choose a site to see schedulable activities"),
    ).toBeVisible();
    await expect(
      page.getByTestId("schedule-activity-picker-empty"),
    ).toHaveCount(0);
  });
});
