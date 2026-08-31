import { expect, test } from "@playwright/test";

import { DEMO_ORGANISATION } from "../../scripts/demo-seed/constants";
import {
  assertTemporaryPasswordNotPersisted,
  createAuthenticatedClient,
  lookupWorkforceInternalLogin,
  lookupWorkforceProvisionedUser,
  memberHasPermission,
  resolveDemoOrganisationId,
  submitWorkforceLogin,
  workforceProvisioningAdmin,
} from "./helpers/workforce-provisioning";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("M1 workforce provisioning", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1, local Supabase, demo seed, and edge functions",
  );

  const uniqueSuffix = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const workforceUsername = `m1.operator.${uniqueSuffix}`;
  const permanentPassword = `M1PermanentPass!${uniqueSuffix.slice(-4)}`;
  let organisationCode = DEMO_ORGANISATION.code;
  let temporaryPassword = "";
  let organisationId = "";

  test("admin creates a workforce user and receives one-time credentials", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(workforceProvisioningAdmin.email);
    await page.getByLabel("Password").fill(workforceProvisioningAdmin.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/platform/);

    organisationId = await resolveDemoOrganisationId();

    await page.goto("/platform/settings/people/create");
    await expect(page.getByTestId("create-workforce-user-form")).toBeVisible();

    await page.getByLabel("Display name").fill("M1 Workforce Operator");
    await page.getByLabel(/^Username$/).fill(workforceUsername);
    await page.locator("#roleVersionId").selectOption({ label: "Team Member" });
    await page.locator("#scopeKey").selectOption({ label: "Operations" });
    await page.locator("#jobFunctionId").selectOption({ label: "Operator" });
    const unitOptionValue = await page
      .locator("#organisationalUnitId option", { hasText: "Operations" })
      .first()
      .getAttribute("value");
    if (!unitOptionValue) {
      throw new Error(
        "Expected an Operations unit option for workforce provisioning.",
      );
    }
    await page.locator("#organisationalUnitId").selectOption(unitOptionValue);
    await page.getByTestId("submit-create-workforce-user").click();

    await expect(page.getByTestId("workforce-credentials-panel")).toBeVisible();
    await expect(page.getByTestId("organisation-code")).toHaveText(
      DEMO_ORGANISATION.code,
    );
    await expect(page.getByTestId("workforce-username")).toHaveText(
      workforceUsername,
    );

    const passwordLocator = page.getByTestId("temporary-password");
    await expect(passwordLocator).toBeVisible();
    temporaryPassword = (await passwordLocator.textContent())?.trim() ?? "";
    expect(temporaryPassword.length).toBeGreaterThan(8);
    organisationCode = DEMO_ORGANISATION.code;

    await expect(
      page.getByTestId("create-another-workforce-user"),
    ).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(
      page.getByTestId("create-another-workforce-user"),
    ).toBeEnabled();

    await page.reload();
    await expect(page.getByTestId("create-workforce-user-form")).toBeVisible();
    await expect(page.getByTestId("temporary-password")).toHaveCount(0);

    assertTemporaryPasswordNotPersisted(
      temporaryPassword,
      organisationId,
      workforceUsername,
    );
  });

  test("fresh browser workforce login requires password replacement", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await submitWorkforceLogin(page, {
      organisationCode,
      workforceAlias: workforceUsername,
      password: temporaryPassword,
    });

    await expect(page).toHaveURL(/\/update-password/);
    await expect(
      page.getByRole("heading", { name: "Set a new password" }),
    ).toBeVisible();

    await page.goto("/platform");
    await expect(page).toHaveURL(/\/update-password/);

    await context.close();
  });

  test("password replacement completes enrolment and unlocks platform access", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await submitWorkforceLogin(page, {
      organisationCode,
      workforceAlias: workforceUsername,
      password: temporaryPassword,
    });
    await expect(page).toHaveURL(/\/update-password/);

    await page.locator("#password").fill(permanentPassword);
    await Promise.all([
      page.waitForURL(/\/platform/, { timeout: 60_000 }),
      page.getByRole("button", { name: "Update password" }).click(),
    ]);

    const internalLogin = await lookupWorkforceInternalLogin(
      organisationCode,
      workforceUsername,
    );
    expect(internalLogin).not.toBeNull();

    const provisioned = await lookupWorkforceProvisionedUser(
      organisationId,
      workforceUsername,
    );
    if (provisioned) {
      expect(provisioned.membership_status).toBe("active");
      expect(provisioned.enrolment_status).toBe("complete");
      expect(provisioned.role_canonical_name).toBe("team-member");
      expect(provisioned.scope_type).toBe("unit_subtree");
      expect(provisioned.job_function_code).toBe("operator");
      expect(provisioned.unit_name).toMatch(/Operations/i);
    }

    const workforceClient = await createAuthenticatedClient(
      internalLogin!,
      permanentPassword,
    );

    await workforceClient.rpc("switch_organisation", {
      target_organisation_id: organisationId,
    });

    expect(await memberHasPermission(workforceClient, "actions.read")).toBe(
      true,
    );
    expect(
      await memberHasPermission(workforceClient, "invitations.manage"),
    ).toBe(false);
    expect(
      await memberHasPermission(workforceClient, "workforce.provision"),
    ).toBe(false);

    await page.goto("/platform/settings");
    await expect(page.getByTestId("settings-page")).toBeVisible();
    await expect(page.getByText("Your profile")).toBeVisible();

    await page.goto("/platform/settings/profile");
    await expect(page.getByTestId("profile-settings-page")).toBeVisible();

    await page.goto("/platform/settings/people");
    await expect(page.getByTestId("people-settings-page")).not.toBeVisible();

    await context.close();
  });

  test("original temporary password is rejected after enrolment", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await submitWorkforceLogin(page, {
      organisationCode,
      workforceAlias: workforceUsername,
      password: temporaryPassword,
    });
    await expect(page).toHaveURL(/\/workforce-login\?error=invalid/);

    await submitWorkforceLogin(page, {
      organisationCode,
      workforceAlias: workforceUsername,
      password: permanentPassword,
    });
    await expect(page).toHaveURL(/\/platform/);

    await context.close();
  });
});
