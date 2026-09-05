// @vitest-environment node
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";
import {
  QA_ORGANISATION,
  QA_UNITS,
  QA_USERS,
} from "../../scripts/qa-tenant/constants";
import {
  assertCookieWorksResetVerified,
  purgeCookieWorksTenantModules,
} from "../../scripts/qa-tenant/delete-tenant";
import { seedCookieWorksFoundation } from "../../scripts/qa-tenant/foundation-seed";
import {
  ensureIsolationCanaryTenant,
  QA_ISOLATION_ORGANISATION,
  seedIsolationCanaryModuleRecord,
} from "../../scripts/qa-tenant/isolation-canary";
import {
  collectCookieWorksInventory,
  isFoundationOnlyInventory,
} from "../../scripts/qa-tenant/inventory";
import { loadLocalSupabaseEnv } from "../../scripts/qa-tenant/local-env";
import {
  assertModuleFixturesPresent,
  collectCookieWorksModuleFixtureSnapshot,
  seedCookieWorksModuleFixtures,
} from "../../scripts/qa-tenant/module-fixtures";
import { signInUser } from "../../scripts/qa-tenant/shared/auth";
import { countCookieWorksStorageObjects } from "../../scripts/qa-tenant/storage-cleanup";
import { countOrganisationModuleRows } from "../../scripts/qa-tenant/verification";

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

const hasLocalSupabase = isLocalSupabaseAvailable();

function countOrganisationMaturityModels(
  databaseUrl: string,
  organisationCode: string,
) {
  return countOrganisationModuleRows(
    databaseUrl,
    organisationCode,
    "maturity_models",
  );
}

describe.skipIf(!hasLocalSupabase)(
  "CookieWorks QA tenant harness integration",
  () => {
    let env: ReturnType<typeof loadLocalSupabaseEnv>;
    let admin: ReturnType<typeof createClient>;

    beforeAll(() => {
      process.env.LEANHUB_ALLOW_QA_TENANT = "1";
      env = loadLocalSupabaseEnv("qa:cookie:seed");
      admin = createClient(env.apiUrl, env.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      process.env.LEANHUB_ALLOW_DEMO_SEED = "1";
      execFileSync("node", ["--import", "tsx", "scripts/demo-seed/seed.ts"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    }, 180_000);

    afterAll(async () => {
      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
    }, 180_000);

    it("seeds CookieWorks foundation idempotently without module data", async () => {
      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const firstInventory = collectCookieWorksInventory(env.databaseUrl);
      expect(firstInventory.organisation?.code).toBe(QA_ORGANISATION.code);
      expect(isFoundationOnlyInventory(firstInventory)).toBe(true);

      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const secondInventory = collectCookieWorksInventory(env.databaseUrl);
      const foundation = secondInventory.sections.find(
        (section) => section.title === "Foundation",
      );
      const memberships = foundation?.items.find(
        (item) => item.label === "memberships",
      )?.count;
      const units = foundation?.items.find(
        (item) => item.label === "organisational units",
      )?.count;

      expect(memberships).toBe(7);
      expect(units).toBe(QA_UNITS.length);
      expect(isFoundationOnlyInventory(secondInventory)).toBe(true);
    }, 180_000);

    it("purges representative module fixtures while preserving Apex and isolation tenants", async () => {
      const { organisationId, unitIds } = await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      await ensureIsolationCanaryTenant(admin);
      await seedIsolationCanaryModuleRecord(env.apiUrl, env.publishableKey);

      const adminClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "admin",
      );

      const ciManagerClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "ciManager",
      );
      const assessorClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "assessor",
      );

      const fixtureSnapshot = await seedCookieWorksModuleFixtures({
        adminClient,
        ciManagerClient,
        assessorClient,
        unitIds,
        organisationId,
      });
      assertModuleFixturesPresent(fixtureSnapshot);

      const apexMaturityBefore = countOrganisationMaturityModels(
        env.databaseUrl,
        DEMO_ORGANISATION.code,
      );
      const isolationMaturityBefore = countOrganisationMaturityModels(
        env.databaseUrl,
        QA_ISOLATION_ORGANISATION.code,
      );
      const storageBefore = countCookieWorksStorageObjects(env.databaseUrl);

      expect(apexMaturityBefore).toBeGreaterThan(0);
      expect(isolationMaturityBefore).toBeGreaterThan(0);
      expect(fixtureSnapshot.attachments).toBeGreaterThan(0);

      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const postReset = assertCookieWorksResetVerified(env.databaseUrl);
      expect(postReset.isFoundationOnly).toBe(true);

      const postFixtureSnapshot =
        await collectCookieWorksModuleFixtureSnapshot(ciManagerClient);
      expect(postFixtureSnapshot.maturityModels).toBe(0);
      expect(postFixtureSnapshot.fiveSStandards).toBe(0);
      expect(postFixtureSnapshot.ciProjects).toBe(0);
      expect(postFixtureSnapshot.problemSolvingCases).toBe(0);
      expect(postFixtureSnapshot.comments).toBe(0);
      expect(postFixtureSnapshot.attachments).toBe(0);

      const apexMaturityAfter = countOrganisationMaturityModels(
        env.databaseUrl,
        DEMO_ORGANISATION.code,
      );
      const isolationMaturityAfter = countOrganisationMaturityModels(
        env.databaseUrl,
        QA_ISOLATION_ORGANISATION.code,
      );
      const storageAfter = countCookieWorksStorageObjects(env.databaseUrl);

      expect(apexMaturityAfter).toBe(apexMaturityBefore);
      expect(isolationMaturityAfter).toBe(isolationMaturityBefore);
      expect(storageAfter).toBe(0);
      if (storageBefore > 0) {
        expect(storageAfter).toBeLessThan(storageBefore);
      }

      const cookieInventory = collectCookieWorksInventory(env.databaseUrl);
      expect(isFoundationOnlyInventory(cookieInventory)).toBe(true);
    }, 300_000);

    it("supports repeatable CookieWorks reset after reseeding module fixtures", async () => {
      const { organisationId, unitIds } = await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const adminClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "admin",
      );

      const ciManagerClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "ciManager",
      );
      const assessorClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "assessor",
      );

      await seedCookieWorksModuleFixtures({
        adminClient,
        ciManagerClient,
        assessorClient,
        unitIds,
        organisationId,
      });

      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });
      assertCookieWorksResetVerified(env.databaseUrl);

      const refreshedFoundation = await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });
      const refreshedAdminClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "admin",
      );
      const refreshedCiManagerClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "ciManager",
      );
      const refreshedAssessorClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "assessor",
      );

      await seedCookieWorksModuleFixtures({
        adminClient: refreshedAdminClient,
        ciManagerClient: refreshedCiManagerClient,
        assessorClient: refreshedAssessorClient,
        unitIds: refreshedFoundation.unitIds,
        organisationId: refreshedFoundation.organisationId,
      });

      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const secondReset = assertCookieWorksResetVerified(env.databaseUrl);
      expect(secondReset.isFoundationOnly).toBe(true);
    }, 300_000);

    it("allows CookieWorks personas to authenticate locally", async () => {
      for (const userKey of Object.keys(QA_USERS) as Array<
        keyof typeof QA_USERS
      >) {
        const client = await signInUser(
          env.apiUrl,
          env.publishableKey,
          userKey,
        );
        const { data, error } = await client.auth.getUser();
        expect(error).toBeNull();
        expect(data.user?.email).toBe(QA_USERS[userKey].email);
      }
    }, 120_000);

    it("enforces the CookieWorks organisation contract after foundation seed", async () => {
      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const { assertCookieWorksOrganisationContract } =
        await import("../../scripts/qa-tenant/verification");

      const organisation = assertCookieWorksOrganisationContract(
        env.databaseUrl,
      );
      expect(organisation.code).toBe(QA_ORGANISATION.code);
      expect(organisation.name).toBe(QA_ORGANISATION.name);
    }, 120_000);

    it("preserves Apex demo authentication contract", async () => {
      const client = createClient(env.apiUrl, env.publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: sessionData, error: signInError } =
        await client.auth.signInWithPassword({
          email: DEMO_USERS.admin.email,
          password: DEMO_USERS.admin.password,
        });

      expect(signInError).toBeNull();
      expect(sessionData.session).not.toBeNull();

      const { data, error } = await client.auth.getUser();
      expect(error).toBeNull();
      expect(data.user?.email).toBe(DEMO_USERS.admin.email);
    }, 60_000);
  },
);
