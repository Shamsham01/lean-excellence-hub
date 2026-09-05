/**
 * Authoritative tenant-retirement classification for QA purge, dry-run inventory,
 * absence verification, and integration tests.
 *
 * See docs/development/qa-tenant-deletion-graph.md and
 * docs/qa/hosted-tenant-replacement-runbook.md.
 */

export type TenantPurgeRetention =
  "module-foundation-only" | "full-tenant-removal";

/**
 * A. ordinary-deletable — generic organisation-scoped DELETE loop.
 * B. controlled-retirement-delete — append-only/immutable; deleted only during
 *    full tenant removal via narrowly scoped trigger disable (exact org scope).
 * C. append-only-module-retained — workflow/audit history retained during
 *    CookieWorks module purge; excluded from generic DELETE and verification.
 * D. foundation-foundation-stage — deleted in foundation stage with trigger disable.
 * E. infrastructure-explicit — template/resource registry handled explicitly.
 * F. immutable-explicit-unlock — maturity subgraph unlocked in purge SQL.
 */
export type TenantRetirementClass =
  | "ordinary-deletable"
  | "controlled-retirement-delete"
  | "append-only-module-retained"
  | "foundation-foundation-stage"
  | "infrastructure-explicit"
  | "immutable-explicit-unlock";

export type CustomAppendOnlyTablePolicy = {
  table: string;
  deleteTrigger: string;
  description: string;
  retentionClass: "controlled-retirement-delete";
};

/**
 * Append-only tables that use custom trigger functions instead of
 * private.prevent_update_or_delete(). Discovery via information_schema must
 * include these explicitly.
 */
export const CUSTOM_APPEND_ONLY_DELETE_TABLES: readonly CustomAppendOnlyTablePolicy[] =
  [
    {
      table: "ai_usage_events",
      deleteTrigger: "ai_usage_events_append_only",
      description:
        "Authoritative AI usage/accounting telemetry (append-only ledger)",
      retentionClass: "controlled-retirement-delete",
    },
    {
      table: "benefit_overlap_allocation_history",
      deleteTrigger: "benefit_overlap_allocation_history_guard_mutation",
      description: "Append-only benefit overlap allocation history",
      retentionClass: "controlled-retirement-delete",
    },
  ];

export const CUSTOM_APPEND_ONLY_DELETE_TRIGGER_FUNCTIONS = [
  "prevent_ai_usage_event_mutation",
  "guard_benefit_overlap_allocation_history_mutation",
] as const;

export function listStandardAppendOnlyDeleteTablesSql() {
  return `
select coalesce(
  array_to_json(
    array_agg(
      jsonb_build_object(
        'table', event_object_table,
        'trigger', trigger_name
      )
      order by event_object_table, trigger_name
    )
  ),
  '[]'::json
) as tables
from (
  select distinct event_object_table, trigger_name
  from information_schema.triggers
  where trigger_schema = 'public'
    and event_manipulation = 'DELETE'
    and action_statement ilike '%prevent_update_or_delete%'
) append_only_triggers;
`;
}

export function listCustomAppendOnlyDeleteTablesSql() {
  const functionPatterns = CUSTOM_APPEND_ONLY_DELETE_TRIGGER_FUNCTIONS.map(
    (functionName) => `action_statement ilike '%${functionName}%'`,
  ).join("\n      or ");

  return `
select coalesce(
  array_to_json(
    array_agg(
      jsonb_build_object(
        'table', event_object_table,
        'trigger', trigger_name
      )
      order by event_object_table, trigger_name
    )
  ),
  '[]'::json
) as tables
from (
  select distinct event_object_table, trigger_name
  from information_schema.triggers
  where trigger_schema = 'public'
    and event_manipulation in ('DELETE', 'UPDATE')
    and (
      ${functionPatterns}
    )
) custom_append_only_triggers;
`;
}

export function listAllAppendOnlyDeleteTablesSql() {
  return `
select coalesce(
  array_to_json(
    array_agg(entry order by entry ->> 'table', entry ->> 'trigger')
  ),
  '[]'::json
) as tables
from (
  select jsonb_build_object('table', event_object_table, 'trigger', trigger_name) as entry
  from (
    select distinct event_object_table, trigger_name
    from information_schema.triggers
    where trigger_schema = 'public'
      and event_manipulation = 'DELETE'
      and action_statement ilike '%prevent_update_or_delete%'
    union
    select distinct event_object_table, trigger_name
    from information_schema.triggers
    where trigger_schema = 'public'
      and event_manipulation in ('DELETE', 'UPDATE')
      and (
        ${CUSTOM_APPEND_ONLY_DELETE_TRIGGER_FUNCTIONS.map(
          (functionName) => `action_statement ilike '%${functionName}%'`,
        ).join("\n          or ")}
      )
  ) combined
) entries;
`;
}

export function buildAppendOnlyTenantRowCountSql(
  organisationId: string,
  tableNames: readonly string[],
) {
  if (tableNames.length === 0) {
    return `select '[]'::json as rows`;
  }

  const selects = tableNames.map((tableName) => {
    const quoted = `"${tableName.replaceAll('"', '""')}"`;
    return `
      select '${tableName}' as table_name,
             (select count(*)::bigint
              from public.${quoted}
              where organisation_id = '${organisationId}'::uuid) as row_count
    `;
  });

  return `
select coalesce(
  array_to_json(
    array_agg(
      jsonb_build_object('table', table_name, 'count', row_count)
      order by table_name
    )
  ),
  '[]'::json
) as rows
from (
  ${selects.join("\n  union all\n  ")}
) counts
where row_count > 0;
`;
}

export function buildControlledRetirementDeleteStatements(
  targetOrgVar: string,
  options?: { indent?: string },
) {
  const indent = options?.indent ?? "  ";
  const lines: string[] = [];

  lines.push(
    `${indent}-- Controlled append-only retirement deletes (full tenant removal only).`,
  );

  for (const policy of CUSTOM_APPEND_ONLY_DELETE_TABLES) {
    lines.push(
      `${indent}alter table public.${policy.table}`,
      `${indent}  disable trigger ${policy.deleteTrigger};`,
      `${indent}delete from public.${policy.table}`,
      `${indent}where organisation_id = ${targetOrgVar};`,
      `${indent}alter table public.${policy.table}`,
      `${indent}  enable trigger ${policy.deleteTrigger};`,
      "",
    );
  }

  lines.push(`${indent}for rec in`);
  lines.push(`${indent}  select distinct event_object_table, trigger_name`);
  lines.push(`${indent}  from information_schema.triggers`);
  lines.push(`${indent}  where trigger_schema = 'public'`);
  lines.push(`${indent}    and event_manipulation = 'DELETE'`);
  lines.push(
    `${indent}    and action_statement ilike '%prevent_update_or_delete%'`,
  );
  lines.push(`${indent}  order by event_object_table, trigger_name`);
  lines.push(`${indent}loop`);
  lines.push(
    `${indent}  execute format('alter table public.%%I disable trigger %%I', rec.event_object_table, rec.trigger_name);`,
  );
  lines.push(
    `${indent}  execute format('delete from public.%%I where organisation_id = $1', rec.event_object_table)`,
  );
  lines.push(`${indent}    using ${targetOrgVar};`);
  lines.push(
    `${indent}  execute format('alter table public.%%I enable trigger %%I', rec.event_object_table, rec.trigger_name);`,
  );
  lines.push(`${indent}end loop;`);

  return lines.join("\n");
}

export function formatAppendOnlyInventoryLines(
  rows: Array<{ table: string; count: number }>,
) {
  if (rows.length === 0) {
    return ["  - none"];
  }

  return rows.map((row) => `  - public.${row.table}: ${row.count}`);
}

export function collectAppendOnlyInventoryFailures(
  rows: Array<{ table: string; count: number }>,
  retention: TenantPurgeRetention,
) {
  if (retention === "module-foundation-only") {
    return [];
  }

  return rows
    .filter((row) => row.count > 0)
    .map((row) => `public.${row.table}=${row.count}`);
}
