import { expect, test } from "@playwright/test";

import { DEMO_ORGANISATION } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  assertTemporaryPasswordNotPersisted,
  createServiceRoleClient,
  resolveDemoOrganisationId,
  submitWorkforceLogin,
} from "./helpers/workforce-provisioning";
import {
  awaitImportCredentialsDownloadReady,
  readWorkforceImportJobId,
  waitForImportProvisioningCheckpoint,
  waitForWorkforceImportTerminalState,
} from "./helpers/workforce-import";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("M2 workforce bulk import", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1, local Supabase, demo seed, and edge functions",
  );

  const uniqueSuffix = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const csvContent = [
    "first_name,last_name,username,notification_email,job_title,job_function,primary_unit_path,application_role,access_scope_unit_path",
    `Bulk,One,bulk.one.${uniqueSuffix},,Operator,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations`,
    `Bulk,Two,bulk.two.${uniqueSuffix},,Operator,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations`,
    `Bulk,Three,bulk.three.${uniqueSuffix},,Operator,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations`,
  ].join("\n");

  let organisationId = "";
  let exportedPassword = "";

  test("admin can access import workflow and provision employees", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin", { assertOrganisation: false });
    organisationId = await resolveDemoOrganisationId();

    await page.goto("/platform/settings/people");
    await page.getByTestId("import-workforce-link").click();
    await expect(page.getByTestId("workforce-import-wizard")).toBeVisible();

    await page.setInputFiles("input[type='file']", {
      name: "bulk-import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });

    await page.getByTestId("validate-import").click();
    await expect(page.getByTestId("start-import-provisioning")).toBeVisible();
    await page.getByTestId("start-import-provisioning").click();
    const jobId = await readWorkforceImportJobId(page);
    await awaitImportCredentialsDownloadReady(page, jobId);

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("download-import-credentials").click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    const exported = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of exported) {
      chunks.push(Buffer.from(chunk));
    }
    const csv = Buffer.concat(chunks).toString("utf8");
    expect(csv).toContain(`bulk.one.${uniqueSuffix}`);
    const passwordMatch = csv.match(/bulk\.one\.[^,]+,[^,]+,([^,\n]+)/);
    exportedPassword = passwordMatch?.[1] ?? "";
    expect(exportedPassword.length).toBeGreaterThan(8);

    assertTemporaryPasswordNotPersisted(
      exportedPassword,
      organisationId,
      `bulk.one.${uniqueSuffix}`,
    );
  });

  test("imported employee can sign in and must change password", async ({
    browser,
  }) => {
    expect(exportedPassword.length).toBeGreaterThan(8);

    const context = await browser.newContext();
    const page = await context.newPage();

    await submitWorkforceLogin(page, {
      organisationCode: DEMO_ORGANISATION.code,
      workforceAlias: `bulk.one.${uniqueSuffix}`,
      password: exportedPassword,
    });

    await expect(
      page.getByRole("heading", { name: "Set a new password" }),
    ).toBeVisible({ timeout: 30_000 });
    const permanentPassword = `BulkPermanent!Ab9_${uniqueSuffix.slice(-8)}`;
    await page.locator("#password").fill(permanentPassword);
    await Promise.all([
      page.waitForURL(/\/platform/, { timeout: 60_000 }),
      page.getByRole("button", { name: "Update password" }).click(),
    ]);
    await context.close();
  });

  test("validation rejects invalid file before provisioning", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin", { assertOrganisation: false });
    await page.goto("/platform/settings/people/import");

    const invalidCsv = [
      "first_name,last_name,username,notification_email,job_title,job_function,primary_unit_path,application_role,access_scope_unit_path",
      `Dup,User,dup.${uniqueSuffix},,Operator,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations`,
      `Dup,Again,dup.${uniqueSuffix},,Operator,Operator,Cornwall Plant > Operations,Team Member,Cornwall Plant > Operations`,
    ].join("\n");

    await page.setInputFiles("input[type='file']", {
      name: "invalid.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(invalidCsv),
    });
    await page.getByTestId("validate-import").click();
    await expect(page.getByText(/duplicated/i)).toBeVisible();
    await expect(page.getByTestId("start-import-provisioning")).toHaveCount(0);

    const serviceClient = createServiceRoleClient();
    const { count } = await serviceClient
      .from("workforce_provision_intents")
      .select("id", { count: "exact", head: true })
      .like("target_canonical_alias", `dup.${uniqueSuffix}`);
    expect(count ?? 0).toBe(0);
  });

  test("manager cannot access bulk import", async ({ page }) => {
    await signInAsDemoUser(page, "manager", { assertOrganisation: false });
    await page.goto("/platform/settings/people/import");
    await expect(page).toHaveURL(/\/platform\/settings\/people$/);
  });

  test("interrupted import resumes without duplicating employees", async ({
    page,
  }) => {
    const resumeSuffix = `resume.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    const resumeCsv = [
      "first_name,last_name,username,notification_email,job_title,job_function,primary_unit_path,application_role,access_scope_unit_path",
      ...Array.from({ length: 3 }, (_, index) =>
        [
          `Resume${index + 1}`,
          "User",
          `resume.${index + 1}.${resumeSuffix}`,
          "",
          "Operator",
          "Operator",
          "Cornwall Plant > Operations",
          "Team Member",
          "Cornwall Plant > Operations",
        ].join(","),
      ),
    ].join("\n");

    await signInAsDemoUser(page, "admin", { assertOrganisation: false });
    await page.goto("/platform/settings/people/import");

    await page.setInputFiles("input[type='file']", {
      name: `resume-import-${resumeSuffix}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(resumeCsv),
    });
    await page.getByTestId("validate-import").click();
    await page.getByTestId("start-import-provisioning").click();
    const jobId = await readWorkforceImportJobId(page);
    await waitForImportProvisioningCheckpoint(jobId, 1);

    await page.goto("/platform/settings/people");
    await page.goto(`/platform/settings/people/import/${jobId}`);
    await expect(page.getByTestId("workforce-import-job-page")).toBeVisible();

    const terminalProgress = await waitForWorkforceImportTerminalState(jobId);
    expect(terminalProgress.provisionedRows).toBe(3);
    await awaitImportCredentialsDownloadReady(page, jobId);
    await expect(page.getByTestId("import-provisioned-count")).toContainText(
      "Provisioned: 3",
    );

    await page.reload();
    await expect(page.getByTestId("workforce-import-job-page")).toBeVisible();
    await expect(page.getByTestId("import-provisioned-count")).toContainText(
      "Provisioned: 3",
    );
    await expect(page.getByTestId("download-import-credentials")).toBeEnabled();
  });

  test("credential export cannot be downloaded twice", async ({ page }) => {
    await signInAsDemoUser(page, "admin", { assertOrganisation: false });
    await page.goto("/platform/settings/people/import");
    await expect(page.getByTestId("download-import-credentials")).toHaveCount(
      0,
    );
  });
});
