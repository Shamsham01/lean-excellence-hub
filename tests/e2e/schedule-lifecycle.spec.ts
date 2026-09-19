import { expect, test } from "@playwright/test";

import { DEMO_FIVE_S_STANDARD } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const suffix = Date.now().toString();

async function createScheduleFromStandard(
  page: import("@playwright/test").Page,
  title: string,
  frequency: "daily" | "weekly" | "monthly",
) {
  await page.goto("/platform/5s/standards");
  await page.getByRole("link", { name: DEMO_FIVE_S_STANDARD.name }).click();
  await page.getByTestId("create-schedule-link").click();
  await expect(page.getByTestId("schedule-form")).toBeVisible();
  await page.getByTestId("schedule-title").fill(title);
  await page.getByTestId("schedule-unit-select").selectOption({ index: 1 });
  await page.getByTestId("schedule-owner-select").selectOption({ index: 1 });
  await page.getByTestId("schedule-frequency").selectOption(frequency);
  await page.getByTestId("schedule-submit").click();
  await expect(page).toHaveURL(/\/platform\/5s\/standards\//);
}

test.describe("Schedule lifecycle reliability", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  let weeklyPath = "";
  const weeklyTitle = `Lifecycle weekly ${suffix}`;
  const weeklyEdited = `Lifecycle weekly edited ${suffix}`;
  const weeklyDescription = `SCHED-EDIT-001 description ${suffix}`;
  const dailyTitle = `Lifecycle daily ${suffix}`;
  const monthlyTitle = `Lifecycle monthly ${suffix}`;

  test("creates daily, weekly, and monthly schedule definitions", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await createScheduleFromStandard(page, dailyTitle, "daily");
    await createScheduleFromStandard(page, weeklyTitle, "weekly");
    await createScheduleFromStandard(page, monthlyTitle, "monthly");

    await page.goto("/platform/schedule");
    await expect(page.getByRole("link", { name: dailyTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: weeklyTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: monthlyTitle })).toBeVisible();
  });

  test("edits an active schedule and persists after refresh", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/schedule");
    await page.getByRole("link", { name: weeklyTitle }).click();
    await expect(page.getByTestId("schedule-detail-page")).toBeVisible();
    weeklyPath = new URL(page.url()).pathname;

    await page.getByTestId("schedule-edit-link").click();
    await expect(page.getByTestId("schedule-form")).toBeVisible();
    await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);
    await page.getByTestId("schedule-title").fill(weeklyEdited);
    await page.getByTestId("schedule-description").fill(weeklyDescription);
    await page.getByTestId("schedule-submit").click();

    await expect(page.getByTestId("schedule-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: weeklyEdited }),
    ).toBeVisible();
    await expect(page.getByTestId("schedule-description-text")).toHaveText(
      weeklyDescription,
    );
    await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);
    await expect(page.getByTestId("schedule-form-error")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("schedule-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: weeklyEdited }),
    ).toBeVisible();
    await expect(page.getByTestId("schedule-description-text")).toHaveText(
      weeklyDescription,
    );
    await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);

    await page.goto(`${weeklyPath}/edit`);
    await expect(page.getByTestId("schedule-form")).toBeVisible();
    await expect(page.getByTestId("schedule-title")).toHaveValue(weeklyEdited);
    await expect(page.getByTestId("schedule-description")).toHaveValue(
      weeklyDescription,
    );
    await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);
  });

  test("failed edit stays on the form and does not look like a workspace crash", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto(`${weeklyPath}/edit`);
    await expect(page.getByTestId("schedule-form")).toBeVisible();

    const startDate = await page
      .getByTestId("schedule-start-date")
      .inputValue();
    await page.getByTestId("schedule-end-date").fill("2020-01-01");
    await page.getByTestId("schedule-submit").click();

    await expect(page.getByTestId("schedule-form-error")).toBeVisible();
    await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${weeklyPath}/edit`));
    await expect(page.getByTestId("schedule-start-date")).toHaveValue(
      startDate,
    );
  });

  test("deactivates and reactivates without a dead end", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto(weeklyPath);
    await expect(page.getByTestId("schedule-status")).toHaveText("active");

    await page.getByTestId("schedule-deactivate").click();
    await expect(page.getByTestId("schedule-status")).toHaveText("inactive");
    await expect(page.getByTestId("schedule-reactivate")).toBeVisible();
    await expect(page.getByTestId("schedule-edit-link")).toHaveCount(0);

    await page.getByTestId("schedule-reactivate").click();
    await expect(page.getByTestId("schedule-status")).toHaveText("active");
    await expect(page.getByTestId("schedule-edit-link")).toBeVisible();
  });

  test("downloads a calendar file without secrets", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto(weeklyPath);
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("schedule-calendar-download").click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    if (stream) {
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
    }
    const ics = Buffer.concat(chunks).toString("utf8");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:");
    expect(ics).toContain("DTSTART");
    expect(ics).toContain("SUMMARY:");
    expect(ics).not.toMatch(/sb_secret|service_role|password/i);
  });
});
