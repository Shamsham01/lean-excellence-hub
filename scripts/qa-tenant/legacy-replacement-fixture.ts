import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { purgeAuthUserIdentityPrerequisites } from "./auth-identity-cleanup";
import { COOKIEWORKS_STORAGE_BUCKET } from "./deletion-graph";
import { executePurgeTenantModuleDataSql } from "./delete-tenant";
import { executeDeleteLegacyHostedDemoOrganisationSql } from "./delete-legacy-hosted-demo";
import { runSupabaseDbQuery, runSupabaseDbQueryJson } from "./db-cli";
import { LEGACY_HOSTED_DEMO_ORGANISATION } from "./legacy-hosted-demo";

export type LegacyReplacementFixtureMember = {
  userId: string;
  email: string;
  password: string;
  displayName: string;
};

export const LEGACY_REPLACEMENT_FIXTURE_MEMBERS: LegacyReplacementFixtureMember[] =
  Array.from({ length: 3 }, (_, index) => {
    const suffix = String(index + 1).padStart(3, "0");
    return {
      userId: `d0000000-0000-0000-0000-00000000000${index + 1}`,
      email: `legacy-demo-${suffix}@lean-excellence.local`,
      password: `LegacyDemo@${suffix}-QA-2026!`,
      displayName: `Legacy Demo Member ${index + 1}`,
    };
  });

export const LEGACY_REPLACEMENT_CROSS_ORG = {
  code: "qa-legacy-cross-org",
  name: "QA Legacy Cross Org",
} as const;

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

export async function ensureLegacyReplacementFixtureMembers(
  admin: SupabaseClient,
) {
  for (const member of LEGACY_REPLACEMENT_FIXTURE_MEMBERS) {
    const existing = await admin.auth.admin.getUserById(member.userId);
    if (existing.error || !existing.data.user) {
      const created = await admin.auth.admin.createUser({
        id: member.userId,
        email: member.email,
        password: member.password,
        email_confirm: true,
        user_metadata: { full_name: member.displayName },
      });
      if (created.error && created.error.status !== 422) {
        throw created.error;
      }
    }

    const { error: enrolmentError } = await admin.rpc(
      "finalise_identity_enrolment",
      { target_user_id: member.userId },
    );
    if (enrolmentError) {
      throw enrolmentError;
    }
  }
}

export async function seedLegacyReplacementFixture(options: {
  admin: SupabaseClient;
  databaseUrl: string;
  includeCrossOrgMember?: boolean;
}) {
  await ensureLegacyReplacementFixtureMembers(options.admin);

  const orgId = LEGACY_HOSTED_DEMO_ORGANISATION.id;
  const orgCode = escapeSqlLiteral(LEGACY_HOSTED_DEMO_ORGANISATION.code);
  const orgName = escapeSqlLiteral(LEGACY_HOSTED_DEMO_ORGANISATION.name);

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisations
      where code in (
        '${orgCode}',
        '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}'
      )
         or id = '${orgId}'::uuid;
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      insert into public.organisations (
        id,
        code,
        name,
        status
      ) values (
        '${orgId}'::uuid,
        '${orgCode}',
        '${orgName}',
        'active'
      );
    `,
  });

  for (const member of LEGACY_REPLACEMENT_FIXTURE_MEMBERS) {
    const membershipId = randomUUID();
    runSupabaseDbQuery({
      databaseUrl: options.databaseUrl,
      sql: `
        insert into public.organisation_memberships (
          id,
          organisation_id,
          user_id,
          status,
          display_name,
          activated_at
        ) values (
          '${membershipId}'::uuid,
          '${orgId}'::uuid,
          '${member.userId}'::uuid,
          'active',
          '${escapeSqlLiteral(member.displayName)}',
          statement_timestamp()
        );
      `,
    });
  }

  const unitId = randomUUID();
  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      insert into public.organisation_units (
        id,
        organisation_id,
        code,
        name,
        unit_type,
        status
      ) values (
        '${unitId}'::uuid,
        '${orgId}'::uuid,
        'legacy-demo-site',
        'Legacy Demo Site',
        'plant',
        'active'
      );
    `,
  });

  const membershipId = runSupabaseDbQueryJson<{ id: string }>({
    databaseUrl: options.databaseUrl,
    outputFormat: "json",
    sql: `
      select id
      from public.organisation_memberships
      where organisation_id = '${orgId}'::uuid
      order by created_at
      limit 1;
    `,
  })[0]?.id;

  if (!membershipId) {
    throw new Error("Legacy replacement fixture missing owner membership.");
  }

  const actionId = randomUUID();
  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      insert into public.resource_records (
        id,
        organisation_id,
        resource_type,
        created_by_membership_id
      ) values (
        '${actionId}'::uuid,
        '${orgId}'::uuid,
        'action',
        '${membershipId}'::uuid
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      insert into public.actions (
        id,
        organisation_id,
        title,
        created_by_membership_id
      ) values (
        '${actionId}'::uuid,
        '${orgId}'::uuid,
        'Legacy replacement fixture action',
        '${membershipId}'::uuid
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      insert into private.domain_event_outbox (
        id,
        organisation_id,
        event_type,
        payload,
        idempotency_key,
        processing_state
      ) values (
        '${randomUUID()}'::uuid,
        '${orgId}'::uuid,
        'qa.legacy_replacement.fixture',
        '{}'::jsonb,
        'qa-legacy-replacement-fixture',
        'pending'
      );
    `,
  });

  const storagePath = `${orgId}/action/${actionId}/fixture.txt`;
  const { error: uploadError } = await options.admin.storage
    .from(COOKIEWORKS_STORAGE_BUCKET)
    .upload(
      storagePath,
      new Blob(["legacy replacement fixture"], { type: "text/plain" }),
      { upsert: true },
    );
  if (uploadError) {
    throw uploadError;
  }

  if (options.includeCrossOrgMember) {
    const crossOrgOwner = LEGACY_REPLACEMENT_FIXTURE_MEMBERS[2]!;
    const crossOrgId = randomUUID();
    runSupabaseDbQuery({
      databaseUrl: options.databaseUrl,
      sql: `
        insert into public.organisations (
          id,
          code,
          name,
          status
        ) values (
          '${crossOrgId}'::uuid,
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.name)}',
          'active'
        );
      `,
    });

    runSupabaseDbQuery({
      databaseUrl: options.databaseUrl,
      sql: `
        insert into public.organisation_memberships (
          id,
          organisation_id,
          user_id,
          status,
          display_name,
          activated_at
        ) values (
          '${randomUUID()}'::uuid,
          '${crossOrgId}'::uuid,
          '${crossOrgOwner.userId}'::uuid,
          'active',
          '${escapeSqlLiteral(crossOrgOwner.displayName)}',
          statement_timestamp()
        );
      `,
    });
  }

  return {
    organisationId: orgId,
    storagePath,
    memberUserIds: LEGACY_REPLACEMENT_FIXTURE_MEMBERS.map(
      (member) => member.userId,
    ),
  };
}

export async function cleanupLegacyReplacementFixture(options: {
  admin: SupabaseClient;
  databaseUrl: string;
}) {
  const orgId = LEGACY_HOSTED_DEMO_ORGANISATION.id;
  const orgCode = escapeSqlLiteral(LEGACY_HOSTED_DEMO_ORGANISATION.code);

  const storageRows = runSupabaseDbQueryJson<{ name: string }>({
    databaseUrl: options.databaseUrl,
    outputFormat: "json",
    sql: `
      select name
      from storage.objects
      where bucket_id = '${COOKIEWORKS_STORAGE_BUCKET}'
        and name like '${orgId}/%';
    `,
  });

  if (storageRows.length > 0) {
    const { error } = await options.admin.storage
      .from(COOKIEWORKS_STORAGE_BUCKET)
      .remove(storageRows.map((row) => row.name));
    if (error) {
      throw error;
    }
  }

  if (countLegacyOrganisationRows(options.databaseUrl) > 0) {
    executePurgeTenantModuleDataSql(
      options.databaseUrl,
      LEGACY_HOSTED_DEMO_ORGANISATION.code,
    );
    executeDeleteLegacyHostedDemoOrganisationSql(options.databaseUrl);
  }

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisation_memberships
      where organisation_id in (
        select id
        from public.organisations
        where code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}'
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisations
      where code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}'
         or id = '${orgId}'::uuid
         or code = '${orgCode}';
    `,
  });

  purgeAuthUserIdentityPrerequisites(
    options.databaseUrl,
    LEGACY_REPLACEMENT_FIXTURE_MEMBERS.map((member) => member.userId),
  );

  for (const member of LEGACY_REPLACEMENT_FIXTURE_MEMBERS) {
    const deleted = await options.admin.auth.admin.deleteUser(member.userId);
    if (deleted.error && deleted.error.status !== 404) {
      throw deleted.error;
    }
  }
}

export function countLegacyOrganisationRows(databaseUrl: string) {
  const rows = runSupabaseDbQueryJson<{ count: number }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select count(*)::int as count
      from public.organisations
      where id = '${LEGACY_HOSTED_DEMO_ORGANISATION.id}'::uuid
         or code = '${escapeSqlLiteral(LEGACY_HOSTED_DEMO_ORGANISATION.code)}';
    `,
  });

  return rows[0]?.count ?? 0;
}

export function snapshotLegacyFixtureState(databaseUrl: string) {
  const orgId = LEGACY_HOSTED_DEMO_ORGANISATION.id;
  const rows = runSupabaseDbQueryJson<{
    organisations: number;
    memberships: number;
    actions: number;
    outbox: number;
    storage_objects: number;
  }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select
        (select count(*)::int from public.organisations where id = '${orgId}'::uuid) as organisations,
        (select count(*)::int from public.organisation_memberships where organisation_id = '${orgId}'::uuid) as memberships,
        (select count(*)::int from public.actions where organisation_id = '${orgId}'::uuid) as actions,
        (select count(*)::int from private.domain_event_outbox where organisation_id = '${orgId}'::uuid) as outbox,
        (select count(*)::int from storage.objects where bucket_id = '${COOKIEWORKS_STORAGE_BUCKET}' and name like '${orgId}/%') as storage_objects;
    `,
  });

  return (
    rows[0] ?? {
      organisations: 0,
      memberships: 0,
      actions: 0,
      outbox: 0,
      storage_objects: 0,
    }
  );
}
