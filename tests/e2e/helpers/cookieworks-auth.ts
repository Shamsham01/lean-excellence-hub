import { type Page } from "@playwright/test";

import {
  QA_ORGANISATION,
  QA_USERS,
} from "../../../scripts/qa-tenant/constants";
import { SITE_BOUNDARY_PEOPLE_DELEGATE } from "../../../scripts/qa-tenant/site-boundary-constants";
import { expectPlatformOrganisationName } from "./platform-home";

export type CookieWorksPersona = keyof typeof QA_USERS;

export const COOKIEWORKS_ORGANISATION = QA_ORGANISATION;

export async function loginWithCookieWorksCredentials(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await Promise.all([
    page.waitForURL(/\/platform/, { timeout: 30_000 }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  await expectPlatformOrganisationName(page, QA_ORGANISATION.name);
}

export async function loginAsCookieWorksPersona(
  page: Page,
  persona: CookieWorksPersona,
) {
  await loginWithCookieWorksCredentials(page, QA_USERS[persona]);
}

export async function loginAsSiteBoundaryPeopleDelegate(page: Page) {
  await loginWithCookieWorksCredentials(page, SITE_BOUNDARY_PEOPLE_DELEGATE);
}
