import type { SupabaseClient } from "@supabase/supabase-js";

import { executePurgeTenantModuleDataSql } from "./delete-tenant";
import { runSupabaseDbQuery, runSupabaseDbQueryJson } from "./db-cli";
import {
  LEGACY_HOSTED_DEMO_ORGANISATION,
  LEGACY_HOSTED_DEMO_EXPECTED_MEMBERSHIPS,
} from "./legacy-hosted-demo";
import { purgeTenantStorageObjects } from "./tenant-storage-cleanup";

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

export type LegacyHostedDemoOrganisation = {
  id: string;
  code: string;
  name: string;
};

export function resolveLegacyHostedDemoOrganisation(databaseUrl: string) {
  const rows = runSupabaseDbQueryJson<LegacyHostedDemoOrganisation>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select id, code, name
      from public.organisations
      where code = '${escapeSqlLiteral(LEGACY_HOSTED_DEMO_ORGANISATION.code)}'
         or id = '${LEGACY_HOSTED_DEMO_ORGANISATION.id}'::uuid;
    `,
  });

  return rows[0] ?? null;
}

export function assertLegacyHostedDemoContract(
  databaseUrl: string,
  options?: { expectedMemberships?: number },
) {
  const organisation = resolveLegacyHostedDemoOrganisation(databaseUrl);

  if (!organisation) {
    throw new Error(
      `Legacy hosted demo organisation ${LEGACY_HOSTED_DEMO_ORGANISATION.code} was not found.`,
    );
  }

  if (organisation.id !== LEGACY_HOSTED_DEMO_ORGANISATION.id) {
    throw new Error(
      `Legacy hosted demo UUID mismatch: expected ${LEGACY_HOSTED_DEMO_ORGANISATION.id}, found ${organisation.id}.`,
    );
  }

  if (organisation.code !== LEGACY_HOSTED_DEMO_ORGANISATION.code) {
    throw new Error(
      `Legacy hosted demo code mismatch: expected ${LEGACY_HOSTED_DEMO_ORGANISATION.code}, found ${organisation.code}.`,
    );
  }

  if (organisation.name !== LEGACY_HOSTED_DEMO_ORGANISATION.name) {
    throw new Error(
      `Legacy hosted demo name mismatch: expected ${LEGACY_HOSTED_DEMO_ORGANISATION.name}, found ${organisation.name}.`,
    );
  }

  const membershipRows = runSupabaseDbQueryJson<{ count: number }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select count(*)::int as count
      from public.organisation_memberships
      where organisation_id = '${organisation.id}'::uuid;
    `,
  });
  const membershipCount = membershipRows[0]?.count ?? 0;
  const expectedMemberships =
    options?.expectedMemberships ?? LEGACY_HOSTED_DEMO_EXPECTED_MEMBERSHIPS;

  if (membershipCount !== expectedMemberships) {
    throw new Error(
      `Legacy hosted demo membership count mismatch: expected ${expectedMemberships}, found ${membershipCount}.`,
    );
  }

  return { organisation, membershipCount };
}

export function listLegacyHostedDemoAuthUserIds(databaseUrl: string) {
  const rows = runSupabaseDbQueryJson<{ user_id: string }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select distinct membership.user_id
      from public.organisation_memberships membership
      where membership.organisation_id = '${LEGACY_HOSTED_DEMO_ORGANISATION.id}'::uuid
      order by membership.user_id;
    `,
  });

  return rows.map((row) => row.user_id).filter(Boolean);
}

export function listLegacyHostedDemoDeletableAuthUserIds(databaseUrl: string) {
  const rows = runSupabaseDbQueryJson<{ user_id: string }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      with legacy_members as (
        select distinct membership.user_id
        from public.organisation_memberships membership
        where membership.organisation_id = '${LEGACY_HOSTED_DEMO_ORGANISATION.id}'::uuid
      )
      select legacy_members.user_id
      from legacy_members
      where not exists (
        select 1
        from public.organisation_memberships other_membership
        where other_membership.user_id = legacy_members.user_id
          and other_membership.organisation_id <> '${LEGACY_HOSTED_DEMO_ORGANISATION.id}'::uuid
      )
      order by legacy_members.user_id;
    `,
  });

  return rows.map((row) => row.user_id).filter(Boolean);
}

function buildDeleteLegacyOrganisationSql() {
  const orgId = LEGACY_HOSTED_DEMO_ORGANISATION.id;
  const orgCode = escapeSqlLiteral(LEGACY_HOSTED_DEMO_ORGANISATION.code);

  return `
do $$
declare
  target_org_id uuid := '${orgId}'::uuid;
  target_org_code text := '${orgCode}';
  resolved_org_id uuid;
begin
  select id into resolved_org_id
  from public.organisations
  where id = target_org_id
    and code = target_org_code;

  if resolved_org_id is null then
    raise notice 'Legacy hosted demo organisation already absent (%).', target_org_code;
    return;
  end if;

  delete from private.notification_delivery_provider_envelopes
  where organisation_id = target_org_id;

  delete from private.notification_delivery_ledger
  where organisation_id = target_org_id;

  delete from private.domain_event_outbox
  where organisation_id = target_org_id;

  delete from private.session_organisation_contexts
  where organisation_id = target_org_id;

  delete from public.organisation_invitation_signup_bindings
  where invitation_id in (
    select id
    from public.organisation_invitations
    where organisation_id = target_org_id
  );

  delete from public.workforce_import_row_credentials
  where import_row_id in (
    select id
    from public.workforce_import_rows
    where organisation_id = target_org_id
  );

  delete from public.membership_notification_contacts
  where organisation_id = target_org_id;

  delete from public.access_grants
  where organisation_id = target_org_id;

  delete from public.role_grant_scope_policies
  where organisation_id = target_org_id;

  delete from public.role_permissions
  where organisation_id = target_org_id;

  delete from public.role_versions
  where organisation_id = target_org_id;

  delete from public.roles
  where organisation_id = target_org_id;

  delete from public.organisation_invitation_grants
  where organisation_id = target_org_id;

  delete from public.organisation_invitation_provisioning
  where organisation_id = target_org_id;

  delete from public.organisation_invitations
  where organisation_id = target_org_id;

  delete from public.organisation_memberships
  where organisation_id = target_org_id;

  delete from public.organisation_unit_closure
  where organisation_id = target_org_id;

  delete from public.organisation_units
  where organisation_id = target_org_id;

  delete from public.organisation_document_sequences
  where organisation_id = target_org_id;

  delete from public.organisation_ai_settings
  where organisation_id = target_org_id;

  delete from public.benefit_reporting_settings
  where organisation_id = target_org_id;

  delete from public.problem_solving_method_stages
  where organisation_id = target_org_id;

  delete from public.problem_solving_method_versions
  where organisation_id = target_org_id;

  delete from public.problem_solving_methods
  where organisation_id = target_org_id;

  delete from public.workforce_import_rows
  where organisation_id = target_org_id;

  delete from public.workforce_import_jobs
  where organisation_id = target_org_id;

  delete from public.workforce_provision_intents
  where organisation_id = target_org_id;

  delete from private.workforce_aliases
  where organisation_id = target_org_id;

  alter table public.business_audit_events
    disable trigger business_audit_events_prevent_delete;

  delete from public.business_audit_events
  where organisation_id = target_org_id;

  alter table public.business_audit_events
    enable trigger business_audit_events_prevent_delete;

  alter table public.security_audit_events
    disable trigger security_audit_events_append_only;

  delete from public.security_audit_events
  where organisation_id = target_org_id;

  alter table public.security_audit_events
    enable trigger security_audit_events_append_only;

  delete from public.organisations
  where id = target_org_id
    and code = target_org_code;

  if exists (
    select 1
    from public.organisations
    where id = target_org_id
       or code = target_org_code
  ) then
    raise exception
      'Legacy hosted demo organisation row still present after foundation deletion (%).',
      target_org_code;
  end if;

  raise notice 'Legacy hosted demo organisation deleted (%).', target_org_code;
end
$$;
`;
}

export function executeDeleteLegacyHostedDemoOrganisationSql(databaseUrl: string) {
  runSupabaseDbQuery({
    databaseUrl,
    sql: buildDeleteLegacyOrganisationSql(),
  });
}

export async function deleteLegacyHostedDemoAuthUsers(
  admin: SupabaseClient,
  databaseUrl: string,
) {
  const userIds = listLegacyHostedDemoDeletableAuthUserIds(databaseUrl);

  for (const userId of userIds) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error && deleted.error.status !== 404) {
      throw deleted.error;
    }
  }

  return userIds;
}

export function assertLegacyHostedDemoAbsent(databaseUrl: string) {
  const organisation = resolveLegacyHostedDemoOrganisation(databaseUrl);
  if (organisation) {
    throw new Error(
      `Legacy hosted demo organisation still present: ${organisation.code} (${organisation.id}).`,
    );
  }

  const storageCount = runSupabaseDbQueryJson<{ count: number }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select count(*)::int as count
      from storage.objects object_row
      where object_row.bucket_id = 'organisation-evidence'
        and object_row.name like '${LEGACY_HOSTED_DEMO_ORGANISATION.id}/%';
    `,
  });

  const remainingStorage = storageCount[0]?.count ?? 0;
  if (remainingStorage > 0) {
    throw new Error(
      `Legacy hosted demo storage objects still present: ${remainingStorage}.`,
    );
  }
}

export async function deleteLegacyHostedDemoTenant(options: {
  databaseUrl: string;
  storageAdmin: SupabaseClient;
  authAdmin: SupabaseClient;
}) {
  assertLegacyHostedDemoContract(options.databaseUrl);

  const deletableAuthUserIds = listLegacyHostedDemoDeletableAuthUserIds(
    options.databaseUrl,
  );

  executePurgeTenantModuleDataSql(
    options.databaseUrl,
    LEGACY_HOSTED_DEMO_ORGANISATION.code,
  );

  await purgeTenantStorageObjects({
    databaseUrl: options.databaseUrl,
    organisationCode: LEGACY_HOSTED_DEMO_ORGANISATION.code,
    storageAdmin: options.storageAdmin,
  });

  executeDeleteLegacyHostedDemoOrganisationSql(options.databaseUrl);

  await deleteLegacyHostedDemoAuthUsers(
    options.authAdmin,
    options.databaseUrl,
  );

  assertLegacyHostedDemoAbsent(options.databaseUrl);

  return {
    deletedAuthUserIds: deletableAuthUserIds,
  };
}
