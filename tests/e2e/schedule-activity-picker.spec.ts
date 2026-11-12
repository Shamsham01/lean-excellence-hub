import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Schedule activity picker", () => {
  test.setTimeout(120_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("New schedule opens picker with published activities", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/schedule/new");
    await expect(page.getByTestId("schedule-new-page")).toBeVisible();

    const picker = page.getByTestId("schedule-activity-picker");
    const empty = page.getByTestId("schedule-activity-picker-empty");
    await expect(picker.or(empty)).toBeVisible();

    if (await picker.isVisible()) {
      const select = page.getByTestId(/schedule-activity-select-/).first();
      await expect(select).toBeVisible();
      await select.click();
      await expect(page).toHaveURL(/activityId=/);
      await expect(page.getByTestId("schedule-form")).toBeVisible();
      return;
    }

    await expect(empty).toBeVisible();
    await expect(
      page.getByTestId("schedule-picker-5s-setup-link"),
    ).toBeVisible();
    await expect(
      page.getByTestId("schedule-picker-gemba-setup-link"),
    ).toBeVisible();
  });

  test("Schedule list New schedule navigates to picker flow", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/schedule");
    await page.getByTestId("schedule-new-link").click();
    await expect(page).toHaveURL(/\/platform\/schedule\/new(?:\?|$)/);
    await expect(page.getByTestId("schedule-new-page")).toBeVisible();
    await expect(
      page
        .getByTestId("schedule-activity-picker")
        .or(page.getByTestId("schedule-activity-picker-empty")),
    ).toBeVisible();
  });
});
