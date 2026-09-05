import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

import { QA_ORGANISATION_CODE } from "./constants";
import { COOKIEWORKS_STORAGE_BUCKET } from "./deletion-graph";
import { runSupabaseDbQueryJson } from "./db-cli";
import { loadLocalSupabaseEnv } from "./local-env";

function resolveStorageAdmin(storageAdmin?: SupabaseClient) {
  if (storageAdmin) {
    return storageAdmin;
  }

  const env = loadLocalSupabaseEnv("qa:cookie:reset");
  return createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function listCookieWorksStorageObjectPaths(databaseUrl: string) {
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
          where code = '${QA_ORGANISATION_CODE}'
          limit 1
        );
    `,
  });

  return rows.map((row) => row.name).filter(Boolean);
}

export function countCookieWorksStorageObjects(databaseUrl: string) {
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
          where code = '${QA_ORGANISATION_CODE}'
          limit 1
        );
    `,
  });

  return rows[0]?.count ?? 0;
}

export async function purgeCookieWorksStorageObjects(options: {
  databaseUrl: string;
  storageAdmin?: SupabaseClient;
}) {
  const paths = listCookieWorksStorageObjectPaths(options.databaseUrl);
  if (paths.length === 0) {
    return;
  }

  const admin = resolveStorageAdmin(options.storageAdmin);
  const { error } = await admin.storage
    .from(COOKIEWORKS_STORAGE_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(
      `CookieWorks storage cleanup failed for ${paths.length} object(s): ${error.message}`,
    );
  }
}
