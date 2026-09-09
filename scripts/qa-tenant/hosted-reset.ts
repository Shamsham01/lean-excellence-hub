#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import { QA_ORGANISATION_CODE } from "./constants";
import { purgeCookieWorksTenantModules } from "./delete-tenant";
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
  assertCookieWorksCompleteFoundationVerified,
  formatVerificationSummary,
  verifyCookieWorksTenant,
} from "./verification";

export type HostedResetCredentials = ReturnType<
  typeof resolveHostedCredentials
>;
export type HostedResetMode = ReturnType<typeof parseHostedResetArgs>["mode"];

export async function runHostedCookieWorksReset(options?: {
  argv?: string[];
  credentials?: HostedResetCredentials;
  purgeModules?: typeof purgeCookieWorksTenantModules;
  seedFoundation?: typeof seedCookieWorksFoundation;
}) {
  const argv = options?.argv ?? process.argv.slice(2);
  const { mode } = parseHostedResetArgs(argv);
  const credentials = options?.credentials ?? resolveHostedCredentials();
  const purgeModules = options?.purgeModules ?? purgeCookieWorksTenantModules;
  const seedFoundation = options?.seedFoundation ?? seedCookieWorksFoundation;

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
    return { mode, inventory, verification, foundationVerification: null };
  }

  await purgeModules(credentials.databaseUrl, {
    storageAdmin: admin,
  });

  await seedFoundation({
    admin,
    apiUrl: credentials.apiUrl,
    publishableKey: credentials.publishableKey,
    databaseUrl: credentials.databaseUrl,
  });

  const postInventory = collectCookieWorksInventory(credentials.databaseUrl);
  const foundationVerification =
    await assertCookieWorksCompleteFoundationVerified(
      credentials.databaseUrl,
      admin,
    );

  console.log("");
  console.log("Post-reset inventory:");
  console.log(formatInventoryReport(postInventory));
  console.log("");
  console.log(formatVerificationSummary(foundationVerification.verification));
  console.log("");
  console.log("Hosted CookieWorks QA destructive reset complete.");

  return {
    mode,
    inventory: postInventory,
    verification: foundationVerification.verification,
    foundationVerification,
  };
}

async function main() {
  await runHostedCookieWorksReset();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
