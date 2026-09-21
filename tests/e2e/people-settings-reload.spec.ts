import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  ensureOnboardingE2eOrganisation,
  onboardingE2eCredentials,
  onboardingOrgAdminCredentials,
} from "./helpers/onboarding-auth";
import { signInAsDemoUser } from "./helpers/demo-auth";
import { loginAsSiteBoundaryPeopleDelegate } from "./helpers/cookieworks-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const PEOPLE_SETTINGS_PATH = "/platform/settings/people";

async function loginAs(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
}

async function assertAuthorisedPeopleControls(page: Page) {
  const peoplePage = page.getByTestId("people-settings-page");
  await expect(peoplePage).toBeVisible();
  await expect(page.getByTestId("invite-colleague-form")).toBeVisible();
  await expect(page.getByTestId("people-settings-create-link")).toBeVisible();
  await expect(page.locator("#invite-role")).toBeVisible();
  await expect(
    page.getByText("Ask an Organisation Administrator to invite colleagues"),
  ).toHaveCount(0);
}

test.describe("People settings delegation gate stability", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and local Supabase with seeded organisations",
  );

  test.beforeAll(async () => {
    await ensureOnboardingE2eOrganisation();
    execSync("npm run qa:site-boundary:reset", {
      cwd: join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
      env: {
        ...process.env,
        LEANHUB_ALLOW_QA_TENANT: "1",
      },
      stdio: "pipe",
      encoding: "utf8",
    });
  });

  test("organisation owner retains invite and workforce controls across navigation modes", async ({
    page,
  }) => {
    await loginAs(page, onboardingE2eCredentials);

    await page.goto("/platform/settings");
    await page.getByTestId("settings-hub-open-platform-settings-people").click();
    await assertAuthorisedPeopleControls(page);

    await page.goto(PEOPLE_SETTINGS_PATH);
    await assertAuthorisedPeopleControls(page);

    await page.reload();
    await assertAuthorisedPeopleControls(page);

    for (let reload = 0; reload < 10; reload += 1) {
      await page.reload();
      await assertAuthorisedPeopleControls(page);
    }
  });

  test("organisation administrator retains invite controls after repeated reloads", async ({
    page,
  }) => {
    await loginAs(page, onboardingOrgAdminCredentials);
    await page.goto(PEOPLE_SETTINGS_PATH);
    await assertAuthorisedPeopleControls(page);

    for (let reload = 0; reload < 10; reload += 1) {
      await page.reload();
      await assertAuthorisedPeopleControls(page);
    }
  });

  test("demo organisation owner retains controls after direct URL and hard reload", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto(PEOPLE_SETTINGS_PATH);
    await assertAuthorisedPeopleControls(page);
    await page.reload();
    await assertAuthorisedPeopleControls(page);
  });

  test("unauthorised member never receives people administration controls", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto(PEOPLE_SETTINGS_PATH);
    await expect(page.getByTestId("people-settings-page")).not.toBeVisible();
    await expect(page.getByTestId("invite-colleague-form")).not.toBeVisible();
    await expect(
      page.getByTestId("people-settings-create-link"),
    ).not.toBeVisible();
  });

  test("site-scoped people delegate sees scoped invite controls without org-wide authority", async ({
    page,
  }) => {
    await loginAsSiteBoundaryPeopleDelegate(page);
    await page.goto(PEOPLE_SETTINGS_PATH);
    await expect(page.getByTestId("invite-colleague-form")).toBeVisible({
      timeout: 30_000,
    });

    const scopeSelect = page.locator("#invite-scope");
    await page.locator("#invite-role").selectOption({ index: 0 });
    const scopeLabels = await scopeSelect
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => option.textContent?.trim() ?? "")
          .filter((label) => label.length > 0 && label !== "Select scope"),
      );

    expect(scopeLabels).not.toContain("Entire organisation");
    await expect(page.getByTestId("people-settings-create-link")).toHaveCount(
      0,
    );
  });
});
