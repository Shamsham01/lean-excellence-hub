import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PURGE_INFRASTRUCTURE_TABLES,
  listAppendOnlyDeleteTablesSql,
} from "./deletion-graph";
import { runSupabaseDbQueryJson } from "./db-cli";
import { LEGACY_HOSTED_DEMO_ORGANISATION } from "./legacy-hosted-demo";

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
    sql: listModuleTablesSql(),
  });
  const appendOnlyRows = runSupabaseDbQueryJson<{ tables: string[] }>({
    databaseUrl,
    outputFormat: "json",
    sql: listAppendOnlyDeleteTablesSql(),
  });

  const moduleTables = (moduleRows[0]?.tables ?? []) as string[];
  const appendOnlyTables = new Set(
    (appendOnlyRows[0]?.tables ?? []) as string[],
  );
  const infrastructureTables = new Set<string>(PURGE_INFRASTRUCTURE_TABLES);

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

  const indirectRows = runSupabaseDbQueryJson<{
    resource: string;
    count: number;
  }>({
    databaseUrl,
    outputFormat: "json",
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

  const privateRows = runSupabaseDbQueryJson<{
    notification_delivery_provider_envelopes: number;
    notification_delivery_ledger: number;
    domain_event_outbox: number;
    session_organisation_contexts: number;
    storage_objects: number;
  }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select
        (select count(*)::int from private.notification_delivery_provider_envelopes where organisation_id = '${legacyOrgId}'::uuid) as notification_delivery_provider_envelopes,
        (select count(*)::int from private.notification_delivery_ledger where organisation_id = '${legacyOrgId}'::uuid) as notification_delivery_ledger,
        (select count(*)::int from private.domain_event_outbox where organisation_id = '${legacyOrgId}'::uuid) as domain_event_outbox,
        (select count(*)::int from private.session_organisation_contexts where organisation_id = '${legacyOrgId}'::uuid) as session_organisation_contexts,
        (select count(*)::int from storage.objects where bucket_id = 'organisation-evidence' and name like '${legacyOrgId}/%') as storage_objects;
    `,
  });

  const privateCounts = privateRows[0];
  if ((privateCounts?.notification_delivery_provider_envelopes ?? 0) > 0) {
    failures.push(
      `private.notification_delivery_provider_envelopes=${privateCounts?.notification_delivery_provider_envelopes}`,
    );
  }
  if ((privateCounts?.notification_delivery_ledger ?? 0) > 0) {
    failures.push(
      `private.notification_delivery_ledger=${privateCounts?.notification_delivery_ledger}`,
    );
  }
  if ((privateCounts?.domain_event_outbox ?? 0) > 0) {
    failures.push(
      `private.domain_event_outbox=${privateCounts?.domain_event_outbox}`,
    );
  }
  if ((privateCounts?.session_organisation_contexts ?? 0) > 0) {
    failures.push(
      `private.session_organisation_contexts=${privateCounts?.session_organisation_contexts}`,
    );
  }
  if ((privateCounts?.storage_objects ?? 0) > 0) {
    failures.push(`storage.objects=${privateCounts?.storage_objects}`);
  }

  if (failures.length > 0) {
    throw new Error(
      `Legacy hosted demo absence verification failed: ${failures.join(", ")}`,
    );
  }
}
