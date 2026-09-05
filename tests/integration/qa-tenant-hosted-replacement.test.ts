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
import { purgeCookieWorksTenantModules } from "../../scripts/qa-tenant/delete-tenant";
import { seedCookieWorksFoundation } from "../../scripts/qa-tenant/foundation-seed";
import { buildHostedReplacementPlan } from "../../scripts/qa-tenant/hosted-replacement";
import {
  cleanupLegacyReplacementFixture,
  countLegacyOrganisationRows,
  LEGACY_REPLACEMENT_FIXTURE_MEMBERS,
  seedLegacyReplacementFixture,
  snapshotLegacyFixtureState,
} from "../../scripts/qa-tenant/legacy-replacement-fixture";
import { loadLocalSupabaseEnv } from "../../scripts/qa-tenant/local-env";
import { collectTenantInventory } from "../../scripts/qa-tenant/tenant-inventory";
import {
  assertCookieWorksCompleteFoundationVerified,
  HOSTED_REPLACEMENT_VERIFIED_MARKER,
} from "../../scripts/qa-tenant/verification";

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

describe.skipIf(!hasLocalSupabase || shouldSkipLegacyReplacementIntegration)(
  "hosted legacy → CookieWorks replacement integration",
  () => {
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
  },
);
