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

export type AppendOnlyLifecycleClassification =
  TenantRetirementLifecycleStage | "unknown";

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

/**
 * Module-stage append-only tables using private.prevent_update_or_delete() that
 * are approved for controlled retirement during full tenant removal.
 */
export const MODULE_STAGE_STANDARD_APPEND_ONLY_TABLES: readonly AppendOnlyTablePolicy[] =
  [
    {
      table: "action_status_transitions",
      deleteTrigger: "action_status_transitions_prevent_delete",
      description: "Append-only action status transition history",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "benefit_status_history",
      deleteTrigger: "benefit_status_history_prevent_delete",
      description: "Append-only benefit status history",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "benefit_submission_snapshots",
      deleteTrigger: "benefit_submission_snapshots_prevent_delete",
      description: "Append-only benefit submission snapshots",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "benefit_validations",
      deleteTrigger: "benefit_validations_prevent_delete",
      description: "Append-only benefit validation records",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "ci_project_completion_snapshots",
      deleteTrigger: "ci_project_completion_snapshots_prevent_delete",
      description: "Append-only CI project completion snapshots",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "ci_project_metric_measurements",
      deleteTrigger: "ci_project_metric_measurements_prevent_delete",
      description: "Append-only CI project metric measurements",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "ci_project_status_history",
      deleteTrigger: "ci_project_status_history_prevent_delete",
      description: "Append-only CI project status history",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "five_s_audit_score_snapshots",
      deleteTrigger: "five_s_audit_score_snapshots_prevent_delete",
      description: "Append-only 5S audit score snapshots",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "problem_solving_hypothesis_status_history",
      deleteTrigger: "ps_hypothesis_status_history_prevent_delete",
      description: "Append-only problem-solving hypothesis status history",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "recognition_recipients",
      deleteTrigger: "recognition_recipients_prevent_delete",
      description: "Append-only recognition recipient records",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "recognition_revocations",
      deleteTrigger: "recognition_revocations_prevent_delete",
      description: "Append-only recognition revocation records",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "suggestion_reviews",
      deleteTrigger: "suggestion_reviews_prevent_delete",
      description: "Append-only suggestion review records",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "suggestion_status_history",
      deleteTrigger: "suggestion_status_history_prevent_delete",
      description: "Append-only suggestion status history",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
  ];

/**
 * Module-stage append-only tables deleted via explicit trigger-disable blocks in
 * tenant purge SQL (not the controlled retirement helper).
 */
export const MODULE_STAGE_EXPLICIT_UNLOCK_APPEND_ONLY_TABLES: readonly AppendOnlyTablePolicy[] =
  [
    {
      table: "maturity_assessment_transitions",
      deleteTrigger: "maturity_assessment_transitions_prevent_delete",
      description: "Append-only maturity assessment transitions",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "maturity_official_result_levels",
      deleteTrigger: "maturity_official_result_levels_prevent_delete",
      description: "Append-only maturity official result levels",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "maturity_official_result_pillars",
      deleteTrigger: "maturity_official_result_pillars_prevent_delete",
      description: "Append-only maturity official result pillars",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
    },
    {
      table: "maturity_official_results",
      deleteTrigger: "maturity_official_results_prevent_delete",
      description: "Append-only maturity official results",
      lifecycleStage: "module",
      triggerFunction: "prevent_update_or_delete",
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

const ALL_MODULE_STAGE_APPEND_ONLY_TABLES: readonly AppendOnlyTablePolicy[] = [
  ...MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES,
  ...MODULE_STAGE_STANDARD_APPEND_ONLY_TABLES,
  ...MODULE_STAGE_EXPLICIT_UNLOCK_APPEND_ONLY_TABLES,
];

const ALL_APPROVED_APPEND_ONLY_TABLES: readonly AppendOnlyTablePolicy[] = [
  ...FOUNDATION_STAGE_APPEND_ONLY_TABLES,
  ...ALL_MODULE_STAGE_APPEND_ONLY_TABLES,
];

const FOUNDATION_STAGE_APPEND_ONLY_TABLE_NAMES = new Set(
  FOUNDATION_STAGE_APPEND_ONLY_TABLES.map((policy) => policy.table),
);

const MODULE_STAGE_CONTROLLED_RETIREMENT_TABLES: readonly AppendOnlyTablePolicy[] =
  [
    ...MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES,
    ...MODULE_STAGE_STANDARD_APPEND_ONLY_TABLES,
  ];

const MODULE_STAGE_CONTROLLED_RETIREMENT_TABLE_NAMES = new Set(
  MODULE_STAGE_CONTROLLED_RETIREMENT_TABLES.map((policy) => policy.table),
);

const MODULE_STAGE_APPEND_ONLY_TABLE_NAMES = new Set(
  ALL_MODULE_STAGE_APPEND_ONLY_TABLES.map((policy) => policy.table),
);

const APPROVED_APPEND_ONLY_TABLE_NAMES = new Set(
  ALL_APPROVED_APPEND_ONLY_TABLES.map((policy) => policy.table),
);

function appendOnlyTableSqlList(policies: readonly AppendOnlyTablePolicy[]) {
  return policies.map((policy) => `'${policy.table}'`).join(", ");
}

export function foundationStageAppendOnlyTableSqlList() {
  return appendOnlyTableSqlList(FOUNDATION_STAGE_APPEND_ONLY_TABLES);
}

export function moduleStageControlledRetirementTableSqlList() {
  return appendOnlyTableSqlList(MODULE_STAGE_CONTROLLED_RETIREMENT_TABLES);
}

export function moduleStageAppendOnlyTableSqlList() {
  return appendOnlyTableSqlList(ALL_MODULE_STAGE_APPEND_ONLY_TABLES);
}

export function approvedAppendOnlyTableSqlList() {
  return appendOnlyTableSqlList(ALL_APPROVED_APPEND_ONLY_TABLES);
}

export function getFoundationStageAppendOnlyTableNames() {
  return FOUNDATION_STAGE_APPEND_ONLY_TABLES.map((policy) => policy.table);
}

export function getModuleStageCustomAppendOnlyTableNames() {
  return MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES.map((policy) => policy.table);
}

export function getModuleStageStandardAppendOnlyTableNames() {
  return MODULE_STAGE_STANDARD_APPEND_ONLY_TABLES.map((policy) => policy.table);
}

export function getModuleStageControlledRetirementTableNames() {
  return MODULE_STAGE_CONTROLLED_RETIREMENT_TABLES.map(
    (policy) => policy.table,
  );
}

export function getModuleStageAppendOnlyTableNames() {
  return ALL_MODULE_STAGE_APPEND_ONLY_TABLES.map((policy) => policy.table);
}

export function getApprovedAppendOnlyTableNames() {
  return ALL_APPROVED_APPEND_ONLY_TABLES.map((policy) => policy.table);
}

export function isFoundationStageAppendOnlyTable(tableName: string) {
  return FOUNDATION_STAGE_APPEND_ONLY_TABLE_NAMES.has(tableName);
}

export function isModuleStageControlledRetirementTable(tableName: string) {
  return MODULE_STAGE_CONTROLLED_RETIREMENT_TABLE_NAMES.has(tableName);
}

export function isModuleStageAppendOnlyTable(tableName: string) {
  return MODULE_STAGE_APPEND_ONLY_TABLE_NAMES.has(tableName);
}

export function isApprovedAppendOnlyTable(tableName: string) {
  return APPROVED_APPEND_ONLY_TABLE_NAMES.has(tableName);
}

/** @deprecated Use isModuleStageControlledRetirementTable */
export function isModuleStageCustomAppendOnlyTable(tableName: string) {
  return isModuleStageControlledRetirementTable(tableName);
}

export function classifyDiscoveredAppendOnlyTable(
  tableName: string,
): AppendOnlyLifecycleClassification {
  if (isFoundationStageAppendOnlyTable(tableName)) {
    return "foundation";
  }

  if (isModuleStageAppendOnlyTable(tableName)) {
    return "module";
  }

  return "unknown";
}

function collectDuplicateTableFailures(
  policies: readonly AppendOnlyTablePolicy[],
  label: string,
) {
  const seen = new Set<string>();
  const failures: string[] = [];

  for (const policy of policies) {
    if (seen.has(policy.table)) {
      failures.push(`${policy.table} appears more than once in ${label}`);
    }
    seen.add(policy.table);
  }

  return failures;
}

export function assertTenantRetirementPolicyConsistency(
  foundationTables: readonly string[],
) {
  const failures: string[] = [];
  const publicFoundationTables = foundationTables.filter(
    (table) => !table.includes("."),
  );

  failures.push(
    ...collectDuplicateTableFailures(
      FOUNDATION_STAGE_APPEND_ONLY_TABLES,
      "FOUNDATION_STAGE_APPEND_ONLY_TABLES",
    ),
    ...collectDuplicateTableFailures(
      MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES,
      "MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES",
    ),
    ...collectDuplicateTableFailures(
      MODULE_STAGE_STANDARD_APPEND_ONLY_TABLES,
      "MODULE_STAGE_STANDARD_APPEND_ONLY_TABLES",
    ),
    ...collectDuplicateTableFailures(
      MODULE_STAGE_EXPLICIT_UNLOCK_APPEND_ONLY_TABLES,
      "MODULE_STAGE_EXPLICIT_UNLOCK_APPEND_ONLY_TABLES",
    ),
    ...collectDuplicateTableFailures(
      ALL_APPROVED_APPEND_ONLY_TABLES,
      "approved append-only policy",
    ),
  );

  for (const foundationPolicy of FOUNDATION_STAGE_APPEND_ONLY_TABLES) {
    if (!publicFoundationTables.includes(foundationPolicy.table)) {
      failures.push(
        `${foundationPolicy.table} is foundation-stage append-only but missing from FOUNDATION_TABLES`,
      );
    }
  }

  for (const modulePolicy of ALL_MODULE_STAGE_APPEND_ONLY_TABLES) {
    if (publicFoundationTables.includes(modulePolicy.table)) {
      failures.push(
        `${modulePolicy.table} is in FOUNDATION_TABLES but classified as module-stage append-only`,
      );
    }

    if (isFoundationStageAppendOnlyTable(modulePolicy.table)) {
      failures.push(
        `${modulePolicy.table} is classified as both foundation-stage and module-stage append-only`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Tenant retirement policy consistency check failed: ${failures.join("; ")}`,
    );
  }
}

export function collectUnclassifiedAppendOnlyDiscoveryRows(
  rows: Array<{ table: string; trigger?: string; triggerFunction?: string }>,
): Array<{ table: string; trigger?: string; triggerFunction?: string }> {
  return rows
    .filter((row) => classifyDiscoveredAppendOnlyTable(row.table) === "unknown")
    .map((row) => {
      const entry: {
        table: string;
        trigger?: string;
        triggerFunction?: string;
      } = { table: row.table };
      if (row.trigger) {
        entry.trigger = row.trigger;
      }
      if (row.triggerFunction) {
        entry.triggerFunction = row.triggerFunction;
      }
      return entry;
    });
}

export function formatUnclassifiedAppendOnlyFailureLines(
  rows: Array<{ table: string; trigger?: string; triggerFunction?: string }>,
) {
  if (rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    const trigger = row.trigger ? ` trigger=${row.trigger}` : "";
    const triggerFunction = row.triggerFunction
      ? ` function=${row.triggerFunction}`
      : "";
    return `public.${row.table}${trigger}${triggerFunction}`;
  });
}

export function listStandardAppendOnlyDeleteTablesSql() {
  return `
select coalesce(
  array_to_json(
    array_agg(
      jsonb_build_object(
        'table', event_object_table,
        'trigger', trigger_name,
        'trigger_function', 'prevent_update_or_delete',
        'lifecycle_stage', case
          when event_object_table in (${foundationStageAppendOnlyTableSqlList()})
            then 'foundation'
          when event_object_table in (${moduleStageAppendOnlyTableSqlList()})
            then 'module'
          else 'unknown'
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
        'trigger_function', case
          when action_statement ilike '%prevent_ai_usage_event_mutation%'
            then 'prevent_ai_usage_event_mutation'
          when action_statement ilike '%guard_benefit_overlap_allocation_history_mutation%'
            then 'guard_benefit_overlap_allocation_history_mutation'
          else 'custom'
        end,
        'lifecycle_stage', case
          when event_object_table in (${moduleStageControlledRetirementTableSqlList()})
            then 'module'
          when event_object_table in (${foundationStageAppendOnlyTableSqlList()})
            then 'foundation'
          else 'unknown'
        end
      )
      order by event_object_table, trigger_name
    )
  ),
  '[]'::json
) as tables
from (
  select distinct event_object_table, trigger_name, action_statement
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
    'trigger_function', trigger_function,
    'lifecycle_stage', case
      when event_object_table in (${foundationStageAppendOnlyTableSqlList()})
        then 'foundation'
      when event_object_table in (${moduleStageAppendOnlyTableSqlList()})
        then 'module'
      else 'unknown'
    end
  ) as entry
  from (
    select distinct
      event_object_table,
      trigger_name,
      'prevent_update_or_delete'::text as trigger_function
    from information_schema.triggers
    where trigger_schema = 'public'
      and event_manipulation = 'DELETE'
      and action_statement ilike '%prevent_update_or_delete%'
    union
    select distinct
      event_object_table,
      trigger_name,
      case
        when action_statement ilike '%prevent_ai_usage_event_mutation%'
          then 'prevent_ai_usage_event_mutation'
        when action_statement ilike '%guard_benefit_overlap_allocation_history_mutation%'
          then 'guard_benefit_overlap_allocation_history_mutation'
        else 'custom'
      end as trigger_function
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

export function buildAppendOnlyUnknownGuardStatements(options?: {
  indent?: string;
  retentionVar?: string;
}) {
  const indent = options?.indent ?? "  ";
  const retentionVar = options?.retentionVar ?? "purge_retention";

  return `
${indent}if ${retentionVar} = 'full-tenant-removal' then
${indent}  select coalesce(
${indent}    array_agg(
${indent}      format(
${indent}        'public.%s (trigger=%s, function=%s)',
${indent}        discovered.event_object_table,
${indent}        discovered.trigger_name,
${indent}        discovered.trigger_function
${indent}      )
${indent}      order by discovered.event_object_table, discovered.trigger_name
${indent}    ),
${indent}    array[]::text[]
${indent}  )
${indent}  into unknown_append_only_tables
${indent}  from (
${indent}    select distinct
${indent}      event_object_table,
${indent}      trigger_name,
${indent}      'prevent_update_or_delete'::text as trigger_function
${indent}    from information_schema.triggers
${indent}    where trigger_schema = 'public'
${indent}      and event_manipulation = 'DELETE'
${indent}      and action_statement ilike '%prevent_update_or_delete%'
${indent}    union
${indent}    select distinct
${indent}      event_object_table,
${indent}      trigger_name,
${indent}      case
${indent}        when action_statement ilike '%prevent_ai_usage_event_mutation%'
${indent}          then 'prevent_ai_usage_event_mutation'
${indent}        when action_statement ilike '%guard_benefit_overlap_allocation_history_mutation%'
${indent}          then 'guard_benefit_overlap_allocation_history_mutation'
${indent}        else 'custom'
${indent}      end as trigger_function
${indent}    from information_schema.triggers
${indent}    where trigger_schema = 'public'
${indent}      and event_manipulation in ('DELETE', 'UPDATE')
${indent}      and (
${indent}        action_statement ilike '%prevent_ai_usage_event_mutation%'
${indent}        or action_statement ilike '%guard_benefit_overlap_allocation_history_mutation%'
${indent}      )
${indent}  ) discovered
${indent}  where discovered.event_object_table not in (${approvedAppendOnlyTableSqlList()});
${indent}
${indent}  if coalesce(array_length(unknown_append_only_tables, 1), 0) > 0 then
${indent}    raise exception
${indent}      'Tenant module purge blocked: unclassified append-only tables discovered: %',
${indent}      array_to_string(unknown_append_only_tables, ', ');
${indent}  end if;
${indent}end if;
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
    `${indent}-- Only explicitly approved module tables are deleted here.`,
  );
  lines.push(
    `${indent}-- Foundation-stage audit ledgers are preserved until foundation deletion.`,
  );

  for (const policy of MODULE_STAGE_CONTROLLED_RETIREMENT_TABLES) {
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
  lifecycleStage?: AppendOnlyLifecycleClassification;
};

export function formatAppendOnlyInventoryLines(
  rows: AppendOnlyInventoryRow[],
  options?: { includeLifecycleStage?: boolean },
) {
  if (rows.length === 0) {
    return ["  - none"];
  }

  return rows.map((row) => {
    const stage =
      row.lifecycleStage ?? classifyDiscoveredAppendOnlyTable(row.table);
    if (options?.includeLifecycleStage ?? true) {
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
      : rows.filter(
          (row) =>
            (row.lifecycleStage ??
              classifyDiscoveredAppendOnlyTable(row.table)) !== "unknown",
        );

  return relevantRows
    .filter((row) => row.count > 0)
    .map((row) => `public.${row.table}=${row.count}`);
}

export function hasUnknownAppendOnlyInventory(rows: AppendOnlyInventoryRow[]) {
  return rows.some(
    (row) =>
      (row.lifecycleStage ?? classifyDiscoveredAppendOnlyTable(row.table)) ===
      "unknown",
  );
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
