import { expect, type Page } from "@playwright/test";

export async function expectPlatformOrganisationName(
  page: Page,
  organisationName: string,
) {
  await expect(page.getByTestId("platform-org-name")).toHaveText(
    organisationName,
  );
}
