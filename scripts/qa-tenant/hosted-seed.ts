#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import { QA_ORGANISATION, QA_ORGANISATION_CODE } from "./constants";
import { seedCookieWorksFoundation } from "./foundation-seed";
import {
  assertHostedSeedAllowed,
  extractSupabaseProjectRef,
  resolveHostedSeedCredentials,
} from "./guards";
import {
  collectCookieWorksInventory,
  formatInventoryReport,
} from "./inventory";
import {
  assertCookieWorksFoundationOnlyVerified,
  formatVerificationSummary,
} from "./verification";

export type HostedSeedCredentials = ReturnType<
  typeof resolveHostedSeedCredentials
>;

export async function runHostedCookieWorksSeed(options?: {
  credentials?: HostedSeedCredentials;
  seedFoundation?: typeof seedCookieWorksFoundation;
}) {
  const credentials = options?.credentials ?? resolveHostedSeedCredentials();
  const seedFoundation = options?.seedFoundation ?? seedCookieWorksFoundation;

  assertHostedSeedAllowed({
    apiUrl: credentials.apiUrl,
    expectedProjectRef: credentials.expectedProjectRef,
  });

  if (!credentials.databaseUrl) {
    throw new Error(
      "Hosted CookieWorks seed requires LEANHUB_QA_RESET_DATABASE_URL for post-seed foundation verification.",
    );
  }

  const projectRef =
    extractSupabaseProjectRef(credentials.apiUrl) ??
    credentials.expectedProjectRef;

  const admin = createClient(credentials.apiUrl, credentials.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Hosted CookieWorks QA foundation seed");
  console.log(`Target project ref: ${projectRef}`);
  console.log(`Target API URL: ${credentials.apiUrl}`);
  console.log(`Target organisation code: ${QA_ORGANISATION_CODE}`);
  console.log("");

  const { organisationId } = await seedFoundation({
    admin,
    apiUrl: credentials.apiUrl,
    publishableKey: credentials.publishableKey,
    databaseUrl: credentials.databaseUrl,
  });

  const inventory = collectCookieWorksInventory(credentials.databaseUrl);
  const verification = assertCookieWorksFoundationOnlyVerified(
    credentials.databaseUrl,
  );

  console.log(formatInventoryReport(inventory));
  console.log("");
  console.log(formatVerificationSummary(verification));
  console.log("");
  console.log("Hosted CookieWorks QA foundation seed complete.");
  console.log(
    `Organisation: ${QA_ORGANISATION.name} (${QA_ORGANISATION.code})`,
  );
  console.log(`Organisation ID: ${organisationId}`);
  console.log("Inventory dry-run: npm run qa:cookie:hosted-reset");

  return { organisationId, inventory, verification };
}
