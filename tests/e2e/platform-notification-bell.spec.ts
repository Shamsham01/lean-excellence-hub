import { expect, test } from "@playwright/test";

import {
  ensurePlatformE2eUser,
  platformE2eCredentials,
} from "./helpers/platform-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Platform notification bell", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test.beforeAll(async () => {
    await ensurePlatformE2eUser();
  });

  test("shows honest empty state when there are no unread notifications", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(platformE2eCredentials.email);
    await page.getByLabel("Password").fill(platformE2eCredentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/platform/);

    await page.setViewportSize({ width: 1280, height: 720 });
    const bell = page
      .getByTestId("leanai-assistant-rail")
      .getByTestId("platform-notification-bell");
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(bell).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("You are all caught up.")).toBeVisible();
    await expect(bell.getByTestId("platform-notification-count")).toHaveCount(
      0,
    );
  });
});
