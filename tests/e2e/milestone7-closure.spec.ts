import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_TRAINING_COURSES,
  DEMO_TRAINING_SESSION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function loginAs(page: Page, user: keyof typeof DEMO_USERS) {
  const credentials = DEMO_USERS[user];
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
  await expect(
    page.getByRole("main").getByText(DEMO_ORGANISATION.name),
  ).toBeVisible();
}

test.describe("Milestone 7 closure", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("training admin: session bulk completion updates matrix", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/training/sessions");
    await page.getByRole("link", { name: DEMO_TRAINING_SESSION.title }).click();
    await expect(page.getByTestId("session-workspace")).toBeVisible();

    await page.getByTestId("open-bulk-completion").click();
    await expect(page.getByTestId("bulk-completion-dialog")).toBeVisible();

    const checkbox = page
      .locator('[data-testid^="participant-checkbox-"]')
      .first();
    await checkbox.click();

    await page.getByTestId("bulk-completion-review").click();
    const bulkDialog = page.getByTestId("bulk-completion-dialog");
    await expect(bulkDialog.getByText("Course: White Belt")).toBeVisible();
    await expect(page.getByText("People:")).toBeVisible();

    await page.getByTestId("bulk-completion-confirm").click();
    await expect(page.getByTestId("bulk-completion-dialog")).not.toBeVisible();

    await page.goto("/platform/training/matrix");
    await expect(page.getByTestId("training-matrix")).toBeVisible();
    await expect(page.getByText("White Belt").first()).toBeVisible();
  });

  test("manager: skill assessment updates skills matrix", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto("/platform/people");
    await page
      .getByRole("link", { name: DEMO_USERS.operator.displayName })
      .click();
    await expect(page.getByTestId("capability-profile-page")).toBeVisible();

    await page.getByTestId("open-skill-assessment").click();
    await expect(page.getByTestId("skill-assessment-dialog")).toBeVisible();

    await page
      .getByTestId("skill-assessment-skill")
      .selectOption({ label: "5S Auditing" });
    await page
      .getByTestId("skill-assessment-level")
      .selectOption({ label: "Advanced (4)" });
    await page.getByTestId("skill-assessment-save").click();

    await page.goto("/platform/skills/matrix");
    await expect(page.getByTestId("skills-matrix")).toBeVisible();
    await expect(
      page.getByLabel(
        new RegExp(`${DEMO_USERS.operator.displayName} — 5S Auditing`),
      ),
    ).toBeVisible();
  });

  test("operator: own profile allowed, other profile denied", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/people");
    const managerHref = await page
      .getByRole("link", { name: DEMO_USERS.manager.displayName })
      .getAttribute("href");
    expect(managerHref).toBeTruthy();

    await loginAs(page, "operator");
    await page.goto("/platform/people/me");
    await expect(page.getByTestId("capability-profile-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Training" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();

    await page.goto(managerHref!);
    await expect(page.getByTestId("capability-profile-page")).not.toBeVisible();
  });

  test("historical integrity: course successor preserves completion version", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/platform/people");
    await page
      .getByRole("link", { name: DEMO_USERS.operator.displayName })
      .click();
    await expect(page.getByText("Lean Basic")).toBeVisible();

    await page.goto("/platform/training/courses");
    await page
      .getByRole("link", { name: DEMO_TRAINING_COURSES[0].name })
      .click();
    await page.getByTestId("create-course-successor").click();
    await expect(page.getByText("Version 2")).toBeVisible();

    await page.goto("/platform/people");
    await page
      .getByRole("link", { name: DEMO_USERS.operator.displayName })
      .click();
    await expect(page.getByText("Lean Basic")).toBeVisible();
    await expect(page.getByText(/valid|Completed/i).first()).toBeVisible();
  });

  test("responsive: matrices and profile layouts", async ({ page }) => {
    await loginAs(page, "admin");

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/platform/training/matrix");
    await expect(page.getByTestId("training-matrix")).toBeVisible();

    await page.goto("/platform/skills/matrix");
    await expect(page.getByTestId("skills-matrix")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/platform/people/me");
    await expect(page.getByTestId("capability-profile-page")).toBeVisible();
  });

  test("security: manipulated membership URL denied", async ({ page }) => {
    await loginAs(page, "operator");
    await page.goto("/platform/people/00000000-0000-0000-0000-000000000099");
    await expect(page.getByTestId("capability-profile-page")).not.toBeVisible();
  });
});
