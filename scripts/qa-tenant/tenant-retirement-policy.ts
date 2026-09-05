/**
 * Authoritative tenant-retirement classification for QA purge, dry-run inventory,
 * absence verification, and integration tests.
 *
 * See docs/development/qa-tenant-deletion-graph.md and
 * docs/qa/hosted-tenant-replacement-runbook.md.
 */

export type TenantPurgeRetention =
  "module-foundation-only" | "full-tenant-removal";

export type TenantRetirementLifecycleStage = "module" | "foundation";

/**
 * A. ordinary-deletable — generic organisation-scoped DELETE loop.
 * B. controlled-retirement-delete (module stage) — append-only/immutable module
 *    history deleted during module purge via narrowly scoped trigger disable.
 * C. append-only-module-retained — workflow/audit history retained during
 *    CookieWorks module purge; excluded from generic DELETE and verification.
 * D. foundation-foundation-stage — foundation append-only audit ledgers deleted
 *    only during foundation/organisation deletion.
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

export type AppendOnlyTablePolicy = {
  table: string;
  deleteTrigger: string;
  description: string;
  lifecycleStage: TenantRetirementLifecycleStage;
  triggerFunction: string;
};

/**
 * Foundation-stage append-only audit ledgers. Deleted only in the foundation
 * organisation-deletion transaction (delete-legacy-hosted-demo.ts).
 */
export const FOUNDATION_STAGE_APPEND_ONLY_TABLES: readonly AppendOnlyTablePolicy[] =
  [
    {
      table: "security_audit_events",
      deleteTrigger: "security_audit_events_append_only",
      description: "Narrow append-only Milestone 3 security ledger",
      lifecycleStage: "foundation",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "business_audit_events",
      deleteTrigger: "business_audit_events_prevent_delete",
      description: "Append-only business audit evidence stream",
      lifecycleStage: "foundation",
      triggerFunction: "prevent_update_or_delete",
    },
  ];

/**
 * Module-stage append-only tables with custom trigger functions instead of
 * private.prevent_update_or_delete().
 */
export const MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES: readonly AppendOnlyTablePolicy[] =
  [
    {
      table: "ai_usage_events",
      deleteTrigger: "ai_usage_events_append_only",
      description:
        "Authoritative AI usage/accounting telemetry (append-only ledger)",
      lifecycleStage: "module",
      triggerFunction: "prevent_ai_usage_event_mutation",
    },
    {
      table: "benefit_overlap_allocation_history",
      deleteTrigger: "benefit_overlap_allocation_history_guard_mutation",
      description: "Append-only benefit overlap allocation history",
      lifecycleStage: "module",
      triggerFunction: "guard_benefit_overlap_allocation_history_mutation",
    },
  ];

/** @deprecated Use MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES */
export const CUSTOM_APPEND_ONLY_DELETE_TABLES =
  MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES;

export const MODULE_STAGE_CUSTOM_APPEND_ONLY_TRIGGER_FUNCTIONS = [
  "prevent_ai_usage_event_mutation",
  "guard_benefit_overlap_allocation_history_mutation",
] as const;

/** @deprecated Use MODULE_STAGE_CUSTOM_APPEND_ONLY_TRIGGER_FUNCTIONS */
export const CUSTOM_APPEND_ONLY_DELETE_TRIGGER_FUNCTIONS =
  MODULE_STAGE_CUSTOM_APPEND_ONLY_TRIGGER_FUNCTIONS;

const FOUNDATION_STAGE_APPEND_ONLY_TABLE_NAMES = new Set(
  FOUNDATION_STAGE_APPEND_ONLY_TABLES.map((policy) => policy.table),
);

const MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLE_NAMES = new Set(
  MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES.map((policy) => policy.table),
);

export function foundationStageAppendOnlyTableSqlList() {
  return FOUNDATION_STAGE_APPEND_ONLY_TABLES.map(
    (policy) => `'${policy.table}'`,
  ).join(", ");
}

export function getFoundationStageAppendOnlyTableNames() {
  return FOUNDATION_STAGE_APPEND_ONLY_TABLES.map((policy) => policy.table);
}

export function getModuleStageCustomAppendOnlyTableNames() {
  return MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES.map((policy) => policy.table);
}

export function isFoundationStageAppendOnlyTable(tableName: string) {
  return FOUNDATION_STAGE_APPEND_ONLY_TABLE_NAMES.has(tableName);
}

export function isModuleStageCustomAppendOnlyTable(tableName: string) {
  return MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLE_NAMES.has(tableName);
}

export function classifyDiscoveredAppendOnlyTable(
  tableName: string,
): TenantRetirementLifecycleStage | "unknown" {
  if (isFoundationStageAppendOnlyTable(tableName)) {
    return "foundation";
  }

  if (isModuleStageCustomAppendOnlyTable(tableName)) {
    return "module";
  }

  return "module";
}

export function assertTenantRetirementPolicyConsistency(
  foundationTables: readonly string[],
) {
  const failures: string[] = [];
  const publicFoundationTables = foundationTables.filter(
    (table) => !table.includes("."),
  );

  for (const foundationPolicy of FOUNDATION_STAGE_APPEND_ONLY_TABLES) {
    if (!publicFoundationTables.includes(foundationPolicy.table)) {
      failures.push(
        `${foundationPolicy.table} is foundation-stage append-only but missing from FOUNDATION_TABLES`,
      );
    }

    const moduleCustom = MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES.find(
      (policy) => policy.table === foundationPolicy.table,
    );
    if (moduleCustom) {
      failures.push(
        `${foundationPolicy.table} is classified as both foundation-stage and module-stage custom append-only`,
      );
    }
  }

  for (const modulePolicy of MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES) {
    if (publicFoundationTables.includes(modulePolicy.table)) {
      failures.push(
        `${modulePolicy.table} is in FOUNDATION_TABLES but classified as module-stage custom append-only`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Tenant retirement policy consistency check failed: ${failures.join("; ")}`,
    );
  }
}

export function listStandardAppendOnlyDeleteTablesSql() {
  return `
select coalesce(
  array_to_json(
    array_agg(
      jsonb_build_object(
        'table', event_object_table,
        'trigger', trigger_name,
        'lifecycle_stage', case
          when event_object_table in (${foundationStageAppendOnlyTableSqlList()})
            then 'foundation'
          else 'module'
        end
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
  const functionPatterns =
    MODULE_STAGE_CUSTOM_APPEND_ONLY_TRIGGER_FUNCTIONS.map(
      (functionName) => `action_statement ilike '%${functionName}%'`,
    ).join("\n      or ");

  return `
select coalesce(
  array_to_json(
    array_agg(
      jsonb_build_object(
        'table', event_object_table,
        'trigger', trigger_name,
        'lifecycle_stage', 'module'
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
  select jsonb_build_object(
    'table', event_object_table,
    'trigger', trigger_name,
    'lifecycle_stage', case
      when event_object_table in (${foundationStageAppendOnlyTableSqlList()})
        then 'foundation'
      else 'module'
    end
  ) as entry
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
        ${MODULE_STAGE_CUSTOM_APPEND_ONLY_TRIGGER_FUNCTIONS.map(
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
    const lifecycleStage = classifyDiscoveredAppendOnlyTable(tableName);
    return `
      select '${tableName}' as table_name,
             '${lifecycleStage}' as lifecycle_stage,
             (select count(*)::bigint
              from public.${quoted}
              where organisation_id = '${organisationId}'::uuid) as row_count
    `;
  });

  return `
select coalesce(
  array_to_json(
    array_agg(
      jsonb_build_object(
        'table', table_name,
        'count', row_count,
        'lifecycle_stage', lifecycle_stage
      )
      order by lifecycle_stage, table_name
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
    `${indent}-- Module-stage controlled append-only retirement deletes (full tenant removal only).`,
  );
  lines.push(
    `${indent}-- Foundation-stage audit ledgers are preserved until foundation deletion.`,
  );

  for (const policy of MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES) {
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
  lines.push(
    `${indent}    and event_object_table not in (${foundationStageAppendOnlyTableSqlList()})`,
  );
  lines.push(`${indent}  order by event_object_table, trigger_name`);
  lines.push(`${indent}loop`);
  lines.push(
    `${indent}  execute format('alter table public.%I disable trigger %I', rec.event_object_table, rec.trigger_name);`,
  );
  lines.push(
    `${indent}  execute format('delete from public.%I where organisation_id = $1', rec.event_object_table)`,
  );
  lines.push(`${indent}    using ${targetOrgVar};`);
  lines.push(
    `${indent}  execute format('alter table public.%I enable trigger %I', rec.event_object_table, rec.trigger_name);`,
  );
  lines.push(`${indent}end loop;`);

  return lines.join("\n");
}

export function buildFoundationStageAppendOnlyDeleteStatements(
  targetOrgVar: string,
  options?: { indent?: string },
) {
  const indent = options?.indent ?? "  ";
  const lines: string[] = [];

  lines.push(
    `${indent}-- Foundation-stage append-only audit ledger retirement.`,
  );
  lines.push(
    `${indent}-- Must run before organisation_memberships deletion (actor_membership FK).`,
  );

  for (const policy of FOUNDATION_STAGE_APPEND_ONLY_TABLES) {
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

  return lines.join("\n");
}

export type AppendOnlyInventoryRow = {
  table: string;
  count: number;
  lifecycleStage?: TenantRetirementLifecycleStage;
};

export function formatAppendOnlyInventoryLines(
  rows: AppendOnlyInventoryRow[],
  options?: { includeLifecycleStage?: boolean },
) {
  if (rows.length === 0) {
    return ["  - none"];
  }

  const includeLifecycleStage = options?.includeLifecycleStage ?? true;

  return rows.map((row) => {
    const stage =
      row.lifecycleStage ?? classifyDiscoveredAppendOnlyTable(row.table);
    if (includeLifecycleStage) {
      return `  - public.${row.table} [${stage}]: ${row.count}`;
    }
    return `  - public.${row.table}: ${row.count}`;
  });
}

export type AppendOnlyInventoryVerificationScope =
  "module-purge" | "module-foundation-only" | "full-absence";

export function collectAppendOnlyInventoryFailures(
  rows: AppendOnlyInventoryRow[],
  scope: AppendOnlyInventoryVerificationScope,
) {
  if (scope === "module-foundation-only") {
    return [];
  }

  const relevantRows =
    scope === "module-purge"
      ? rows.filter(
          (row) =>
            (row.lifecycleStage ??
              classifyDiscoveredAppendOnlyTable(row.table)) === "module",
        )
      : rows;

  return relevantRows
    .filter((row) => row.count > 0)
    .map((row) => `public.${row.table}=${row.count}`);
}

/** @deprecated Pass AppendOnlyInventoryVerificationScope instead of TenantPurgeRetention */
export function collectAppendOnlyInventoryFailuresForRetention(
  rows: AppendOnlyInventoryRow[],
  retention: TenantPurgeRetention,
) {
  if (retention === "module-foundation-only") {
    return collectAppendOnlyInventoryFailures(rows, "module-foundation-only");
  }

  return collectAppendOnlyInventoryFailures(rows, "module-purge");
}
