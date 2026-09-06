/**
 * Cross-stage foreign-key safety for tenant retirement.
 *
 * Detects RESTRICT / NO ACTION edges where a foundation-preserved child would
 * block deletion of a parent scheduled during module purge unless that parent is
 * explicitly deferred to foundation deletion.
 *
 * See docs/development/qa-tenant-deletion-graph.md (QA2e).
 */

import {
  FOUNDATION_STAGE_DEPENDENCY_TABLES,
  FOUNDATION_TABLES,
  FULL_TENANT_REMOVAL_FOUNDATION_BRIDGE_CLEAR_TABLES,
  MODULE_PURGE_INFRASTRUCTURE_TABLES,
  SHARED_REFERENCE_CATALOG_TABLES,
} from "./deletion-graph";
import { runSupabaseDbQueryJson } from "./db-cli";
import {
  getFoundationStageAppendOnlyTableNames,
  getModuleStageAppendOnlyTableNames,
} from "./tenant-retirement-policy";

export type CrossStageFkLifecycleStage =
  | "foundation-preserved"
  | "foundation-deferred"
  | "module-deleted"
  | "private-infrastructure"
  | "unknown";

export type CrossStageForeignKeyEdge = {
  constraintName: string;
  childSchema: string;
  childTable: string;
  childColumns: string;
  parentSchema: string;
  parentTable: string;
  parentColumns: string;
  onDelete: string;
  childLifecycleStage: CrossStageFkLifecycleStage;
  parentLifecycleStage: CrossStageFkLifecycleStage;
  deletionOrderSafe: boolean;
};

const PRIVATE_INFRASTRUCTURE_TABLES = [
  "notification_delivery_provider_envelopes",
  "notification_delivery_ledger",
  "domain_event_outbox",
  "notification_projector_pre_cutover_skips",
  "session_organisation_contexts",
] as const;

const FOUNDATION_PRESERVED_PUBLIC_TABLES = FOUNDATION_TABLES.filter(
  (table) => !table.includes("."),
);

const FOUNDATION_PRESERVED_PRIVATE_TABLES = FOUNDATION_TABLES.filter((table) =>
  table.includes("."),
).map((table) => table.split(".")[1]!);

const FOUNDATION_PRESERVED_PUBLIC_TABLE_NAMES = new Set<string>(
  FOUNDATION_PRESERVED_PUBLIC_TABLES,
);

const FOUNDATION_PRESERVED_PRIVATE_TABLE_NAMES = new Set<string>(
  FOUNDATION_PRESERVED_PRIVATE_TABLES,
);

const FOUNDATION_STAGE_APPEND_ONLY_TABLE_NAMES = new Set<string>(
  getFoundationStageAppendOnlyTableNames(),
);

const FOUNDATION_STAGE_DEPENDENCY_TABLE_NAMES = new Set<string>(
  FOUNDATION_STAGE_DEPENDENCY_TABLES,
);

const MODULE_PURGE_INFRASTRUCTURE_TABLE_NAMES = new Set<string>(
  MODULE_PURGE_INFRASTRUCTURE_TABLES,
);

const MODULE_STAGE_APPEND_ONLY_TABLE_NAMES = new Set<string>(
  getModuleStageAppendOnlyTableNames(),
);

const PRIVATE_INFRASTRUCTURE_TABLE_NAMES = new Set<string>(
  PRIVATE_INFRASTRUCTURE_TABLES,
);

const FULL_TENANT_REMOVAL_FOUNDATION_BRIDGE_CLEAR_TABLE_NAMES = new Set<string>(
  FULL_TENANT_REMOVAL_FOUNDATION_BRIDGE_CLEAR_TABLES,
);

const SHARED_REFERENCE_CATALOG_TABLE_NAMES = new Set<string>(
  SHARED_REFERENCE_CATALOG_TABLES,
);

function sqlStringList(values: readonly string[]) {
  return values.map((value) => `'${value}'`).join(", ");
}

export function getFoundationPreservedPublicTableNames() {
  return [...FOUNDATION_PRESERVED_PUBLIC_TABLES];
}

export function getFoundationPreservedPrivateTableNames() {
  return [...FOUNDATION_PRESERVED_PRIVATE_TABLES];
}

export function foundationPreservedPublicTableSqlList() {
  return sqlStringList(FOUNDATION_PRESERVED_PUBLIC_TABLES);
}

export function foundationPreservedPrivateTableSqlList() {
  return sqlStringList(FOUNDATION_PRESERVED_PRIVATE_TABLES);
}

export function foundationDeferredTableSqlList() {
  return sqlStringList(FOUNDATION_STAGE_DEPENDENCY_TABLES);
}

export function fullTenantRemovalFoundationBridgeClearTableSqlList() {
  return sqlStringList(FULL_TENANT_REMOVAL_FOUNDATION_BRIDGE_CLEAR_TABLES);
}

export function sharedReferenceCatalogTableSqlList() {
  return sqlStringList(SHARED_REFERENCE_CATALOG_TABLES);
}

export function privateInfrastructureTableSqlList() {
  return sqlStringList(PRIVATE_INFRASTRUCTURE_TABLES);
}

function buildCrossStageForeignKeyEdgeSelectSql(options?: {
  indent?: string;
  additionalWhere?: string;
}) {
  const indent = options?.indent ?? "";
  const additionalWhere = options?.additionalWhere
    ? `\n${indent}    and ${options.additionalWhere}`
    : "";

  return `
${indent}  select
${indent}    tc.constraint_name,
${indent}    kcu.table_schema as child_schema,
${indent}    kcu.table_name as child_table,
${indent}    string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as child_columns,
${indent}    parent_kcu.table_schema as parent_schema,
${indent}    parent_kcu.table_name as parent_table,
${indent}    string_agg(parent_kcu.column_name, ', ' order by kcu.ordinal_position) as parent_columns,
${indent}    rc.delete_rule as on_delete
${indent}  from information_schema.table_constraints tc
${indent}  join information_schema.key_column_usage kcu
${indent}    on tc.constraint_name = kcu.constraint_name
${indent}   and tc.table_schema = kcu.table_schema
${indent}  join information_schema.referential_constraints rc
${indent}    on tc.constraint_name = rc.constraint_name
${indent}   and tc.table_schema = rc.constraint_schema
${indent}  join information_schema.key_column_usage parent_kcu
${indent}    on rc.unique_constraint_schema = parent_kcu.constraint_schema
${indent}   and rc.unique_constraint_name = parent_kcu.constraint_name
${indent}   and kcu.position_in_unique_constraint = parent_kcu.ordinal_position
${indent}  where tc.constraint_type = 'FOREIGN KEY'${additionalWhere}
${indent}  group by
${indent}    tc.constraint_name,
${indent}    kcu.table_schema,
${indent}    kcu.table_name,
${indent}    parent_kcu.table_schema,
${indent}    parent_kcu.table_name,
${indent}    rc.delete_rule`;
}

function buildFoundationPreservedChildWhereClause(indent: string) {
  const publicTables = foundationPreservedPublicTableSqlList();
  const privateTables = foundationPreservedPrivateTableSqlList();
  const bridgeClearTables = fullTenantRemovalFoundationBridgeClearTableSqlList();

  return `
${indent}(
${indent}  kcu.table_schema = 'public'
${indent}  and kcu.table_name in (${publicTables})
${indent}  and kcu.table_name not in (${bridgeClearTables})
${indent})
${indent}or (
${indent}  kcu.table_schema = 'private'
${indent}  and kcu.table_name in (${privateTables})
${indent})`;
}

function buildModuleStageParentWhereClause(indent: string) {
  const foundationPublicTables = foundationPreservedPublicTableSqlList();
  const deferredTables = foundationDeferredTableSqlList();
  const sharedCatalogTables = sharedReferenceCatalogTableSqlList();
  const privateInfrastructureTables = privateInfrastructureTableSqlList();

  return `
${indent}(
${indent}  parent_kcu.table_schema = 'public'
${indent}  and parent_kcu.table_name not in (${foundationPublicTables})
${indent}  and parent_kcu.table_name not in (${deferredTables})
${indent}  and parent_kcu.table_name not in (${sharedCatalogTables})
${indent}  and exists (
${indent}    select 1
${indent}    from information_schema.columns parent_org_col
${indent}    where parent_org_col.table_schema = parent_kcu.table_schema
${indent}      and parent_org_col.table_name = parent_kcu.table_name
${indent}      and parent_org_col.column_name = 'organisation_id'
${indent}  )
${indent})
${indent}or (
${indent}  parent_kcu.table_schema = 'private'
${indent}  and parent_kcu.table_name in (${privateInfrastructureTables})
${indent})`;
}

export function classifyCrossStageFkTableLifecycle(
  schema: string,
  table: string,
): CrossStageFkLifecycleStage {
  if (
    FOUNDATION_STAGE_APPEND_ONLY_TABLE_NAMES.has(table) &&
    schema === "public"
  ) {
    return "foundation-preserved";
  }

  if (
    FOUNDATION_STAGE_DEPENDENCY_TABLE_NAMES.has(table) &&
    schema === "public"
  ) {
    return "foundation-deferred";
  }

  if (
    FOUNDATION_PRESERVED_PUBLIC_TABLE_NAMES.has(table) &&
    schema === "public"
  ) {
    return "foundation-preserved";
  }

  if (
    FOUNDATION_PRESERVED_PRIVATE_TABLE_NAMES.has(table) &&
    schema === "private"
  ) {
    return "foundation-preserved";
  }

  if (
    SHARED_REFERENCE_CATALOG_TABLE_NAMES.has(table) &&
    schema === "public"
  ) {
    return "unknown";
  }

  if (schema === "private" && PRIVATE_INFRASTRUCTURE_TABLE_NAMES.has(table)) {
    return "private-infrastructure";
  }

  if (
    MODULE_PURGE_INFRASTRUCTURE_TABLE_NAMES.has(table) &&
    schema === "public"
  ) {
    return "module-deleted";
  }

  if (MODULE_STAGE_APPEND_ONLY_TABLE_NAMES.has(table) && schema === "public") {
    return "module-deleted";
  }

  if (schema === "public" && table !== "organisations") {
    return "module-deleted";
  }

  return "unknown";
}

function isRestrictiveDeleteRule(onDelete: string) {
  return onDelete === "RESTRICT" || onDelete === "NO ACTION";
}

export function evaluateCrossStageForeignKeyEdge(
  edge: Omit<
    CrossStageForeignKeyEdge,
    "childLifecycleStage" | "parentLifecycleStage" | "deletionOrderSafe"
  >,
): CrossStageForeignKeyEdge {
  const childLifecycleStage = classifyCrossStageFkTableLifecycle(
    edge.childSchema,
    edge.childTable,
  );
  const parentLifecycleStage = classifyCrossStageFkTableLifecycle(
    edge.parentSchema,
    edge.parentTable,
  );

  const crossesFoundationPreservedChildToModuleDeletedParent =
    childLifecycleStage === "foundation-preserved" &&
    parentLifecycleStage === "module-deleted";

  const parentExplicitlyDeferred =
    parentLifecycleStage === "foundation-deferred" ||
    (edge.parentSchema === "public" &&
      FOUNDATION_STAGE_DEPENDENCY_TABLE_NAMES.has(edge.parentTable));

  const childClearedBeforeModuleParents =
    edge.childSchema === "public" &&
    FULL_TENANT_REMOVAL_FOUNDATION_BRIDGE_CLEAR_TABLE_NAMES.has(edge.childTable);

  const parentIsSharedCatalog =
    edge.parentSchema === "public" &&
    SHARED_REFERENCE_CATALOG_TABLE_NAMES.has(edge.parentTable);

  const deletionOrderSafe =
    !crossesFoundationPreservedChildToModuleDeletedParent ||
    !isRestrictiveDeleteRule(edge.onDelete) ||
    parentExplicitlyDeferred ||
    childClearedBeforeModuleParents ||
    parentIsSharedCatalog;

  return {
    ...edge,
    childLifecycleStage,
    parentLifecycleStage,
    deletionOrderSafe,
  };
}

export function listCrossStageForeignKeysSql() {
  const foundationPublicTables = foundationPreservedPublicTableSqlList();

  return `
select coalesce(
  array_to_json(
    array_agg(
      jsonb_build_object(
        'constraint_name', fk.constraint_name,
        'child_schema', fk.child_schema,
        'child_table', fk.child_table,
        'child_columns', fk.child_columns,
        'parent_schema', fk.parent_schema,
        'parent_table', fk.parent_table,
        'parent_columns', fk.parent_columns,
        'on_delete', fk.on_delete
      )
      order by fk.child_table, fk.constraint_name
    )
  ),
  '[]'::json
) as edges
from (
${buildCrossStageForeignKeyEdgeSelectSql({
  indent: "  ",
  additionalWhere: `(
      kcu.table_name in (${foundationPublicTables})
      or parent_kcu.table_name in (${foundationPublicTables})
      or kcu.table_name in ('security_audit_events', 'business_audit_events', 'resource_records')
      or parent_kcu.table_name in ('security_audit_events', 'business_audit_events', 'resource_records', 'organisation_memberships', 'organisations')
      or kcu.table_schema = 'private'
      or parent_kcu.table_schema = 'private'
    )`,
})}
) fk;
`;
}

export function collectCrossStageForeignKeyInventory(
  databaseUrl: string,
): CrossStageForeignKeyEdge[] {
  const rows = runSupabaseDbQueryJson<{
    edges: Array<{
      constraint_name: string;
      child_schema: string;
      child_table: string;
      child_columns: string;
      parent_schema: string;
      parent_table: string;
      parent_columns: string;
      on_delete: string;
    }>;
  }>({
    databaseUrl,
    outputFormat: "json",
    sql: listCrossStageForeignKeysSql(),
  });

  return (rows[0]?.edges ?? []).map((edge) =>
    evaluateCrossStageForeignKeyEdge({
      constraintName: edge.constraint_name,
      childSchema: edge.child_schema,
      childTable: edge.child_table,
      childColumns: edge.child_columns,
      parentSchema: edge.parent_schema,
      parentTable: edge.parent_table,
      parentColumns: edge.parent_columns,
      onDelete: edge.on_delete,
    }),
  );
}

export function collectUnsafeCrossStageForeignKeyEdges(
  edges: readonly CrossStageForeignKeyEdge[],
) {
  return edges.filter((edge) => !edge.deletionOrderSafe);
}

export function formatCrossStageForeignKeyFailureLines(
  edges: readonly CrossStageForeignKeyEdge[],
) {
  return edges.map(
    (edge) =>
      `${edge.constraintName}: ${edge.childSchema}.${edge.childTable}(${edge.childColumns}) -> ${edge.parentSchema}.${edge.parentTable}(${edge.parentColumns}) ON DELETE ${edge.onDelete}`,
  );
}

export function assertCrossStageForeignKeyDeletionOrderSafe(
  databaseUrl: string,
) {
  const inventory = collectCrossStageForeignKeyInventory(databaseUrl);
  const unsafe = collectUnsafeCrossStageForeignKeyEdges(inventory);

  if (unsafe.length > 0) {
    throw new Error(
      `Cross-stage FK deletion order check failed: ${formatCrossStageForeignKeyFailureLines(unsafe).join("; ")}`,
    );
  }

  return inventory;
}

export function buildCrossStageForeignKeyGuardStatements(options?: {
  indent?: string;
}) {
  const indent = options?.indent ?? "  ";
  const childWhere = buildFoundationPreservedChildWhereClause(`${indent}    `);
  const parentWhere = buildModuleStageParentWhereClause(`${indent}    `);

  return `
${indent}-- Cross-stage FK guard: all foundation-preserved children must not RESTRICT module-stage parent deletes.
${indent}select coalesce(
${indent}  array_agg(
${indent}    format(
${indent}      '%s: %s.%s(%s) -> %s.%s(%s) ON DELETE %s',
${indent}      unsafe.constraint_name,
${indent}      unsafe.child_schema,
${indent}      unsafe.child_table,
${indent}      unsafe.child_columns,
${indent}      unsafe.parent_schema,
${indent}      unsafe.parent_table,
${indent}      unsafe.parent_columns,
${indent}      unsafe.on_delete
${indent}    )
${indent}    order by unsafe.constraint_name
${indent}  ),
${indent}  array[]::text[]
${indent})
${indent}into cross_stage_fk_violations
${indent}from (
${buildCrossStageForeignKeyEdgeSelectSql({
  indent: `${indent}  `,
  additionalWhere: `(
${childWhere}
${indent}    )
${indent}    and (
${parentWhere}
${indent}    )
${indent}    and rc.delete_rule in ('RESTRICT', 'NO ACTION')`,
})}
${indent}) unsafe;
${indent}
${indent}if coalesce(array_length(cross_stage_fk_violations, 1), 0) > 0 then
${indent}  raise exception
${indent}    'Tenant module purge blocked: unsafe cross-stage FK dependencies: %',
${indent}    array_to_string(cross_stage_fk_violations, ', ');
${indent}end if;
`;
}
