import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { openPeoplePendingInvitationsTab } from "./helpers/form-dialogs";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const HEADER =
  "record_type,display_name,email,department,site,role,access_scope_site,parent_site_path,area_name,area_code,unit_type";

test.describe("People colleague CSV import", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1, local Supabase, and demo seed",
  );

  const uniqueSuffix = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

  test("non-admin cannot open colleague import", async ({ page }) => {
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/settings/people/colleague-import");
    await expect(page).toHaveURL(/\/platform\/settings\/people$/);
  });

  test("admin sees validation errors for invalid rows", async ({ page }) => {
    await signInAsDemoUser(page, "admin", { assertOrganisation: false });
    await page.goto("/platform/settings/people/colleague-import");
    await expect(
      page.getByTestId("people-invitation-import-wizard"),
    ).toBeVisible();

    const invalidCsv = [
      HEADER,
      `person,Bad Email,not-an-email,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations,,,,`,
    ].join("\n");

    await page.setInputFiles("input[type='file']", {
      name: "invalid-colleagues.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(invalidCsv),
    });

    await page.getByTestId("validate-colleague-import").click();
    await expect(page.getByText("Email format is invalid.")).toBeVisible();
    await expect(page.getByTestId("confirm-colleague-import")).toHaveCount(0);
  });

  test("admin can validate and import colleague invitations", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin", { assertOrganisation: false });
    await page.goto("/platform/settings/people/colleague-import");

    const email = `colleague.import.${uniqueSuffix}@example.test`;
    const validCsv = [
      HEADER,
      `person,Import Test,${email},Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations,,,,`,
    ].join("\n");

    await page.setInputFiles("input[type='file']", {
      name: "valid-colleagues.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(validCsv),
    });

    await page.getByTestId("validate-colleague-import").click();
    await expect(page.getByTestId("confirm-colleague-import")).toBeVisible();
    await page.getByTestId("confirm-colleague-import").click();

    await expect(page.getByTestId("colleague-import-summary")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/Invitations created: 1/)).toBeVisible();

    await page.goto("/platform/settings/people");
    await openPeoplePendingInvitationsTab(page);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test("re-uploading the same file does not duplicate invitations", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin", { assertOrganisation: false });
    const email = `colleague.import.${uniqueSuffix}@example.test`;
    const validCsv = [
      HEADER,
      `person,Import Test,${email},Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations,,,,`,
    ].join("\n");

    await page.goto("/platform/settings/people/colleague-import");
    await page.setInputFiles("input[type='file']", {
      name: "repeat-colleagues.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(validCsv),
    });
    await page.getByTestId("validate-colleague-import").click();
    await page.getByTestId("confirm-colleague-import").click();
    await expect(page.getByTestId("colleague-import-summary")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/Skipped: 1/)).toBeVisible();
    await expect(page.getByText(/Invitations created: 0/)).toBeVisible();
  });
});
