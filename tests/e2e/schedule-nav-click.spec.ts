import { expect, test, type Page } from "@playwright/test";

import { DEMO_FIVE_S_STANDARD } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const DEMO_SCHEDULE_TITLE = "Weekly Production 5S";

async function openDemoScheduleDetail(page: Page) {
  await page.goto("/platform/schedule");
  await expect(page.getByTestId("schedule-list-page")).toBeVisible();

  const row = page.getByRole("link", { name: DEMO_SCHEDULE_TITLE }).first();
  await expect(row).toBeVisible();
  const detailHref = await row.getAttribute("href");
  expect(detailHref).toMatch(/\/platform\/schedule\/[0-9a-f-]{36}$/);

  await row.click();
  await expect(page).toHaveURL(new RegExp(`${detailHref}$`));
  await expect(page.getByTestId("schedule-detail-page")).toBeVisible();
  return detailHref as string;
}

test.describe("NAV-CLICK-001 schedule navigation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("schedule list row, edit, and editor Back navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    const detailHref = await openDemoScheduleDetail(page);

    const edit = page.getByTestId("schedule-edit-link");
    await expect(edit).toHaveAttribute("href", `${detailHref}/edit`);
    await edit.click();
    await expect(page).toHaveURL(new RegExp(`${detailHref}/edit$`));
    await expect(page.getByTestId("schedule-edit-page")).toBeVisible();
    await expect(page.getByTestId("schedule-form")).toBeVisible();

    const back = page.getByTestId("schedule-editor-back-link");
    await expect(back).toHaveAttribute("href", detailHref);
    await back.click();
    await expect(page).toHaveURL(new RegExp(`${detailHref}$`));
    await expect(page.getByTestId("schedule-detail-page")).toBeVisible();
  });

  test("keyboard Enter on schedule editor Back navigates", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    const detailHref = await openDemoScheduleDetail(page);

    await page.getByTestId("schedule-edit-link").click();
    await expect(page.getByTestId("schedule-edit-page")).toBeVisible();

    const back = page.getByTestId("schedule-editor-back-link");
    await back.focus();
    await expect(back).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${detailHref}$`));
    await expect(page.getByTestId("schedule-detail-page")).toBeVisible();
  });

  test("modified click on Edit schedule keeps the current document", async ({
    page,
    context,
  }) => {
    await signInAsDemoUser(page, "admin");
    const detailHref = await openDemoScheduleDetail(page);
    const currentUrl = page.url();

    const popupPromise = context.waitForEvent("page");
    await page.getByTestId("schedule-edit-link").click({
      modifiers: ["ControlOrMeta"],
    });
    const popup = await popupPromise;
    await popup.waitForURL(new RegExp(`${detailHref}/edit`));
    await expect(page).toHaveURL(currentUrl);
    await expect(popup.getByTestId("schedule-edit-page")).toBeVisible();
    await popup.close();
  });

  test("5S Upcoming and Create schedule links navigate", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s");
    await page.getByTestId("five-s-upcoming-link").click();
    await expect(page).toHaveURL(/\/platform\/schedule(?:\?|$)/);
    await expect(page.getByTestId("schedule-list-page")).toBeVisible();

    await page.goto("/platform/5s/standards");
    const standardLink = page.getByRole("link", {
      name: DEMO_FIVE_S_STANDARD.name,
    });
    await expect(standardLink).toBeVisible();
    const standardHref = await standardLink.getAttribute("href");
    expect(standardHref).toMatch(/\/platform\/5s\/standards\/[0-9a-f-]{36}$/);
    await page.goto(standardHref as string);
    const create = page.getByTestId("create-schedule-link");
    await expect(create).toBeVisible();
    const createHref = await create.getAttribute("href");
    expect(createHref).toMatch(/\/platform\/schedule\/new\?/);
    expect(createHref).toContain("returnTo=/platform/5s/standards/");

    await create.click();
    await expect(page).toHaveURL(/\/platform\/schedule\/new\?/);
    await expect(page.getByTestId("schedule-new-page")).toBeVisible();
    await expect(page.getByTestId("schedule-form")).toBeVisible();

    const back = page.getByTestId("schedule-new-back-link");
    const backHref = await back.getAttribute("href");
    expect(backHref).toMatch(/\/platform\/5s\/standards\/[0-9a-f-]{36}$/);
    await back.click();
    await expect(page).toHaveURL(new RegExp(`${backHref}$`));
  });

  test("Gemba Upcoming link navigates to schedule", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/gemba");
    await page.getByTestId("gemba-upcoming-link").click();
    await expect(page).toHaveURL(/\/platform\/schedule(?:\?|$)/);
    await expect(page.getByTestId("schedule-list-page")).toBeVisible();
  });
});
