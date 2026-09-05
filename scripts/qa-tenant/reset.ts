#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import {
  assertCookieWorksResetVerified,
  purgeCookieWorksTenantModules,
} from "./delete-tenant";
import { seedCookieWorksFoundation } from "./foundation-seed";
import {
  collectCookieWorksInventory,
  formatInventoryReport,
} from "./inventory";
import { loadLocalSupabaseEnv } from "./local-env";
import { formatVerificationSummary } from "./verification";

async function main() {
  const env = loadLocalSupabaseEnv("qa:cookie:reset");
  const admin = createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Resetting CookieWorks QA tenant to foundation-only state...");

  await purgeCookieWorksTenantModules(env.databaseUrl, { storageAdmin: admin });

  await seedCookieWorksFoundation({
    admin,
    apiUrl: env.apiUrl,
    publishableKey: env.publishableKey,
    databaseUrl: env.databaseUrl,
  });

  const inventory = collectCookieWorksInventory(env.databaseUrl);
  const verification = assertCookieWorksResetVerified(env.databaseUrl);

  console.log("");
  console.log(formatInventoryReport(inventory));
  console.log("");
  console.log(formatVerificationSummary(verification));
  console.log("");
  console.log("CookieWorks QA reset complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
