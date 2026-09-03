import { expect, type Page } from "@playwright/test";

import {
  QA_ORGANISATION,
  QA_USERS,
} from "../../../scripts/qa-tenant/constants";
import { expectPlatformOrganisationName } from "./platform-home";

export type CookieWorksPersona = keyof typeof QA_USERS;

export const COOKIEWORKS_ORGANISATION = QA_ORGANISATION;

export async function loginAsCookieWorksPersona(
  page: Page,
  persona: CookieWorksPersona,
) {
  const credentials = QA_USERS[persona];
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
  await expectPlatformOrganisationName(page, QA_ORGANISATION.name);
}
