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
import {
  executePurgeTenantModuleDataSql,
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
  try {
    execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
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
      env = loadLocalSupabaseEnv("qa:cookie:seed");
      admin = createClient(env.apiUrl, env.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }, 180_000);

    afterAll(async () => {
      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });
    }, 180_000);

    it("dry-run leaves the legacy fixture unchanged", async () => {
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });
      await seedLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });

      const before = snapshotLegacyFixtureState(env.databaseUrl);
      buildHostedReplacementPlan({
        databaseUrl: env.databaseUrl,
        mode: "dry-run",
        projectRef: "local",
      });
      const after = snapshotLegacyFixtureState(env.databaseUrl);

      expect(after).toEqual(before);
      expect(before.organisations).toBe(1);
      expect(before.memberships).toBe(LOCAL_FIXTURE_MEMBERSHIPS);
      expect(before.actions).toBeGreaterThan(0);
      expect(before.outbox).toBeGreaterThan(0);
      expect(before.pre_cutover_skips).toBeGreaterThan(0);
      expect(before.storage_objects).toBeGreaterThan(0);
    }, 180_000);

    it("replaces the legacy tenant with CookieWorks foundation-only state", async () => {
      await cleanupLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });
      await seedLegacyReplacementFixture({
        admin,
        databaseUrl: env.databaseUrl,
      });

      const deletionContext = captureLegacyDeletionContext(env.databaseUrl, {
        expectedMemberships: LOCAL_FIXTURE_MEMBERSHIPS,
      });

      const deletionResult = await deleteLegacyHostedDemoTenant({
        databaseUrl: env.databaseUrl,
        storageAdmin: admin,
        authAdmin: admin,
        deletionContext,
        expectedMemberships: LOCAL_FIXTURE_MEMBERSHIPS,
      });

      expect(countLegacyOrganisationRows(env.databaseUrl)).toBe(0);
      expect(deletionResult.deletedAuthUserIds).toEqual(
        deletionContext.deletableAuthUserIds,
      );

      for (const userId of deletionContext.deletableAuthUserIds) {
        const existing = await admin.auth.admin.getUserById(userId);
        expect(existing.data.user).toBeNull();
      }

      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const verification = await assertCookieWorksCompleteFoundationVerified(
        env.databaseUrl,
        admin,
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
    }, 300_000);

    it("aborts destructive replacement when a legacy member belongs to another organisation", async () => {
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
    }, 180_000);

    it("purges legacy outbox dependents while preserving unrelated notification rows", async () => {
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

      executePurgeTenantModuleDataSql(
        env.databaseUrl,
        LEGACY_HOSTED_DEMO_ORGANISATION.code,
      );

      const legacyCounts = queryPrivateInfrastructureCounts(
        env.databaseUrl,
        fixture.organisationId,
      );
      expect(legacyCounts.domain_event_outbox).toBe(0);
      expect(legacyCounts.notification_projector_pre_cutover_skips).toBe(0);

      const isolationCounts = queryPrivateInfrastructureCounts(
        env.databaseUrl,
        fixture.isolationOrganisationId,
      );
      expect(isolationCounts.domain_event_outbox).toBeGreaterThan(0);
      expect(
        isolationCounts.notification_projector_pre_cutover_skips,
      ).toBeGreaterThan(0);
    }, 180_000);

    it("rolls back tenant module purge mutations when outbox is deleted before dependents", async () => {
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
    }, 180_000);

    it("recovers legacy tenant while preserving verified CookieWorks and unrelated notification rows", async () => {
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
    }, 300_000);
  });
