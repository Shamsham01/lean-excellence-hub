import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  openPeopleInviteDialog,
  openSuggestionsNewDialog,
} from "./helpers/form-dialogs";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Responsive form dialogs at mobile viewport", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("people invite opens as a sheet with the invite form", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/settings/people");
    await openPeopleInviteDialog(page);
    await expect(page.getByTestId("invite-colleague-form")).toBeVisible();
    const box = await page.getByTestId("people-invite-dialog").boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  });

  test("suggestions new idea opens as a sheet with the submission form", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/suggestions");
    await expect(page.getByTestId("suggestions-overview")).toBeVisible();
    await openSuggestionsNewDialog(page);
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    const dialog = page.getByTestId("suggestions-new-dialog");
    await expect(dialog).toBeVisible();
    const scroll = dialog.locator("[data-dialog-scroll]");
    if ((await scroll.count()) > 0) {
      await expect(scroll).toBeVisible();
    }
  });

  test("training course create opens as a sheet from the courses hub", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/training/courses?new=1");
    await expect(
      page.getByTestId("training-course-create-dialog"),
    ).toBeVisible();
    await expect(page.getByTestId("training-course-create-form")).toBeVisible();
  });
});
