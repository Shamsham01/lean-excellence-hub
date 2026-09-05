import type { SupabaseClient } from "@supabase/supabase-js";

import { purgeAuthUserIdentityPrerequisites } from "./auth-identity-cleanup";
import {
  assertLegacyAuthUsersAbsent,
  assertLegacyHostedDemoFullyAbsent,
} from "./legacy-absence-verification";
import { executePurgeTenantModuleDataSql } from "./delete-tenant";
import { runSupabaseDbQuery, runSupabaseDbQueryJson } from "./db-cli";
import {
  LEGACY_HOSTED_DEMO_ORGANISATION,
  LEGACY_HOSTED_DEMO_EXPECTED_MEMBERSHIPS,
} from "./legacy-hosted-demo";
import { buildTenantPrivateInfrastructurePurgeStatements } from "./private-infrastructure-purge";
import { purgeTenantStorageObjects } from "./tenant-storage-cleanup";

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

export type LegacyHostedDemoOrganisation = {
  id: string;
  code: string;
  name: string;
};

export type LegacyOrganisationResolution =
  | { status: "exact"; organisation: LegacyHostedDemoOrganisation }
  | { status: "missing" }
  | {
      status: "uuid_collision";
      organisation: LegacyHostedDemoOrganisation;
      expectedCode: string;
    }
  | {
      status: "code_collision";
      organisation: LegacyHostedDemoOrganisation;
      expectedId: string;
    }
  | {
      status: "contract_mismatch";
      organisation: LegacyHostedDemoOrganisation;
      mismatches: string[];
    };

export type LegacyDeletionContext = {
  organisation: LegacyHostedDemoOrganisation;
  membershipCount: number;
  legacyAuthUserIds: string[];
  deletableAuthUserIds: string[];
};

function queryOrganisationById(databaseUrl: string) {
  const rows = runSupabaseDbQueryJson<LegacyHostedDemoOrganisation>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select id, code, name
      from public.organisations
      where id = '${LEGACY_HOSTED_DEMO_ORGANISATION.id}'::uuid;
    `,
  });

  return rows[0] ?? null;
}

function queryOrganisationByCode(databaseUrl: string) {
  const rows = runSupabaseDbQueryJson<LegacyHostedDemoOrganisation>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select id, code, name
      from public.organisations
      where code = '${escapeSqlLiteral(LEGACY_HOSTED_DEMO_ORGANISATION.code)}';
    `,
  });

  return rows[0] ?? null;
}

export function resolveLegacyHostedDemoOrganisation(
  databaseUrl: string,
): LegacyHostedDemoOrganisation | null {
  const resolution = resolveLegacyHostedDemoOrganisationStrict(databaseUrl);
  return resolution.status === "exact" ? resolution.organisation : null;
}

export function resolveLegacyHostedDemoOrganisationStrict(
  databaseUrl: string,
): LegacyOrganisationResolution {
  const byId = queryOrganisationById(databaseUrl);
  const byCode = queryOrganisationByCode(databaseUrl);

  if (!byId && !byCode) {
    return { status: "missing" };
  }

  if (byId && !byCode) {
    return {
      status: "uuid_collision",
      organisation: byId,
      expectedCode: LEGACY_HOSTED_DEMO_ORGANISATION.code,
    };
  }

  if (!byId && byCode) {
    return {
      status: "code_collision",
      organisation: byCode,
      expectedId: LEGACY_HOSTED_DEMO_ORGANISATION.id,
    };
  }

  const organisation = byId!;
  const mismatches: string[] = [];

  if (organisation.id !== LEGACY_HOSTED_DEMO_ORGANISATION.id) {
    mismatches.push(
      `id expected ${LEGACY_HOSTED_DEMO_ORGANISATION.id}, found ${organisation.id}`,
    );
  }
  if (organisation.code !== LEGACY_HOSTED_DEMO_ORGANISATION.code) {
    mismatches.push(
      `code expected ${LEGACY_HOSTED_DEMO_ORGANISATION.code}, found ${organisation.code}`,
    );
  }
  if (organisation.name !== LEGACY_HOSTED_DEMO_ORGANISATION.name) {
    mismatches.push(
      `name expected ${LEGACY_HOSTED_DEMO_ORGANISATION.name}, found ${organisation.name}`,
    );
  }
  if (byCode && byCode.id !== organisation.id) {
    mismatches.push(
      `id/code lookup mismatch: id row ${organisation.id}, code row ${byCode.id}`,
    );
  }

  if (mismatches.length > 0) {
    return {
      status: "contract_mismatch",
      organisation,
      mismatches,
    };
  }

  return { status: "exact", organisation };
}

export function assertLegacyHostedDemoContract(
  databaseUrl: string,
  options?: { expectedMemberships?: number },
) {
  const resolution = resolveLegacyHostedDemoOrganisationStrict(databaseUrl);

  if (resolution.status === "missing") {
    throw new Error(
      `Legacy hosted demo organisation ${LEGACY_HOSTED_DEMO_ORGANISATION.code} was not found.`,
    );
  }

  if (resolution.status === "uuid_collision") {
    throw new Error(
      `Legacy hosted demo UUID collision: found organisation ${resolution.organisation.code} (${resolution.organisation.id}) but expected code ${resolution.expectedCode}.`,
    );
  }

  if (resolution.status === "code_collision") {
    throw new Error(
      `Legacy hosted demo code collision: found organisation ${resolution.organisation.name} (${resolution.organisation.id}) but expected UUID ${resolution.expectedId}.`,
    );
  }

  if (resolution.status === "contract_mismatch") {
    throw new Error(
      `Legacy hosted demo contract mismatch: ${resolution.mismatches.join("; ")}.`,
    );
  }

  const organisation = resolution.organisation;
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

export function listLegacyHostedDemoCrossOrganisationConflicts(
  databaseUrl: string,
) {
  const rows = runSupabaseDbQueryJson<{
    user_id: string;
    organisation_id: string;
    organisation_code: string;
    organisation_name: string;
  }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select
        membership.user_id,
        other_org.id as organisation_id,
        other_org.code as organisation_code,
        other_org.name as organisation_name
      from public.organisation_memberships membership
      join public.organisation_memberships other_membership
        on other_membership.user_id = membership.user_id
      join public.organisations other_org
        on other_org.id = other_membership.organisation_id
      where membership.organisation_id = '${LEGACY_HOSTED_DEMO_ORGANISATION.id}'::uuid
        and other_membership.organisation_id <> '${LEGACY_HOSTED_DEMO_ORGANISATION.id}'::uuid
      order by membership.user_id, other_org.code;
    `,
  });

  return rows;
}

export function assertLegacyAuthUsersIsolated(databaseUrl: string) {
  const legacyAuthUserIds = listLegacyHostedDemoAuthUserIds(databaseUrl);
  const deletableAuthUserIds =
    listLegacyHostedDemoDeletableAuthUserIds(databaseUrl);

  const legacySet = new Set(legacyAuthUserIds);
  const deletableSet = new Set(deletableAuthUserIds);

  if (
    legacyAuthUserIds.length !== deletableAuthUserIds.length ||
    legacyAuthUserIds.some((userId) => !deletableSet.has(userId)) ||
    deletableAuthUserIds.some((userId) => !legacySet.has(userId))
  ) {
    const conflicts =
      listLegacyHostedDemoCrossOrganisationConflicts(databaseUrl);
    const conflictLines = conflicts.map(
      (conflict) =>
        `user ${conflict.user_id} also belongs to ${conflict.organisation_name} (${conflict.organisation_code}, ${conflict.organisation_id})`,
    );

    throw new Error(
      `Legacy hosted demo auth isolation failed: legacyAuthUserIds=[${legacyAuthUserIds.join(", ")}], deletableAuthUserIds=[${deletableAuthUserIds.join(", ")}]. ${conflictLines.join("; ")}`,
    );
  }

  return {
    legacyAuthUserIds,
    deletableAuthUserIds,
  };
}

export function captureLegacyDeletionContext(
  databaseUrl: string,
  options?: { expectedMemberships?: number },
): LegacyDeletionContext {
  const { organisation, membershipCount } = assertLegacyHostedDemoContract(
    databaseUrl,
    options,
  );
  const { legacyAuthUserIds, deletableAuthUserIds } =
    assertLegacyAuthUsersIsolated(databaseUrl);

  return {
    organisation,
    membershipCount,
    legacyAuthUserIds: [...legacyAuthUserIds],
    deletableAuthUserIds: [...deletableAuthUserIds],
  };
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

${buildTenantPrivateInfrastructurePurgeStatements("target_org_id")}

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

export function executeDeleteLegacyHostedDemoOrganisationSql(
  databaseUrl: string,
) {
  runSupabaseDbQuery({
    databaseUrl,
    sql: buildDeleteLegacyOrganisationSql(),
  });
}

export async function deleteLegacyHostedDemoAuthUsers(
  admin: SupabaseClient,
  userIds: readonly string[],
  options?: { databaseUrl?: string },
) {
  if (options?.databaseUrl) {
    purgeAuthUserIdentityPrerequisites(options.databaseUrl, userIds);
  }

  for (const userId of userIds) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error && deleted.error.status !== 404) {
      throw deleted.error;
    }
  }

  return [...userIds];
}

export function assertLegacyHostedDemoAbsent(databaseUrl: string) {
  assertLegacyHostedDemoFullyAbsent(databaseUrl);
}

export async function deleteLegacyHostedDemoTenant(options: {
  databaseUrl: string;
  storageAdmin: SupabaseClient;
  authAdmin: SupabaseClient;
  deletionContext?: LegacyDeletionContext;
  expectedMemberships?: number;
}) {
  const deletionContext =
    options.deletionContext ??
    captureLegacyDeletionContext(
      options.databaseUrl,
      options.expectedMemberships === undefined
        ? undefined
        : { expectedMemberships: options.expectedMemberships },
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

  assertLegacyHostedDemoFullyAbsent(options.databaseUrl, {
    legacyOrganisationId: deletionContext.organisation.id,
  });

  await deleteLegacyHostedDemoAuthUsers(
    options.authAdmin,
    deletionContext.deletableAuthUserIds,
    { databaseUrl: options.databaseUrl },
  );

  await assertLegacyAuthUsersAbsent(
    options.authAdmin,
    deletionContext.deletableAuthUserIds,
  );

  return {
    deletedAuthUserIds: deletionContext.deletableAuthUserIds,
    deletionContext,
  };
}
