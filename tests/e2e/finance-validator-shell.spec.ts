import { expect, test, type Page } from "@playwright/test";

import { expectPlatformOrganisationName } from "./helpers/platform-home";
import {
  DEMO_ORGANISATION,
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
  await expectPlatformOrganisationName(page, DEMO_ORGANISATION.name);
}

test.describe("Finance Validator shell hotfix", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("finance validator sees Home, Benefits, and Settings", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await expect(
      page.getByRole("link", { name: "Home", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Benefits", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "People", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Projects", exact: true }),
    ).not.toBeVisible();
  });

  test("finance validator settings hub exposes profile and hides people administration", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await page.goto("/platform/settings");
    await expect(page.getByTestId("settings-page")).toBeVisible();
    await expect(
      page.getByTestId("settings-hub-card-platform-settings-profile"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("settings-hub-card-platform-settings-people")
        .getByRole("link", { name: "Open" }),
    ).not.toBeVisible();
    await expect(page.getByText("Job functions")).not.toBeVisible();
    await expect(page.getByText("Lean AI")).not.toBeVisible();
  });

  test("finance validator can view and update own profile", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await page.goto("/platform/settings/profile");
    await expect(page.getByTestId("profile-settings-page")).toBeVisible();
    await expect(page.getByTestId("profile-application-role")).toHaveText(
      "Finance Validator",
    );
    await expect(page.getByTestId("profile-access-scope")).toHaveText(
      "Entire organisation",
    );
    await expect(page.getByTestId("profile-display-name-form")).toBeVisible();
    await expect(
      page.getByText(
        "Job function, work area, and application access are managed by your organisation administrator.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "your administration profile" }),
    ).not.toBeVisible();

    const updatedName = `Apex Finance ${Date.now().toString(36)}`;
    await page.getByLabel("Display name").fill(updatedName);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByLabel("Display name")).toHaveValue(updatedName);
  });

  test("finance validator cannot access people administration routes", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await page.goto("/platform/settings/people");
    await expect(page.getByTestId("people-settings-page")).not.toBeVisible();
    await page.goto("/platform/settings/people/create");
    await expect(
      page.getByRole("heading", { name: "Create workforce user" }),
    ).not.toBeVisible();
  });
});
