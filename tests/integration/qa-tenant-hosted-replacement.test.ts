// @vitest-environment node
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { QA_ORGANISATION_CODE } from "../../scripts/qa-tenant/constants";
import {
  assertLegacyAuthUsersIsolated,
  captureLegacyDeletionContext,
  deleteLegacyHostedDemoTenant,
} from "../../scripts/qa-tenant/delete-legacy-hosted-demo";
import { executeDeleteLegacyHostedDemoOrganisationSql } from "../../scripts/qa-tenant/delete-legacy-hosted-demo";
import {
  executeLegacyHostedDemoModulePurgeSql,
  purgeCookieWorksTenantModules,
} from "../../scripts/qa-tenant/delete-tenant";
import {
  SupabaseDbQueryError,
  runSupabaseDbQuery,
  runSupabaseDbQueryJson,
} from "../../scripts/qa-tenant/db-cli";
import { seedCookieWorksFoundation } from "../../scripts/qa-tenant/foundation-seed";
import { buildHostedReplacementPlan } from "../../scripts/qa-tenant/hosted-replacement";
import { LEGACY_HOSTED_DEMO_ORGANISATION } from "../../scripts/qa-tenant/legacy-hosted-demo";
import {
  cleanupLegacyReplacementFixture,
  countLegacyOrganisationRows,
  LEGACY_REPLACEMENT_FIXTURE_MEMBERS,
  LEGACY_REPLACEMENT_ISOLATION_ORG,
  seedLegacyReplacementFixture,
  snapshotLegacyFixtureState,
} from "../../scripts/qa-tenant/legacy-replacement-fixture";
import { loadLocalSupabaseEnv } from "../../scripts/qa-tenant/local-env";
import {
  endIntegrationTest,
  runIntegrationPhase,
  startIntegrationTest,
} from "../../scripts/qa-tenant/integration-phase-log";
import { buildTenantPrivateInfrastructureCountSql } from "../../scripts/qa-tenant/private-infrastructure-purge";
import { collectTenantInventory } from "../../scripts/qa-tenant/tenant-inventory";
import {
  assertCookieWorksCompleteFoundationVerified,
  HOSTED_LEGACY_RECOVERY_VERIFIED_MARKER,
  HOSTED_REPLACEMENT_VERIFIED_MARKER,
} from "../../scripts/qa-tenant/verification";

function queryPrivateInfrastructureCounts(
  databaseUrl: string,
  organisationId: string,
) {
  const rows = runSupabaseDbQueryJson<{
    notification_delivery_provider_envelopes: number;
    notification_delivery_ledger: number;
    domain_event_outbox: number;
    notification_projector_pre_cutover_skips: number;
    session_organisation_contexts: number;
  }>({
    databaseUrl,
    outputFormat: "json",
    sql: buildTenantPrivateInfrastructureCountSql(organisationId),
  });

  return rows[0]!;
}

function isLocalSupabaseAvailable() {
  if (process.env.LEANHUB_FORCE_LEGACY_REPLACEMENT_INTEGRATION === "1") {
    return true;
  }

  try {
    execFileSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      timeout: 15_000,
    });
    return true;
  } catch {
    return false;
  }
}

const shouldSkipLegacyReplacementIntegration =
  process.env.LEANHUB_SKIP_LEGACY_REPLACEMENT_INTEGRATION === "1";

const hasLocalSupabase = isLocalSupabaseAvailable();
const LOCAL_FIXTURE_MEMBERSHIPS = LEGACY_REPLACEMENT_FIXTURE_MEMBERS.length;

describe
  .skipIf(!hasLocalSupabase || shouldSkipLegacyReplacementIntegration)
  .sequential("hosted legacy → CookieWorks replacement integration", () => {
    let env: ReturnType<typeof loadLocalSupabaseEnv>;
    let admin: ReturnType<typeof createClient>;

    beforeAll(() => {
      process.env.LEANHUB_ALLOW_QA_TENANT = "1";
      process.env.LEANHUB_QA_DB_LOCAL = "1";
      env = loadLocalSupabaseEnv("qa:cookie:seed");
      admin = createClient(env.apiUrl, env.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }, 180_000);

    afterAll(async () => {
      await runIntegrationPhase("suite cleanup: CookieWorks module purge", () =>
        purgeCookieWorksTenantModules(env.databaseUrl, {
          storageAdmin: admin,
        }),
      );
      await runIntegrationPhase("suite cleanup: legacy replacement fixture", () =>
        cleanupLegacyReplacementFixture({
          admin,
          databaseUrl: env.databaseUrl,
        }),
      );
    }, 180_000);

    it("dry-run leaves the legacy fixture unchanged", async () => {
      startIntegrationTest("dry-run leaves the legacy fixture unchanged");

      await runIntegrationPhase("fixture cleanup", () =>
        cleanupLegacyReplacementFixture({
          admin,
          databaseUrl: env.databaseUrl,
        }),
      );
      await runIntegrationPhase("fixture seed", () =>
        seedLegacyReplacementFixture({
          admin,
          databaseUrl: env.databaseUrl,
        }),
      );

      const before = await runIntegrationPhase(
        "snapshot before dry-run",
        async () => snapshotLegacyFixtureState(env.databaseUrl),
      );
      await runIntegrationPhase("hosted replacement dry-run plan", async () => {
        buildHostedReplacementPlan({
          databaseUrl: env.databaseUrl,
          mode: "dry-run",
          projectRef: "local",
        });
      });
      const after = await runIntegrationPhase(
        "snapshot after dry-run",
        async () => snapshotLegacyFixtureState(env.databaseUrl),
      );

      expect(after).toEqual(before);
      expect(before.organisations).toBe(1);
      expect(before.memberships).toBe(LOCAL_FIXTURE_MEMBERSHIPS);
      expect(before.actions).toBeGreaterThan(0);
      expect(before.outbox).toBeGreaterThan(0);
      expect(before.pre_cutover_skips).toBeGreaterThan(0);
      expect(before.storage_objects).toBeGreaterThan(0);
      expect(before.ai_usage_events).toBeGreaterThan(0);
      expect(before.security_audit_events).toBeGreaterThan(0);
      expect(before.business_audit_events).toBeGreaterThan(0);

      endIntegrationTest();
    }, 180_000);

    it("replaces the legacy tenant with CookieWorks foundation-only state", async () => {
      startIntegrationTest(
        "replaces the legacy tenant with CookieWorks foundation-only state",
      );

      await runIntegrationPhase("fixture cleanup", () =>
        cleanupLegacyReplacementFixture({
          admin,
          databaseUrl: env.databaseUrl,
        }),
      );
      await runIntegrationPhase("fixture seed", () =>
        seedLegacyReplacementFixture({
          admin,
          databaseUrl: env.databaseUrl,
        }),
      );

      const deletionContext = await runIntegrationPhase(
        "legacy deletion context capture",
        async () =>
          captureLegacyDeletionContext(env.databaseUrl, {
            expectedMemberships: LOCAL_FIXTURE_MEMBERSHIPS,
          }),
      );

      const deletionResult = await runIntegrationPhase(
        "legacy hosted demo tenant deletion",
        async () =>
          deleteLegacyHostedDemoTenant({
            databaseUrl: env.databaseUrl,
            storageAdmin: admin,
            authAdmin: admin,
            deletionContext,
            expectedMemberships: LOCAL_FIXTURE_MEMBERSHIPS,
          }),
      );

      expect(countLegacyOrganisationRows(env.databaseUrl)).toBe(0);
      expect(deletionResult.deletedAuthUserIds).toEqual(
        deletionContext.deletableAuthUserIds,
      );

      for (const userId of deletionContext.deletableAuthUserIds) {
        const existing = await admin.auth.admin.getUserById(userId);
        expect(existing.data.user).toBeNull();
      }

      await runIntegrationPhase("CookieWorks foundation seed", () =>
        seedCookieWorksFoundation({
          admin,
          apiUrl: env.apiUrl,
          publishableKey: env.publishableKey,
          databaseUrl: env.databaseUrl,
        }),
      );

      const verification = await runIntegrationPhase(
        "CookieWorks foundation verification",
        async () =>
          assertCookieWorksCompleteFoundationVerified(env.databaseUrl, admin),
      );

      expect(verification.membershipCount).toBe(7);
      expect(verification.unitCount).toBe(10);
      expect(verification.roleGrantCount).toBe(7);
      expect(verification.verification.isFoundationOnly).toBe(true);
      expect(HOSTED_REPLACEMENT_VERIFIED_MARKER).toContain("COOKIEWORKS");
      expect(
        collectTenantInventory(env.databaseUrl, QA_ORGANISATION_CODE)
          .organisation?.code,
      ).toBe(QA_ORGANISATION_CODE);

      endIntegrationTest();
    }, 300_000);

    it("aborts destructive replacement when a legacy member belongs to another organisation", async () => {
      startIntegrationTest(
        "aborts destructive replacement when a legacy member belongs to another organisation",
      );
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });
      await seedLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
        includeCrossOrgMember: true,
      });

      expect(() => assertLegacyAuthUsersIsolated(env.databaseUrl)).toThrow(
        /auth isolation failed/i,
      );
      expect(() =>
        captureLegacyDeletionContext(env.databaseUrl, {
          expectedMemberships: LOCAL_FIXTURE_MEMBERSHIPS,
        }),
      ).toThrow(/auth isolation failed/i);
      expect(countLegacyOrganisationRows(env.databaseUrl)).toBeGreaterThan(0);
      endIntegrationTest();
    }, 180_000);

    it("purges legacy outbox dependents while preserving unrelated notification rows", async () => {
      startIntegrationTest(
        "purges legacy outbox dependents while preserving unrelated notification rows",
      );
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });
      const fixture = await seedLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });

      const before = snapshotLegacyFixtureState(env.databaseUrl);
      expect(before.pre_cutover_skips).toBeGreaterThan(0);
      expect(before.isolation_pre_cutover_skips).toBeGreaterThan(0);

      executeLegacyHostedDemoModulePurgeSql(env.databaseUrl);

      const legacyCounts = queryPrivateInfrastructureCounts(
        env.databaseUrl,
        fixture.organisationId,
      );
      expect(legacyCounts.domain_event_outbox).toBe(0);
      expect(legacyCounts.notification_projector_pre_cutover_skips).toBe(0);

      const legacyUsageRows = runSupabaseDbQueryJson<{ count: number }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select count(*)::int as count
          from public.ai_usage_events
          where organisation_id = '${fixture.organisationId}'::uuid;
        `,
      });
      expect(legacyUsageRows[0]?.count).toBe(0);

      const isolationCounts = queryPrivateInfrastructureCounts(
        env.databaseUrl,
        fixture.isolationOrganisationId,
      );
      expect(isolationCounts.domain_event_outbox).toBeGreaterThan(0);
      expect(
        isolationCounts.notification_projector_pre_cutover_skips,
      ).toBeGreaterThan(0);

      const isolationUsageRows = runSupabaseDbQueryJson<{ count: number }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select count(*)::int as count
          from public.ai_usage_events
          where organisation_id = '${fixture.isolationOrganisationId}'::uuid;
        `,
      });
      expect(isolationUsageRows[0]?.count ?? 0).toBeGreaterThan(0);
      endIntegrationTest();
    }, 180_000);

    it("preserves foundation audit ledgers and deferred resource_records through module purge then removes them during foundation deletion", async () => {
      startIntegrationTest(
        "preserves foundation audit ledgers and deferred resource_records through module purge then removes them during foundation deletion",
      );
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });
      const fixture = await seedLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });

      const before = snapshotLegacyFixtureState(env.databaseUrl);
      expect(before.resource_records).toBeGreaterThan(0);
      expect(before.business_audit_events).toBeGreaterThan(0);
      expect(before.business_audit_events_with_resource).toBeGreaterThan(0);
      expect(before.security_audit_events).toBeGreaterThan(0);
      expect(before.isolation_resource_records).toBeGreaterThan(0);
      expect(before.isolation_business_audit_events).toBeGreaterThan(0);
      expect(
        before.isolation_business_audit_events_with_resource,
      ).toBeGreaterThan(0);
      expect(before.isolation_security_audit_events).toBeGreaterThan(0);
      expect(before.ai_usage_events).toBeGreaterThan(0);
      expect(before.actions).toBeGreaterThan(0);

      await runIntegrationPhase("legacy module purge", async () => {
        executeLegacyHostedDemoModulePurgeSql(env.databaseUrl);
      });

      const afterModulePurge = runSupabaseDbQueryJson<{
        actions: number;
        ai_usage_events: number;
        security_audit_events: number;
        business_audit_events: number;
        business_audit_events_with_resource: number;
        resource_records: number;
        organisations: number;
        isolation_ai_usage_events: number;
        isolation_security_audit_events: number;
        isolation_business_audit_events: number;
        isolation_business_audit_events_with_resource: number;
        isolation_resource_records: number;
      }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select
            (select count(*)::int from public.actions where organisation_id = '${fixture.organisationId}'::uuid) as actions,
            (select count(*)::int from public.ai_usage_events where organisation_id = '${fixture.organisationId}'::uuid) as ai_usage_events,
            (select count(*)::int from public.security_audit_events where organisation_id = '${fixture.organisationId}'::uuid) as security_audit_events,
            (select count(*)::int from public.business_audit_events where organisation_id = '${fixture.organisationId}'::uuid) as business_audit_events,
            (select count(*)::int
             from public.business_audit_events
             where organisation_id = '${fixture.organisationId}'::uuid
               and resource_record_id is not null) as business_audit_events_with_resource,
            (select count(*)::int from public.resource_records where organisation_id = '${fixture.organisationId}'::uuid) as resource_records,
            (select count(*)::int from public.organisations where id = '${fixture.organisationId}'::uuid) as organisations,
            (select count(*)::int from public.ai_usage_events where organisation_id = '${fixture.isolationOrganisationId}'::uuid) as isolation_ai_usage_events,
            (select count(*)::int from public.security_audit_events where organisation_id = '${fixture.isolationOrganisationId}'::uuid) as isolation_security_audit_events,
            (select count(*)::int from public.business_audit_events where organisation_id = '${fixture.isolationOrganisationId}'::uuid) as isolation_business_audit_events,
            (select count(*)::int
             from public.business_audit_events
             where organisation_id = '${fixture.isolationOrganisationId}'::uuid
               and resource_record_id is not null) as isolation_business_audit_events_with_resource,
            (select count(*)::int from public.resource_records where organisation_id = '${fixture.isolationOrganisationId}'::uuid) as isolation_resource_records;
        `,
      })[0]!;

      expect(afterModulePurge.actions).toBe(0);
      expect(afterModulePurge.ai_usage_events).toBe(0);
      expect(afterModulePurge.security_audit_events).toBeGreaterThan(0);
      expect(afterModulePurge.business_audit_events).toBeGreaterThan(0);
      expect(
        afterModulePurge.business_audit_events_with_resource,
      ).toBeGreaterThan(0);
      expect(afterModulePurge.resource_records).toBeGreaterThan(0);
      expect(afterModulePurge.organisations).toBe(1);
      expect(afterModulePurge.isolation_ai_usage_events).toBeGreaterThan(0);
      expect(afterModulePurge.isolation_security_audit_events).toBe(
        before.isolation_security_audit_events,
      );
      expect(afterModulePurge.isolation_business_audit_events).toBe(
        before.isolation_business_audit_events,
      );
      expect(
        afterModulePurge.isolation_business_audit_events_with_resource,
      ).toBe(before.isolation_business_audit_events_with_resource);
      expect(afterModulePurge.isolation_resource_records).toBe(
        before.isolation_resource_records,
      );

      await runIntegrationPhase("legacy foundation deletion", async () => {
        executeDeleteLegacyHostedDemoOrganisationSql(env.databaseUrl);
      });

      const afterFoundationDeletion = runSupabaseDbQueryJson<{
        security_audit_events: number;
        business_audit_events: number;
        resource_records: number;
        organisations: number;
        isolation_security_audit_events: number;
        isolation_business_audit_events: number;
        isolation_resource_records: number;
      }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select
            (select count(*)::int from public.security_audit_events where organisation_id = '${fixture.organisationId}'::uuid) as security_audit_events,
            (select count(*)::int from public.business_audit_events where organisation_id = '${fixture.organisationId}'::uuid) as business_audit_events,
            (select count(*)::int from public.resource_records where organisation_id = '${fixture.organisationId}'::uuid) as resource_records,
            (select count(*)::int from public.organisations where id = '${fixture.organisationId}'::uuid) as organisations,
            (select count(*)::int from public.security_audit_events where organisation_id = '${fixture.isolationOrganisationId}'::uuid) as isolation_security_audit_events,
            (select count(*)::int from public.business_audit_events where organisation_id = '${fixture.isolationOrganisationId}'::uuid) as isolation_business_audit_events,
            (select count(*)::int from public.resource_records where organisation_id = '${fixture.isolationOrganisationId}'::uuid) as isolation_resource_records;
        `,
      })[0]!;

      expect(afterFoundationDeletion.security_audit_events).toBe(0);
      expect(afterFoundationDeletion.business_audit_events).toBe(0);
      expect(afterFoundationDeletion.resource_records).toBe(0);
      expect(afterFoundationDeletion.organisations).toBe(0);
      expect(afterFoundationDeletion.isolation_security_audit_events).toBe(
        before.isolation_security_audit_events,
      );
      expect(afterFoundationDeletion.isolation_business_audit_events).toBe(
        before.isolation_business_audit_events,
      );
      expect(afterFoundationDeletion.isolation_resource_records).toBe(
        before.isolation_resource_records,
      );

      endIntegrationTest();
    }, 180_000);

    it("fails closed when generic delete is attempted against ai_usage_events", async () => {
      startIntegrationTest(
        "fails closed when generic delete is attempted against ai_usage_events",
      );
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });
      const fixture = await seedLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });

      expect(() =>
        runSupabaseDbQuery({
          databaseUrl: env.databaseUrl,
          sql: `
            delete from public.ai_usage_events
            where organisation_id = '${fixture.organisationId}'::uuid;
          `,
        }),
      ).toThrow(SupabaseDbQueryError);

      const remaining = runSupabaseDbQueryJson<{ count: number }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select count(*)::int as count
          from public.ai_usage_events
          where organisation_id = '${fixture.organisationId}'::uuid;
        `,
      });
      expect(remaining[0]?.count).toBeGreaterThan(0);
      endIntegrationTest();
    }, 180_000);

    it("aborts full module purge before mutation when an unclassified append-only table exists", async () => {
      startIntegrationTest(
        "aborts full module purge before mutation when an unclassified append-only table exists",
      );
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });
      await seedLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });

      const before = snapshotLegacyFixtureState(env.databaseUrl);

      runSupabaseDbQuery({
        databaseUrl: env.databaseUrl,
        sql: `
          do $$
          begin
            execute '
              create table if not exists public.qa_tenant_retirement_unknown_fixture (
                id uuid primary key default gen_random_uuid(),
                organisation_id uuid not null references public.organisations(id) on delete restrict,
                note text not null default ''qa fixture''
              )';

            execute '
              drop trigger if exists qa_tenant_retirement_unknown_fixture_prevent_delete
                on public.qa_tenant_retirement_unknown_fixture';

            execute '
              create trigger qa_tenant_retirement_unknown_fixture_prevent_delete
              before delete on public.qa_tenant_retirement_unknown_fixture
              for each row execute function private.prevent_update_or_delete()';
          end
          $$;
        `,
      });

      try {
        expect(() =>
          executeLegacyHostedDemoModulePurgeSql(env.databaseUrl),
        ).toThrow(SupabaseDbQueryError);

        const after = snapshotLegacyFixtureState(env.databaseUrl);
        expect(after).toEqual(before);
      } finally {
        runSupabaseDbQuery({
          databaseUrl: env.databaseUrl,
          sql: `
            drop table if exists public.qa_tenant_retirement_unknown_fixture cascade;
          `,
        });
      }

      endIntegrationTest();
    }, 180_000);

    it("rolls back tenant module purge mutations when outbox is deleted before dependents", async () => {
      startIntegrationTest(
        "rolls back tenant module purge mutations when outbox is deleted before dependents",
      );
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });
      await seedLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });

      const before = snapshotLegacyFixtureState(env.databaseUrl);

      expect(() =>
        runSupabaseDbQuery({
          databaseUrl: env.databaseUrl,
          sql: `
            do $$
            declare
              target_org_id uuid := '${LEGACY_HOSTED_DEMO_ORGANISATION.id}'::uuid;
            begin
              delete from private.domain_event_outbox
              where organisation_id = target_org_id;
            end
            $$;
          `,
        }),
      ).toThrow(SupabaseDbQueryError);

      const after = snapshotLegacyFixtureState(env.databaseUrl);
      expect(after).toEqual(before);
      endIntegrationTest();
    }, 180_000);

    it("recovers legacy tenant while preserving verified CookieWorks and unrelated notification rows", async () => {
      startIntegrationTest(
        "recovers legacy tenant while preserving verified CookieWorks and unrelated notification rows",
      );
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });

      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const cookieWorksBefore =
        await assertCookieWorksCompleteFoundationVerified(
          env.databaseUrl,
          admin,
        );

      const fixture = await seedLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });

      const deletionContext = captureLegacyDeletionContext(env.databaseUrl, {
        expectedMemberships: LOCAL_FIXTURE_MEMBERSHIPS,
      });

      await deleteLegacyHostedDemoTenant({
        databaseUrl: env.databaseUrl,
        storageAdmin: admin,
        authAdmin: admin,
        deletionContext,
        expectedMemberships: LOCAL_FIXTURE_MEMBERSHIPS,
      });

      const cookieWorksAfter =
        await assertCookieWorksCompleteFoundationVerified(
          env.databaseUrl,
          admin,
        );

      expect(cookieWorksAfter.organisation.id).toBe(
        cookieWorksBefore.organisation.id,
      );
      expect(cookieWorksAfter.membershipCount).toBe(7);
      expect(cookieWorksAfter.unitCount).toBe(10);
      expect(cookieWorksAfter.roleGrantCount).toBe(7);
      expect(cookieWorksAfter.verification.isFoundationOnly).toBe(true);
      expect(
        collectTenantInventory(env.databaseUrl, QA_ORGANISATION_CODE)
          .organisation?.id,
      ).toBe(cookieWorksBefore.organisation.id);
      expect(HOSTED_LEGACY_RECOVERY_VERIFIED_MARKER).toContain("COOKIEWORKS");

      const isolationCounts = queryPrivateInfrastructureCounts(
        env.databaseUrl,
        fixture.isolationOrganisationId,
      );
      expect(isolationCounts.domain_event_outbox).toBeGreaterThan(0);
      expect(
        isolationCounts.notification_projector_pre_cutover_skips,
      ).toBeGreaterThan(0);
      expect(
        collectTenantInventory(
          env.databaseUrl,
          LEGACY_REPLACEMENT_ISOLATION_ORG.code,
        ).organisation?.code,
      ).toBe(LEGACY_REPLACEMENT_ISOLATION_ORG.code);

      endIntegrationTest();
    }, 300_000);
  });
