import { expect, type Page } from "@playwright/test";

export async function expectPlatformOrganisationName(
  page: Page,
  organisationName: string,
) {
  const mobileOrg = page.getByTestId("platform-mobile-org-name");
  const sidebarOrg = page.getByTestId("platform-sidebar-org-name");

  if (await mobileOrg.isVisible()) {
    await expect(mobileOrg).toHaveText(organisationName);
    return;
  }

  if (await sidebarOrg.isVisible()) {
    await expect(sidebarOrg).toHaveText(organisationName);
    return;
  }

  await expect(
    page.getByRole("main").getByTestId("platform-org-name"),
  ).toHaveText(organisationName);
}
