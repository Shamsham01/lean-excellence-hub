#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import { QA_ORGANISATION } from "./constants";
import { seedCookieWorksFoundation } from "./foundation-seed";
import { loadLocalSupabaseEnv } from "./local-env";

async function main() {
  const env = loadLocalSupabaseEnv("qa:cookie:seed");
  const admin = createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Seeding CookieWorks QA foundation (local development only)...");

  const { organisationId } = await seedCookieWorksFoundation({
    admin,
    apiUrl: env.apiUrl,
    publishableKey: env.publishableKey,
    databaseUrl: env.databaseUrl,
  });

  console.log("CookieWorks QA foundation seed complete.");
  console.log(
    `Organisation: ${QA_ORGANISATION.name} (${QA_ORGANISATION.code})`,
  );
  console.log(`Organisation ID: ${organisationId}`);
  console.log("Inventory: npm run qa:cookie:inventory");
  console.log("Reset: npm run qa:cookie:reset");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
