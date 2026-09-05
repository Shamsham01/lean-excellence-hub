#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import { QA_ORGANISATION_CODE } from "./constants";
import {
  assertCookieWorksResetVerified,
  purgeCookieWorksTenantModules,
} from "./delete-tenant";
import { seedCookieWorksFoundation } from "./foundation-seed";
import {
  assertHostedResetAllowed,
  extractSupabaseProjectRef,
  parseHostedResetArgs,
  resolveHostedCredentials,
} from "./guards";
import {
  collectCookieWorksInventory,
  formatInventoryReport,
} from "./inventory";
import { countCookieWorksStorageObjects } from "./storage-cleanup";
import {
  formatVerificationSummary,
  verifyCookieWorksTenant,
} from "./verification";

async function main() {
  const { mode } = parseHostedResetArgs(process.argv.slice(2));
  const credentials = resolveHostedCredentials();

  assertHostedResetAllowed({
    apiUrl: credentials.apiUrl,
    expectedProjectRef: credentials.expectedProjectRef,
    organisationCode: QA_ORGANISATION_CODE,
    mode,
  });

  const admin = createClient(credentials.apiUrl, credentials.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const inventory = collectCookieWorksInventory(credentials.databaseUrl);
  const verification = verifyCookieWorksTenant(credentials.databaseUrl);
  const storageObjectCount = countCookieWorksStorageObjects(
    credentials.databaseUrl,
  );
  const projectRef =
    extractSupabaseProjectRef(credentials.apiUrl) ??
    credentials.expectedProjectRef;

  console.log("Hosted CookieWorks QA reset plan");
  console.log(`Mode: ${mode}`);
  console.log(`Target project ref: ${projectRef}`);
  console.log(`Target API URL: ${credentials.apiUrl}`);
  console.log(`Target organisation code: ${QA_ORGANISATION_CODE}`);
  console.log(
    `Resolved organisation name: ${
      inventory.organisation?.name ?? "not provisioned"
    }`,
  );
  console.log(
    `Resolved organisation UUID: ${inventory.organisation?.id ?? "n/a"}`,
  );
  console.log(`Storage objects (organisation-evidence): ${storageObjectCount}`);
  console.log("");
  console.log(formatInventoryReport(inventory));
  console.log("");
  console.log(formatVerificationSummary(verification));

  if (mode === "dry-run") {
    console.log("");
    console.log("Dry-run only. No hosted data was modified.");
    console.log(
      `To execute destructively, set LEANHUB_QA_RESET_CONFIRM=DELETE_COOKIEWORKS_ONLY and rerun with --destructive.`,
    );
    return;
  }

  await purgeCookieWorksTenantModules(credentials.databaseUrl, {
    storageAdmin: admin,
  });

  await seedCookieWorksFoundation({
    admin,
    apiUrl: credentials.apiUrl,
    publishableKey: credentials.publishableKey,
    databaseUrl: credentials.databaseUrl,
  });

  const postInventory = collectCookieWorksInventory(credentials.databaseUrl);
  const postVerification = assertCookieWorksResetVerified(
    credentials.databaseUrl,
  );

  console.log("");
  console.log("Post-reset inventory:");
  console.log(formatInventoryReport(postInventory));
  console.log("");
  console.log(formatVerificationSummary(postVerification));
  console.log("");
  console.log("Hosted CookieWorks QA destructive reset complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
