import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

import { COOKIEWORKS_STORAGE_BUCKET } from "./deletion-graph";
import { runSupabaseDbQueryJson } from "./db-cli";
import { loadLocalSupabaseEnv } from "./local-env";

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

function resolveStorageAdmin(storageAdmin?: SupabaseClient) {
  if (storageAdmin) {
    return storageAdmin;
  }

  const env = loadLocalSupabaseEnv("qa:cookie:reset");
  return createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function listTenantStorageObjectPaths(
  databaseUrl: string,
  organisationCode: string,
) {
  const code = escapeSqlLiteral(organisationCode);
  const rows = runSupabaseDbQueryJson<{ name: string }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select object_row.name
      from storage.objects object_row
      where object_row.bucket_id = '${COOKIEWORKS_STORAGE_BUCKET}'
        and object_row.name like (
          select id::text || '/%'
          from public.organisations
          where code = '${code}'
          limit 1
        );
    `,
  });

  return rows.map((row) => row.name).filter(Boolean);
}

export function countTenantStorageObjects(
  databaseUrl: string,
  organisationCode: string,
) {
  const code = escapeSqlLiteral(organisationCode);
  const rows = runSupabaseDbQueryJson<{ count: number }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select count(*)::int as count
      from storage.objects object_row
      where object_row.bucket_id = '${COOKIEWORKS_STORAGE_BUCKET}'
        and object_row.name like (
          select id::text || '/%'
          from public.organisations
          where code = '${code}'
          limit 1
        );
    `,
  });

  return rows[0]?.count ?? 0;
}

export async function purgeTenantStorageObjects(options: {
  databaseUrl: string;
  organisationCode: string;
  storageAdmin?: SupabaseClient;
}) {
  const paths = listTenantStorageObjectPaths(
    options.databaseUrl,
    options.organisationCode,
  );
  if (paths.length === 0) {
    return;
  }

  const admin = resolveStorageAdmin(options.storageAdmin);
  const { error } = await admin.storage
    .from(COOKIEWORKS_STORAGE_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(
      `Tenant storage cleanup failed for ${paths.length} object(s): ${error.message}`,
    );
  }
}
