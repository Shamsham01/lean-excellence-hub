import type { SupabaseClient } from "@supabase/supabase-js";

import { QA_ORGANISATION_CODE } from "./constants";
import { runSupabaseDbQuery } from "./db-cli";
import { purgeCookieWorksStorageObjects } from "./storage-cleanup";
import { buildPurgeTenantModuleDataSql } from "./tenant-purge-sql";
import {
  assertCookieWorksFoundationOnlyVerified,
  verifyCookieWorksTenant,
} from "./verification";

export function executePurgeTenantModuleDataSql(
  databaseUrl: string,
  organisationCode: string,
) {
  runSupabaseDbQuery({
    databaseUrl,
    sql: buildPurgeTenantModuleDataSql(organisationCode),
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
