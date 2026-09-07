import { QA_ORGANISATION_CODE } from "./constants";

/**
 * Foundation tables preserved during CookieWorks module purge.
 * See docs/development/qa-tenant-deletion-graph.md for the full strategy.
 */
export const FOUNDATION_TABLES = [
  "organisations",
  "organisation_memberships",
  "organisation_units",
  "organisation_unit_closure",
  "roles",
  "role_versions",
  "role_permissions",
  "role_grant_scope_policies",
  "access_grants",
  "organisation_invitations",
  "organisation_invitation_grants",
  "organisation_invitation_provisioning",
  "organisation_document_sequences",
  "organisation_ai_settings",
  "problem_solving_methods",
  "problem_solving_method_versions",
  "problem_solving_method_stages",
  "security_audit_events",
  "business_audit_events",
  "benefit_reporting_settings",
  "membership_notification_contacts",
  "workforce_provision_intents",
  "workforce_import_jobs",
  "workforce_import_rows",
  "workforce_import_row_credentials",
  "private.workforce_aliases",
] as const;

export type IndirectTenantCheck = {
  resource: string;
  description: string;
  countSql: string;
};

/**
 * Tenant-owned resources that do not carry organisation_id directly.
 * Each check is validated against the CookieWorks organisation resolved by code.
 */
export const INDIRECT_TENANT_CHECKS: IndirectTenantCheck[] = [
  {
    resource: "public.organisation_invitation_signup_bindings",
    description:
      "Invitation signup bindings inherit tenant via organisation_invitations",
    countSql: `
      select count(*)::bigint as count
      from public.organisation_invitation_signup_bindings binding
      where binding.invitation_id in (
        select invitation.id
        from public.organisation_invitations invitation
        join target_org on target_org.id = invitation.organisation_id
      )
    `,
  },
  {
    resource: "storage.objects[organisation-evidence]",
    description:
      "Attachment/evidence files stored under {organisation_id}/ resource prefix",
    countSql: `
      select count(*)::bigint as count
      from storage.objects object_row
      join target_org on object_row.name like target_org.id::text || '/%'
      where object_row.bucket_id = 'organisation-evidence'
    `,
  },
];

export const COOKIEWORKS_STORAGE_BUCKET = "organisation-evidence";

export const MAX_MODULE_PURGE_PASSES = 160;

/**
 * Template/resource registry tables deleted explicitly during full-tenant-removal
 * module purge (not the generic DELETE loop).
 */
export const MODULE_PURGE_INFRASTRUCTURE_TABLES = [
  "templates",
  "template_versions",
  "template_sections",
  "template_questions",
  "template_submissions",
  "template_answers",
] as const;

/**
 * Infrastructure parents that must survive module purge because foundation-stage
 * append-only audit ledgers reference them with ON DELETE RESTRICT.
 * Deleted only during foundation/organisation deletion after audit retirement.
 */
export const FOUNDATION_STAGE_DEPENDENCY_TABLES = ["resource_records"] as const;

/**
 * Foundation tables cleared during full-tenant-removal module purge before
 * tenant-scoped module parents are deleted. Required when foundation rows
 * RESTRICT-delete against module tables such as job_functions.
 */
export const FULL_TENANT_REMOVAL_FOUNDATION_BRIDGE_CLEAR_TABLES = [
  "organisation_invitation_provisioning",
  "workforce_provision_intents",
] as const;

/**
 * Shared reference catalog tables without organisation_id. They are never
 * tenant module-deletion targets during purge.
 */
export const SHARED_REFERENCE_CATALOG_TABLES = [
  "permission_definitions",
] as const;

export const PURGE_INFRASTRUCTURE_TABLES = [
  ...MODULE_PURGE_INFRASTRUCTURE_TABLES,
  ...FOUNDATION_STAGE_DEPENDENCY_TABLES,
] as const;

export function modulePurgeInfrastructureTableSqlList() {
  return MODULE_PURGE_INFRASTRUCTURE_TABLES.map((table) => `'${table}'`).join(
    ", ",
  );
}

export function foundationStageDependencyTableSqlList() {
  return FOUNDATION_STAGE_DEPENDENCY_TABLES.map((table) => `'${table}'`).join(
    ", ",
  );
}

export function fullTenantRemovalFoundationBridgeClearTableSqlList() {
  return FULL_TENANT_REMOVAL_FOUNDATION_BRIDGE_CLEAR_TABLES.map(
    (table) => `'${table}'`,
  ).join(", ");
}

export function buildFullTenantRemovalFoundationBridgeClearStatements(
  targetOrgVar: string,
  options?: { indent?: string },
) {
  const indent = options?.indent ?? "  ";
  const lines: string[] = [];

  lines.push(
    `${indent}-- Foundation bridge rows cleared before module parent deletion (full-tenant-removal only).`,
  );

  for (const tableName of FULL_TENANT_REMOVAL_FOUNDATION_BRIDGE_CLEAR_TABLES) {
    lines.push(
      `${indent}delete from public.${tableName}`,
      `${indent}where organisation_id = ${targetOrgVar};`,
      "",
    );
  }

  return lines.join("\n");
}

export function purgeInfrastructureTableSqlList() {
  return PURGE_INFRASTRUCTURE_TABLES.map((table) => `'${table}'`).join(", ");
}

export function buildFoundationStageDependencyDeleteStatements(
  targetOrgVar: string,
  options?: { indent?: string },
) {
  const indent = options?.indent ?? "  ";
  const lines: string[] = [];

  lines.push(
    `${indent}-- Foundation-stage dependency retirement (deferred from module purge).`,
  );
  lines.push(
    `${indent}-- Must run after foundation append-only audit ledger deletion.`,
  );

  for (const tableName of FOUNDATION_STAGE_DEPENDENCY_TABLES) {
    lines.push(
      `${indent}delete from public.${tableName}`,
      `${indent}where organisation_id = ${targetOrgVar};`,
      "",
    );
  }

  return lines.join("\n");
}

export function assertDeletionGraphPolicyConsistency() {
  const failures: string[] = [];

  for (const dependencyTable of FOUNDATION_STAGE_DEPENDENCY_TABLES) {
    if (
      MODULE_PURGE_INFRASTRUCTURE_TABLES.includes(
        dependencyTable as (typeof MODULE_PURGE_INFRASTRUCTURE_TABLES)[number],
      )
    ) {
      failures.push(
        `${dependencyTable} is both foundation-stage dependency and module-purge infrastructure`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Deletion graph policy consistency check failed: ${failures.join("; ")}`,
    );
  }
}

export { listAllAppendOnlyDeleteTablesSql as listAppendOnlyDeleteTablesSql } from "./tenant-retirement-policy";

export function foundationTableSqlList() {
  return FOUNDATION_TABLES.filter((table) => !table.includes("."))
    .map((table) => `'${table}'`)
    .join(", ");
}

export function buildOrganisationScopeCte() {
  return `
target_org as (
  select id, code, name
  from public.organisations
  where code = '${QA_ORGANISATION_CODE}'
  limit 1
)`;
}
