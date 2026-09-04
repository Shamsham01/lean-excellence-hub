import { expect, type Page } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../../scripts/demo-seed/constants";
import { expectPlatformOrganisationName } from "./platform-home";

type SignInOptions = {
  assertOrganisation?: boolean;
};

export async function signInAsDemoUser(
  page: Page,
  user: keyof typeof DEMO_USERS,
  options: SignInOptions = {},
) {
  const { assertOrganisation = true } = options;
  const credentials = DEMO_USERS[user];

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await Promise.all([
    page.waitForURL(/\/platform/, { timeout: 30_000 }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);

  if (assertOrganisation) {
    await expectPlatformOrganisationName(page, DEMO_ORGANISATION.name);
  }
}

export async function expectSignedInDemoPlatform(
  page: Page,
  organisationName = DEMO_ORGANISATION.name,
) {
  await expect(page).toHaveURL(/\/platform/);
  await expectPlatformOrganisationName(page, organisationName);
}
