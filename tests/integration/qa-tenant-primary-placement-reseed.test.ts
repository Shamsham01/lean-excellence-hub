// @vitest-environment node
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { QA_ORGANISATION, QA_USERS } from "../../scripts/qa-tenant/constants";
import { purgeCookieWorksTenantModules } from "../../scripts/qa-tenant/delete-tenant";
import { runSupabaseDbQueryJson } from "../../scripts/qa-tenant/db-cli";
import { seedCookieWorksFoundation } from "../../scripts/qa-tenant/foundation-seed";
import { loadLocalSupabaseEnv } from "../../scripts/qa-tenant/local-env";
import { signInUser } from "../../scripts/qa-tenant/shared/auth";
import { switchOrganisation } from "../../scripts/qa-tenant/shared/organisation";

const PRODUCTION_MANAGER_JOB_FUNCTION_CODE = "cookieworks-production-manager";
const EXETER_OPERATIONS_UNIT_CODE = "exeter-operations";
const EXETER_QUALITY_UNIT_CODE = "exeter-quality";

type PrimaryPlacementRow = {
  id: string;
  organisational_unit_id: string;
  unit_code: string;
  valid_to: string | null;
  is_primary: boolean;
};

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

function fetchExeterProductionManagerPrimaryPlacements(
  databaseUrl: string,
  organisationId: string,
) {
  return runSupabaseDbQueryJson<PrimaryPlacementRow>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select
        assignment.id,
        assignment.organisational_unit_id,
        unit.code as unit_code,
        assignment.valid_to,
        assignment.is_primary
      from public.membership_job_function_assignments assignment
      join public.organisation_memberships membership
        on membership.id = assignment.membership_id
      join public.organisation_units unit
        on unit.id = assignment.organisational_unit_id
      where membership.organisation_id = '${organisationId}'::uuid
        and membership.user_id = '${QA_USERS.exeterProductionManager.id}'
        and assignment.is_primary = true
      order by assignment.valid_from asc, assignment.id asc;
    `,
  });
}

const hasLocalSupabase = isLocalSupabaseAvailable();

describe.skipIf(!hasLocalSupabase)(
  "CookieWorks primary placement foundation reseed regression",
  () => {
    let env: ReturnType<typeof loadLocalSupabaseEnv>;
    let admin: ReturnType<typeof createClient>;

    beforeAll(async () => {
      process.env.LEANHUB_ALLOW_QA_TENANT = "1";
      env = loadLocalSupabaseEnv("qa:cookie:seed");
      admin = createClient(env.apiUrl, env.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
    }, 180_000);

    afterAll(async () => {
      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
    }, 180_000);

    it("restores intended foundation placement after deliberate wrong-unit seeding and remains idempotent", async () => {
      const { organisationId, unitIds } = await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      expect(organisationId).toBeTruthy();
      expect(
        runSupabaseDbQueryJson<{ code: string }>({
          databaseUrl: env.databaseUrl,
          outputFormat: "json",
          sql: `
            select code
            from public.organisations
            where id = '${organisationId}'::uuid
            limit 1;
          `,
        })[0]?.code,
      ).toBe(QA_ORGANISATION.code);

      const exeterOperationsId = unitIds[EXETER_OPERATIONS_UNIT_CODE];
      const exeterQualityId = unitIds[EXETER_QUALITY_UNIT_CODE];
      expect(exeterOperationsId).toBeTruthy();
      expect(exeterQualityId).toBeTruthy();

      const initialPlacements = fetchExeterProductionManagerPrimaryPlacements(
        env.databaseUrl,
        organisationId,
      );
      const initialActive = initialPlacements.filter(
        (row) => row.valid_to === null,
      );
      expect(initialActive).toHaveLength(1);
      expect(initialActive[0]?.unit_code).toBe(EXETER_OPERATIONS_UNIT_CODE);

      const adminClient = await signInUser(
        env.apiUrl,
        env.publishableKey,
        "admin",
      );
      await switchOrganisation(adminClient, organisationId);

      const membershipId =
        runSupabaseDbQueryJson<{ id: string }>({
          databaseUrl: env.databaseUrl,
          outputFormat: "json",
          sql: `
            select id
            from public.organisation_memberships
            where organisation_id = '${organisationId}'::uuid
              and user_id = '${QA_USERS.exeterProductionManager.id}'
            limit 1;
          `,
        })[0]?.id ?? "";

      const jobFunctionId =
        runSupabaseDbQueryJson<{ id: string }>({
          databaseUrl: env.databaseUrl,
          outputFormat: "json",
          sql: `
            select id
            from public.job_functions
            where organisation_id = '${organisationId}'::uuid
              and code = '${PRODUCTION_MANAGER_JOB_FUNCTION_CODE}'
              and status = 'active'
            limit 1;
          `,
        })[0]?.id ?? "";

      expect(membershipId).toBeTruthy();
      expect(jobFunctionId).toBeTruthy();

      const { error: misplaceError } = await adminClient.rpc(
        "assign_membership_job_function",
        {
          target_membership_id: membershipId,
          target_job_function_id: jobFunctionId,
          target_primary: true,
          target_organisational_unit_id: exeterQualityId,
          target_assignment_reason: "Deliberate wrong-unit regression setup",
        },
      );
      expect(misplaceError).toBeNull();

      const misplacedPlacements = fetchExeterProductionManagerPrimaryPlacements(
        env.databaseUrl,
        organisationId,
      );
      const misplacedActive = misplacedPlacements.filter(
        (row) => row.valid_to === null,
      );
      expect(misplacedActive).toHaveLength(1);
      expect(misplacedActive[0]?.unit_code).toBe(EXETER_QUALITY_UNIT_CODE);
      expect(misplacedPlacements.length).toBeGreaterThan(
        initialPlacements.length,
      );

      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const restoredPlacements = fetchExeterProductionManagerPrimaryPlacements(
        env.databaseUrl,
        organisationId,
      );
      const restoredActive = restoredPlacements.filter(
        (row) => row.valid_to === null,
      );
      expect(restoredActive).toHaveLength(1);
      expect(restoredActive[0]?.unit_code).toBe(EXETER_OPERATIONS_UNIT_CODE);
      expect(restoredActive[0]?.organisational_unit_id).toBe(
        exeterOperationsId,
      );

      const historyCountAfterRestore = restoredPlacements.length;

      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const idempotentPlacements =
        fetchExeterProductionManagerPrimaryPlacements(
          env.databaseUrl,
          organisationId,
        );
      const idempotentActive = idempotentPlacements.filter(
        (row) => row.valid_to === null,
      );

      expect(idempotentPlacements).toHaveLength(historyCountAfterRestore);
      expect(idempotentActive).toHaveLength(1);
      expect(idempotentActive[0]?.id).toBe(restoredActive[0]?.id);
      expect(idempotentActive[0]?.unit_code).toBe(EXETER_OPERATIONS_UNIT_CODE);
    }, 180_000);
  },
);
