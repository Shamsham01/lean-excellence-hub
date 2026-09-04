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

export const PURGE_INFRASTRUCTURE_TABLES = [
  "resource_records",
  "templates",
  "template_versions",
  "template_sections",
  "template_questions",
  "template_submissions",
  "template_answers",
] as const;

export function listAppendOnlyDeleteTablesSql() {
  return `
select coalesce(
  array_to_json(array_agg(distinct event_object_table order by event_object_table)),
  '[]'::json
) as tables
from information_schema.triggers
where trigger_schema = 'public'
  and event_manipulation = 'DELETE'
  and action_statement ilike '%prevent_update_or_delete%';
`;
}

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
