import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { purgeAuthUserIdentityPrerequisites } from "./auth-identity-cleanup";
import {
  buildFoundationStageDependencyDeleteStatements,
  COOKIEWORKS_STORAGE_BUCKET,
} from "./deletion-graph";
import { executeLegacyHostedDemoModulePurgeSql } from "./delete-tenant";
import { executeDeleteLegacyHostedDemoOrganisationSql } from "./delete-legacy-hosted-demo";
import { runSupabaseDbQuery, runSupabaseDbQueryJson } from "./db-cli";
import { LEGACY_HOSTED_DEMO_ORGANISATION } from "./legacy-hosted-demo";
import { buildFoundationStageAppendOnlyDeleteStatements } from "./tenant-retirement-policy";

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

export const LEGACY_REPLACEMENT_ISOLATION_MEMBER: LegacyReplacementFixtureMember =
  {
    userId: "d0000000-0000-0000-0000-000000000004",
    email: "qa-notification-isolation@lean-excellence.local",
    password: "IsolationFixture@004-QA-2026!",
    displayName: "QA Notification Isolation Member",
  };

export const LEGACY_REPLACEMENT_CROSS_ORG = {
  code: "qa-legacy-cross-org",
  name: "QA Legacy Cross Org",
} as const;

export const LEGACY_REPLACEMENT_ISOLATION_ORG = {
  code: "qa-notification-isolation-org",
  name: "QA Notification Isolation Org",
} as const;

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

function insertAppendOnlyAiUsageFixture(options: {
  databaseUrl: string;
  organisationId: string;
  membershipId: string;
  unitId: string;
  fixtureKey: string;
}) {
  const caseId = randomUUID();
  const sessionId = randomUUID();
  const runId = randomUUID();
  const usageEventId = randomUUID();
  const resourceId = caseId;

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      do $$
      begin
        insert into public.resource_records (
          id,
          organisation_id,
          resource_type,
          created_by_membership_id
        ) values (
          '${resourceId}'::uuid,
          '${options.organisationId}'::uuid,
          'problem_solving_case',
          '${options.membershipId}'::uuid
        );

        insert into public.problem_solving_cases (
          id,
          organisation_id,
          title,
          organisation_unit_id,
          owner_membership_id,
          created_by_membership_id,
          status
        ) values (
          '${caseId}'::uuid,
          '${options.organisationId}'::uuid,
          'QA append-only fixture case ${escapeSqlLiteral(options.fixtureKey)}',
          '${options.unitId}'::uuid,
          '${options.membershipId}'::uuid,
          '${options.membershipId}'::uuid,
          'draft'
        );

        insert into public.ai_sessions (
          id,
          organisation_id,
          problem_solving_case_id,
          created_by_membership_id,
          mode,
          status
        ) values (
          '${sessionId}'::uuid,
          '${options.organisationId}'::uuid,
          '${caseId}'::uuid,
          '${options.membershipId}'::uuid,
          'ask',
          'active'
        );

        insert into public.ai_runs (
          id,
          organisation_id,
          ai_session_id,
          requested_by_membership_id,
          provider,
          model,
          prompt_key,
          prompt_version,
          prompt_hash,
          status
        ) values (
          '${runId}'::uuid,
          '${options.organisationId}'::uuid,
          '${sessionId}'::uuid,
          '${options.membershipId}'::uuid,
          'openai',
          'gpt-test',
          'qa-fixture',
          '1',
          'qa-fixture-hash',
          'completed'
        );

        insert into public.ai_usage_events (
          id,
          organisation_id,
          membership_id,
          ai_session_id,
          ai_run_id,
          provider,
          model,
          input_tokens,
          output_tokens
        ) values (
          '${usageEventId}'::uuid,
          '${options.organisationId}'::uuid,
          '${options.membershipId}'::uuid,
          '${sessionId}'::uuid,
          '${runId}'::uuid,
          'openai',
          'gpt-test',
          12,
          8
        );
      end
      $$;
    `,
  });

  return { caseId, sessionId, runId, usageEventId };
}

function insertFoundationAuditFixture(options: {
  databaseUrl: string;
  organisationId: string;
  membershipId: string;
  userId: string;
  fixtureKey: string;
  resourceRecordId: string;
}) {
  const correlationId = randomUUID();

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      do $$
      begin
        insert into public.security_audit_events (
          organisation_id,
          actor_user_id,
          actor_membership_id,
          action,
          outcome,
          request_correlation_id
        ) values (
          '${options.organisationId}'::uuid,
          '${options.userId}'::uuid,
          '${options.membershipId}'::uuid,
          'qa.fixture.security_event',
          'succeeded',
          '${correlationId}'::uuid
        );

        insert into public.business_audit_events (
          organisation_id,
          actor_membership_id,
          resource_record_id,
          event_action,
          event_outcome,
          request_correlation_id
        ) values (
          '${options.organisationId}'::uuid,
          '${options.membershipId}'::uuid,
          '${options.resourceRecordId}'::uuid,
          'qa.fixture.business_event.${escapeSqlLiteral(options.fixtureKey)}',
          'succeeded',
          '${correlationId}'::uuid
        );
      end
      $$;
    `,
  });
}

function deleteFixtureModuleDataForOrganisationCodes(
  databaseUrl: string,
  organisationCodes: readonly string[],
) {
  if (organisationCodes.length === 0) {
    return;
  }

  const codeList = organisationCodes
    .map((code) => `'${escapeSqlLiteral(code)}'`)
    .join(", ");

  runSupabaseDbQuery({
    databaseUrl,
    sql: `
      do $$
      declare
        target_org_id uuid;
      begin
        for target_org_id in
          select id
          from public.organisations
          where code in (${codeList})
        loop
          alter table public.ai_usage_events
            disable trigger ai_usage_events_append_only;

          delete from public.ai_usage_events
          where organisation_id = target_org_id;

          alter table public.ai_usage_events
            enable trigger ai_usage_events_append_only;

          delete from public.ai_runs
          where organisation_id = target_org_id;

          delete from public.ai_sessions
          where organisation_id = target_org_id;

          delete from public.problem_solving_cases
          where organisation_id = target_org_id;

          delete from public.actions
          where organisation_id = target_org_id;
        end loop;
      end
      $$;
    `,
  });
}

function deleteFixtureFoundationDataForOrganisationCodes(
  databaseUrl: string,
  organisationCodes: readonly string[],
) {
  if (organisationCodes.length === 0) {
    return;
  }

  const codeList = organisationCodes
    .map((code) => `'${escapeSqlLiteral(code)}'`)
    .join(", ");

  runSupabaseDbQuery({
    databaseUrl,
    sql: `
      do $$
      declare
        target_org_id uuid;
      begin
        for target_org_id in
          select id
          from public.organisations
          where code in (${codeList})
        loop
${buildFoundationStageAppendOnlyDeleteStatements("target_org_id", { indent: "          " })}
${buildFoundationStageDependencyDeleteStatements("target_org_id", { indent: "          " })}
        end loop;
      end
      $$;
    `,
  });
}

function insertTenantOutboxWithPreCutoverSkip(options: {
  databaseUrl: string;
  organisationId: string;
  idempotencyKey: string;
}) {
  const eventId = randomUUID();
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
        '${eventId}'::uuid,
        '${options.organisationId}'::uuid,
        'qa.legacy_replacement.fixture',
        '{}'::jsonb,
        '${escapeSqlLiteral(options.idempotencyKey)}',
        'pending'
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      insert into private.notification_projector_pre_cutover_skips (
        organisation_id,
        event_id,
        event_type,
        event_created_at,
        skip_reason
      )
      select
        outbox_row.organisation_id,
        outbox_row.id,
        outbox_row.event_type,
        outbox_row.created_at,
        'pre_cutover_backlog'
      from private.domain_event_outbox outbox_row
      where outbox_row.organisation_id = '${options.organisationId}'::uuid
        and outbox_row.id = '${eventId}'::uuid;
    `,
  });

  return eventId;
}

export async function ensureLegacyReplacementFixtureMembers(
  admin: SupabaseClient,
) {
  const members = [
    ...LEGACY_REPLACEMENT_FIXTURE_MEMBERS,
    LEGACY_REPLACEMENT_ISOLATION_MEMBER,
  ];

  for (const member of members) {
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

  if (countLegacyOrganisationRows(options.databaseUrl) > 0) {
    executeLegacyHostedDemoModulePurgeSql(options.databaseUrl);
    executeDeleteLegacyHostedDemoOrganisationSql(options.databaseUrl);
  }

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from private.notification_projector_pre_cutover_skips skip_row
      where exists (
        select 1
        from private.domain_event_outbox outbox_row
        where outbox_row.organisation_id in (
          select id
          from public.organisations
          where code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
        )
          and outbox_row.organisation_id = skip_row.organisation_id
          and outbox_row.id = skip_row.event_id
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from private.domain_event_outbox
      where organisation_id in (
        select id
        from public.organisations
        where code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
      );
    `,
  });

  deleteFixtureModuleDataForOrganisationCodes(options.databaseUrl, [
    LEGACY_HOSTED_DEMO_ORGANISATION.code,
    LEGACY_REPLACEMENT_CROSS_ORG.code,
    LEGACY_REPLACEMENT_ISOLATION_ORG.code,
  ]);

  deleteFixtureFoundationDataForOrganisationCodes(options.databaseUrl, [
    LEGACY_HOSTED_DEMO_ORGANISATION.code,
    LEGACY_REPLACEMENT_CROSS_ORG.code,
    LEGACY_REPLACEMENT_ISOLATION_ORG.code,
  ]);

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisation_memberships
      where organisation_id in (
        select id
        from public.organisations
        where code in (
          '${orgCode}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
        )
           or id = '${orgId}'::uuid
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisation_unit_closure
      where organisation_id in (
        select id
        from public.organisations
        where code in (
          '${orgCode}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
        )
           or id = '${orgId}'::uuid
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisation_units
      where organisation_id in (
        select id
        from public.organisations
        where code in (
          '${orgCode}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
        )
           or id = '${orgId}'::uuid
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisations
      where code in (
        '${orgCode}',
        '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}',
        '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
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

  insertTenantOutboxWithPreCutoverSkip({
    databaseUrl: options.databaseUrl,
    organisationId: orgId,
    idempotencyKey: "qa-legacy-replacement-fixture",
  });

  insertAppendOnlyAiUsageFixture({
    databaseUrl: options.databaseUrl,
    organisationId: orgId,
    membershipId,
    unitId,
    fixtureKey: "legacy",
  });

  insertFoundationAuditFixture({
    databaseUrl: options.databaseUrl,
    organisationId: orgId,
    membershipId,
    userId: LEGACY_REPLACEMENT_FIXTURE_MEMBERS[0]!.userId,
    fixtureKey: "legacy",
    resourceRecordId: actionId,
  });

  const isolationOrgId = randomUUID();
  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      insert into public.organisations (
        id,
        code,
        name,
        status
      ) values (
        '${isolationOrgId}'::uuid,
        '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}',
        '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.name)}',
        'active'
      );
    `,
  });

  insertTenantOutboxWithPreCutoverSkip({
    databaseUrl: options.databaseUrl,
    organisationId: isolationOrgId,
    idempotencyKey: "qa-notification-isolation-org",
  });

  const isolationMembershipId = randomUUID();
  const isolationUnitId = randomUUID();
  const isolationActionId = randomUUID();
  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      do $$
      begin
        insert into public.organisation_units (
          id,
          organisation_id,
          code,
          name,
          unit_type,
          status
        ) values (
          '${isolationUnitId}'::uuid,
          '${isolationOrgId}'::uuid,
          'isolation-site',
          'Isolation Site',
          'plant',
          'active'
        );

        insert into public.organisation_memberships (
          id,
          organisation_id,
          user_id,
          status,
          display_name,
          activated_at
        ) values (
          '${isolationMembershipId}'::uuid,
          '${isolationOrgId}'::uuid,
          '${LEGACY_REPLACEMENT_ISOLATION_MEMBER.userId}'::uuid,
          'active',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_MEMBER.displayName)}',
          statement_timestamp()
        );

        insert into public.resource_records (
          id,
          organisation_id,
          resource_type,
          created_by_membership_id
        ) values (
          '${isolationActionId}'::uuid,
          '${isolationOrgId}'::uuid,
          'action',
          '${isolationMembershipId}'::uuid
        );

        insert into public.actions (
          id,
          organisation_id,
          title,
          created_by_membership_id
        ) values (
          '${isolationActionId}'::uuid,
          '${isolationOrgId}'::uuid,
          'Isolation fixture action',
          '${isolationMembershipId}'::uuid
        );
      end
      $$;
    `,
  });

  insertAppendOnlyAiUsageFixture({
    databaseUrl: options.databaseUrl,
    organisationId: isolationOrgId,
    membershipId: isolationMembershipId,
    unitId: isolationUnitId,
    fixtureKey: "isolation",
  });

  insertFoundationAuditFixture({
    databaseUrl: options.databaseUrl,
    organisationId: isolationOrgId,
    membershipId: isolationMembershipId,
    userId: LEGACY_REPLACEMENT_ISOLATION_MEMBER.userId,
    fixtureKey: "isolation",
    resourceRecordId: isolationActionId,
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
    isolationOrganisationId: isolationOrgId,
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
    executeLegacyHostedDemoModulePurgeSql(options.databaseUrl);
    executeDeleteLegacyHostedDemoOrganisationSql(options.databaseUrl);
  }

  deleteFixtureModuleDataForOrganisationCodes(options.databaseUrl, [
    LEGACY_REPLACEMENT_CROSS_ORG.code,
    LEGACY_REPLACEMENT_ISOLATION_ORG.code,
  ]);

  deleteFixtureFoundationDataForOrganisationCodes(options.databaseUrl, [
    LEGACY_REPLACEMENT_CROSS_ORG.code,
    LEGACY_REPLACEMENT_ISOLATION_ORG.code,
  ]);

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisation_memberships
      where organisation_id in (
        select id
        from public.organisations
        where code in (
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
        )
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from private.notification_projector_pre_cutover_skips skip_row
      where exists (
        select 1
        from private.domain_event_outbox outbox_row
        where outbox_row.organisation_id in (
          select id
          from public.organisations
          where code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
        )
          and outbox_row.organisation_id = skip_row.organisation_id
          and outbox_row.id = skip_row.event_id
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from private.domain_event_outbox
      where organisation_id in (
        select id
        from public.organisations
        where code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisation_unit_closure
      where organisation_id in (
        select id
        from public.organisations
        where code in (
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
        )
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisation_units
      where organisation_id in (
        select id
        from public.organisations
        where code in (
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}',
          '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
        )
      );
    `,
  });

  runSupabaseDbQuery({
    databaseUrl: options.databaseUrl,
    sql: `
      delete from public.organisations
      where code in (
        '${escapeSqlLiteral(LEGACY_REPLACEMENT_CROSS_ORG.code)}',
        '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
      )
         or id = '${orgId}'::uuid
         or code = '${orgCode}';
    `,
  });

  purgeAuthUserIdentityPrerequisites(
    options.databaseUrl,
    [
      ...LEGACY_REPLACEMENT_FIXTURE_MEMBERS,
      LEGACY_REPLACEMENT_ISOLATION_MEMBER,
    ].map((member) => member.userId),
  );

  for (const member of [
    ...LEGACY_REPLACEMENT_FIXTURE_MEMBERS,
    LEGACY_REPLACEMENT_ISOLATION_MEMBER,
  ]) {
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
    pre_cutover_skips: number;
    storage_objects: number;
    isolation_outbox: number;
    isolation_pre_cutover_skips: number;
    ai_usage_events: number;
    isolation_ai_usage_events: number;
    security_audit_events: number;
    business_audit_events: number;
    business_audit_events_with_resource: number;
    resource_records: number;
    isolation_security_audit_events: number;
    isolation_business_audit_events: number;
    isolation_business_audit_events_with_resource: number;
    isolation_resource_records: number;
  }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select
        (select count(*)::int from public.organisations where id = '${orgId}'::uuid) as organisations,
        (select count(*)::int from public.organisation_memberships where organisation_id = '${orgId}'::uuid) as memberships,
        (select count(*)::int from public.actions where organisation_id = '${orgId}'::uuid) as actions,
        (select count(*)::int from private.domain_event_outbox where organisation_id = '${orgId}'::uuid) as outbox,
        (select count(*)::int
         from private.notification_projector_pre_cutover_skips skip_row
         where exists (
           select 1
           from private.domain_event_outbox outbox_row
           where outbox_row.organisation_id = '${orgId}'::uuid
             and outbox_row.organisation_id = skip_row.organisation_id
             and outbox_row.id = skip_row.event_id
         )) as pre_cutover_skips,
        (select count(*)::int from storage.objects where bucket_id = '${COOKIEWORKS_STORAGE_BUCKET}' and name like '${orgId}/%') as storage_objects,
        (select count(*)::int
         from private.domain_event_outbox outbox_row
         join public.organisations organisation_row
           on organisation_row.id = outbox_row.organisation_id
         where organisation_row.code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}') as isolation_outbox,
        (select count(*)::int
         from private.notification_projector_pre_cutover_skips skip_row
         where exists (
           select 1
           from private.domain_event_outbox outbox_row
           join public.organisations organisation_row
             on organisation_row.id = outbox_row.organisation_id
           where organisation_row.code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
             and outbox_row.organisation_id = skip_row.organisation_id
             and outbox_row.id = skip_row.event_id
         )) as isolation_pre_cutover_skips,
        (select count(*)::int from public.ai_usage_events where organisation_id = '${orgId}'::uuid) as ai_usage_events,
        (select count(*)::int
         from public.ai_usage_events usage_row
         join public.organisations organisation_row
           on organisation_row.id = usage_row.organisation_id
         where organisation_row.code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}') as isolation_ai_usage_events,
        (select count(*)::int from public.security_audit_events where organisation_id = '${orgId}'::uuid) as security_audit_events,
        (select count(*)::int from public.business_audit_events where organisation_id = '${orgId}'::uuid) as business_audit_events,
        (select count(*)::int
         from public.business_audit_events
         where organisation_id = '${orgId}'::uuid
           and resource_record_id is not null) as business_audit_events_with_resource,
        (select count(*)::int from public.resource_records where organisation_id = '${orgId}'::uuid) as resource_records,
        (select count(*)::int
         from public.security_audit_events audit_row
         join public.organisations organisation_row
           on organisation_row.id = audit_row.organisation_id
         where organisation_row.code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}') as isolation_security_audit_events,
        (select count(*)::int
         from public.business_audit_events audit_row
         join public.organisations organisation_row
           on organisation_row.id = audit_row.organisation_id
         where organisation_row.code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}') as isolation_business_audit_events,
        (select count(*)::int
         from public.business_audit_events audit_row
         join public.organisations organisation_row
           on organisation_row.id = audit_row.organisation_id
         where organisation_row.code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}'
           and audit_row.resource_record_id is not null) as isolation_business_audit_events_with_resource,
        (select count(*)::int
         from public.resource_records resource_row
         join public.organisations organisation_row
           on organisation_row.id = resource_row.organisation_id
         where organisation_row.code = '${escapeSqlLiteral(LEGACY_REPLACEMENT_ISOLATION_ORG.code)}') as isolation_resource_records;
    `,
  });

  return (
    rows[0] ?? {
      organisations: 0,
      memberships: 0,
      actions: 0,
      outbox: 0,
      pre_cutover_skips: 0,
      storage_objects: 0,
      isolation_outbox: 0,
      isolation_pre_cutover_skips: 0,
      ai_usage_events: 0,
      isolation_ai_usage_events: 0,
      security_audit_events: 0,
      business_audit_events: 0,
      business_audit_events_with_resource: 0,
      resource_records: 0,
      isolation_security_audit_events: 0,
      isolation_business_audit_events: 0,
      isolation_business_audit_events_with_resource: 0,
      isolation_resource_records: 0,
    }
  );
}
