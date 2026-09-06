import type { SupabaseClient } from "@supabase/supabase-js";

import { QA_ORGANISATION_CODE } from "./constants";
import { runSupabaseDbQuery } from "./db-cli";
import { purgeCookieWorksStorageObjects } from "./storage-cleanup";
import {
  buildPurgeTenantModuleDataSql,
  buildLegacyHostedDemoModulePurgeSql,
} from "./tenant-purge-sql";
import type { TenantPurgeRetention } from "./tenant-retirement-policy";
import {
  assertCookieWorksFoundationOnlyVerified,
  verifyCookieWorksTenant,
} from "./verification";

export function executePurgeTenantModuleDataSql(
  databaseUrl: string,
  organisationCode: string,
  options?: { retention?: TenantPurgeRetention },
) {
  runSupabaseDbQuery({
    databaseUrl,
    sql: buildPurgeTenantModuleDataSql(organisationCode, options),
  });
}

export function executeLegacyHostedDemoModulePurgeSql(databaseUrl: string) {
  runSupabaseDbQuery({
    databaseUrl,
    sql: buildLegacyHostedDemoModulePurgeSql(),
  });
}

export function executePurgeCookieWorksModuleDataSql(databaseUrl: string) {
  executePurgeTenantModuleDataSql(databaseUrl, QA_ORGANISATION_CODE);
}

export async function purgeCookieWorksTenantModules(
  databaseUrl: string,
  options?: { storageAdmin?: SupabaseClient },
) {
  executePurgeCookieWorksModuleDataSql(databaseUrl);
  await purgeCookieWorksStorageObjects({
    databaseUrl,
    ...(options?.storageAdmin ? { storageAdmin: options.storageAdmin } : {}),
  });

  const verification = verifyCookieWorksTenant(databaseUrl);
  if (!verification.isFoundationOnly) {
    throw new Error(
      `CookieWorks purge verification failed before reseed: ${verification.failures.join(", ")}`,
    );
  }
}

export async function deleteCookieWorksTenant(options: {
  databaseUrl: string;
  deleteAuthUsers?: () => Promise<void>;
}) {
  await purgeCookieWorksTenantModules(options.databaseUrl);

  if (options.deleteAuthUsers) {
    await options.deleteAuthUsers();
  }
}

export function assertCookieWorksResetVerified(databaseUrl: string) {
  return assertCookieWorksFoundationOnlyVerified(databaseUrl);
}
