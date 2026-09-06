import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FOUNDATION_STAGE_DEPENDENCY_TABLES,
  MODULE_PURGE_INFRASTRUCTURE_TABLES,
  listAppendOnlyDeleteTablesSql,
} from "./deletion-graph";
import { runSupabaseDbQueryJson } from "./db-cli";
import { LEGACY_HOSTED_DEMO_ORGANISATION } from "./legacy-hosted-demo";
import {
  buildAppendOnlyTenantRowCountSql,
  collectAppendOnlyInventoryFailures,
  MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES,
} from "./tenant-retirement-policy";
import {
  buildTenantPrivateInfrastructureCountSql,
  collectPrivateInfrastructureAbsenceFailures,
  type TenantPrivateInfrastructureCounts,
} from "./private-infrastructure-purge";

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function listModuleTablesSql() {
  return `
select coalesce(array_to_json(array_agg(c.table_name order by c.table_name)), '[]'::json) as tables
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema
 and t.table_name = c.table_name
where c.table_schema = 'public'
  and c.column_name = 'organisation_id'
  and t.table_type = 'BASE TABLE';
`;
}

function buildOrganisationOwnedCountUnionSql(
  legacyOrgId: string,
  tableNames: readonly string[],
) {
  const selects = tableNames.map((tableName) => {
    const quotedTable = quoteIdentifier(tableName);
    return `
      select 'public.${tableName}' as resource, count(*)::bigint as count
      from public.${quotedTable}
      where organisation_id = '${legacyOrgId}'::uuid
    `;
  });

  return selects.join("\nunion all\n");
}

function buildLegacyIndirectCountSql(legacyOrgId: string) {
  return `
    select 'public.organisation_invitation_signup_bindings' as resource,
           (
             select count(*)::bigint
             from public.organisation_invitation_signup_bindings binding
             where binding.invitation_id in (
               select invitation.id
               from public.organisation_invitations invitation
               where invitation.organisation_id = '${legacyOrgId}'::uuid
             )
           ) as count
    union all
    select 'storage.objects[organisation-evidence]' as resource,
           (
             select count(*)::bigint
             from storage.objects object_row
             where object_row.bucket_id = 'organisation-evidence'
               and object_row.name like '${legacyOrgId}/%'
           ) as count
  `;
}

export async function assertLegacyAuthUsersAbsent(
  authAdmin: SupabaseClient,
  userIds: readonly string[],
) {
  const remaining: string[] = [];

  for (const userId of userIds) {
    const existing = await authAdmin.auth.admin.getUserById(userId);
    if (existing.data.user) {
      remaining.push(userId);
    }
  }

  if (remaining.length > 0) {
    throw new Error(
      `Legacy hosted demo auth identities still present: ${remaining.join(", ")}`,
    );
  }
}

export function assertLegacyHostedDemoFullyAbsent(
  databaseUrl: string,
  options?: { legacyOrganisationId?: string },
) {
  const legacyOrgId =
    options?.legacyOrganisationId ?? LEGACY_HOSTED_DEMO_ORGANISATION.id;
  const legacyOrgCode = LEGACY_HOSTED_DEMO_ORGANISATION.code;
  const failures: string[] = [];

  const organisationRows = runSupabaseDbQueryJson<{
    id: string;
    code: string;
  }>({
    databaseUrl,
    outputFormat: "json",
    retryTransientConnection: true,
    sql: `
      select id, code
      from public.organisations
      where id = '${legacyOrgId}'::uuid
         or code = '${legacyOrgCode.replaceAll("'", "''")}';
    `,
  });

  if (organisationRows.length > 0) {
    failures.push(
      `organisations=${organisationRows
        .map((row) => `${row.code}:${row.id}`)
        .join("|")}`,
    );
  }

  const moduleRows = runSupabaseDbQueryJson<{ tables: string[] }>({
    databaseUrl,
    outputFormat: "json",
    retryTransientConnection: true,
    sql: listModuleTablesSql(),
  });
  const appendOnlyRows = runSupabaseDbQueryJson<{
    tables: Array<{ table: string; trigger: string }>;
  }>({
    databaseUrl,
    outputFormat: "json",
    retryTransientConnection: true,
    sql: listAppendOnlyDeleteTablesSql(),
  });

  const moduleTables = (moduleRows[0]?.tables ?? []) as string[];
  const appendOnlyTables = new Set<string>([
    ...((appendOnlyRows[0]?.tables ?? []) as Array<{ table: string }>).map(
      (entry) => entry.table,
    ),
    ...MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES.map((policy) => policy.table),
  ]);
  const infrastructureTables = new Set<string>([
    ...MODULE_PURGE_INFRASTRUCTURE_TABLES,
    ...FOUNDATION_STAGE_DEPENDENCY_TABLES,
  ]);

  const appendOnlyInventoryRows = runSupabaseDbQueryJson<{
    rows: Array<{ table: string; count: number }>;
  }>({
    databaseUrl,
    outputFormat: "json",
    retryTransientConnection: true,
    sql: buildAppendOnlyTenantRowCountSql(
      legacyOrgId,
      [...appendOnlyTables].sort(),
    ),
  });

  failures.push(
    ...collectAppendOnlyInventoryFailures(
      (appendOnlyInventoryRows[0]?.rows ?? []) as Array<{
        table: string;
        count: number;
        lifecycle_stage?: "module" | "foundation";
      }>,
      "full-absence",
    ),
  );

  const tablesToVerify = moduleTables.filter(
    (tableName) =>
      tableName !== "organisations" &&
      !appendOnlyTables.has(tableName) &&
      !infrastructureTables.has(tableName),
  );

  if (tablesToVerify.length > 0) {
    const ownedRows = runSupabaseDbQueryJson<{
      resource: string;
      count: number;
    }>({
      databaseUrl,
      outputFormat: "json",
      retryTransientConnection: true,
      sql: `
        with counts as (
          ${buildOrganisationOwnedCountUnionSql(legacyOrgId, tablesToVerify)}
        )
        select resource, count
        from counts
        where count > 0;
      `,
    });

    for (const row of ownedRows) {
      failures.push(`${row.resource}=${row.count}`);
    }
  }

  if (FOUNDATION_STAGE_DEPENDENCY_TABLES.length > 0) {
    const dependencyRows = runSupabaseDbQueryJson<{
      resource: string;
      count: number;
    }>({
      databaseUrl,
      outputFormat: "json",
      retryTransientConnection: true,
      sql: `
        with counts as (
          ${buildOrganisationOwnedCountUnionSql(
            legacyOrgId,
            FOUNDATION_STAGE_DEPENDENCY_TABLES,
          )}
        )
        select resource, count
        from counts
        where count > 0;
      `,
    });

    for (const row of dependencyRows) {
      failures.push(`${row.resource}=${row.count}`);
    }
  }

  const indirectRows = runSupabaseDbQueryJson<{
    resource: string;
    count: number;
  }>({
    databaseUrl,
    outputFormat: "json",
    retryTransientConnection: true,
    sql: `
      with counts as (
        ${buildLegacyIndirectCountSql(legacyOrgId)}
      )
      select resource, count
      from counts;
    `,
  });

  for (const row of indirectRows) {
    if (Number(row.count ?? 0) > 0) {
      failures.push(`${row.resource}=${row.count}`);
    }
  }

  const privateRows = runSupabaseDbQueryJson<TenantPrivateInfrastructureCounts>(
    {
      databaseUrl,
      outputFormat: "json",
      retryTransientConnection: true,
      sql: buildTenantPrivateInfrastructureCountSql(legacyOrgId),
    },
  );

  const privateCounts = privateRows[0];
  failures.push(
    ...collectPrivateInfrastructureAbsenceFailures(
      privateCounts ?? {
        notification_delivery_provider_envelopes: 0,
        notification_delivery_ledger: 0,
        domain_event_outbox: 0,
        notification_projector_pre_cutover_skips: 0,
        session_organisation_contexts: 0,
      },
    ),
  );

  const storageRows = runSupabaseDbQueryJson<{ storage_objects: number }>({
    databaseUrl,
    outputFormat: "json",
    retryTransientConnection: true,
    sql: `
      select
        (select count(*)::int
         from storage.objects
         where bucket_id = 'organisation-evidence'
           and name like '${legacyOrgId}/%') as storage_objects;
    `,
  });

  const storageObjectCount = storageRows[0]?.storage_objects ?? 0;
  if (storageObjectCount > 0) {
    failures.push(`storage.objects=${storageObjectCount}`);
  }

  if (failures.length > 0) {
    throw new Error(
      `Legacy hosted demo absence verification failed: ${failures.join(", ")}`,
    );
  }
}
