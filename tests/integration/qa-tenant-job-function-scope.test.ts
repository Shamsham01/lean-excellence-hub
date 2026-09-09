// @vitest-environment node
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEMO_ORGANISATION } from "../../scripts/demo-seed/constants";
import { QA_ORGANISATION, QA_USERS } from "../../scripts/qa-tenant/constants";
import { purgeCookieWorksTenantModules } from "../../scripts/qa-tenant/delete-tenant";
import { runSupabaseDbQueryJson } from "../../scripts/qa-tenant/db-cli";
import { seedCookieWorksFoundation } from "../../scripts/qa-tenant/foundation-seed";
import { loadLocalSupabaseEnv } from "../../scripts/qa-tenant/local-env";

const SHARED_JOB_FUNCTION_CODE = "cookieworks-production-manager";

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

describe.skipIf(!hasLocalSupabase)(
  "CookieWorks job function tenant scope regression",
  () => {
    let env: ReturnType<typeof loadLocalSupabaseEnv>;
    let admin: ReturnType<typeof createClient>;
    let cookieWorksOrganisationId = "";
    let apexOrganisationId = "";
    let apexConflictingJobFunctionId = "";

    beforeAll(async () => {
      process.env.LEANHUB_ALLOW_QA_TENANT = "1";
      process.env.LEANHUB_ALLOW_DEMO_SEED = "1";

      env = loadLocalSupabaseEnv("qa:cookie:seed");
      admin = createClient(env.apiUrl, env.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const apexExists =
        (
          runSupabaseDbQueryJson<{ id: string }>({
            databaseUrl: env.databaseUrl,
            outputFormat: "json",
            sql: `
              select id
              from public.organisations
              where code = '${DEMO_ORGANISATION.code}'
              limit 1;
            `,
          })[0]?.id ?? ""
        ).length > 0;

      if (!apexExists) {
        execFileSync("node", ["--import", "tsx", "scripts/demo-seed/seed.ts"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            LEANHUB_ALLOW_DEMO_SEED: "1",
          },
        });
      }

      const organisations = runSupabaseDbQueryJson<{
        id: string;
        code: string;
      }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select id, code
          from public.organisations
          where code in ('${QA_ORGANISATION.code}', '${DEMO_ORGANISATION.code}');
        `,
      });

      cookieWorksOrganisationId =
        organisations.find((row) => row.code === QA_ORGANISATION.code)?.id ??
        "";
      apexOrganisationId =
        organisations.find((row) => row.code === DEMO_ORGANISATION.code)?.id ??
        "";

      if (!apexOrganisationId) {
        throw new Error(
          "Expected Apex organisation before job function scope regression seed.",
        );
      }

      const apexOwnerMembership = runSupabaseDbQueryJson<{ id: string }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select membership.id
          from public.organisation_memberships membership
          join public.organisations organisation
            on organisation.id = membership.organisation_id
          where organisation.code = '${DEMO_ORGANISATION.code}'
            and membership.user_id = 'a0000000-0000-0000-0000-000000000001'
            and membership.status = 'active'
          limit 1;
        `,
      })[0];

      if (!apexOwnerMembership?.id) {
        throw new Error(
          "Apex owner membership missing for conflicting job function.",
        );
      }

      const conflictingRows = runSupabaseDbQueryJson<{ id: string }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          insert into public.job_functions (
            organisation_id,
            name,
            code,
            created_by_membership_id
          )
          values (
            '${apexOrganisationId}'::uuid,
            'Apex Conflicting Production Manager',
            '${SHARED_JOB_FUNCTION_CODE}',
            '${apexOwnerMembership.id}'::uuid
          )
          on conflict (organisation_id, code) do update
            set name = excluded.name
          returning id;
        `,
      });

      apexConflictingJobFunctionId = conflictingRows[0]?.id ?? "";
      if (!apexConflictingJobFunctionId) {
        throw new Error("Failed to seed Apex conflicting job function row.");
      }

      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
      const seedResult = await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });
      cookieWorksOrganisationId = seedResult.organisationId;
    }, 180_000);

    afterAll(async () => {
      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
    }, 180_000);

    it("allows another organisation to own the same job-function code", () => {
      const rows = runSupabaseDbQueryJson<{
        organisation_id: string;
        code: string;
      }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select organisation_id, code
          from public.job_functions
          where code = '${SHARED_JOB_FUNCTION_CODE}'
            and status = 'active'
          order by organisation_id;
        `,
      });

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.organisation_id).sort()).toEqual(
        [apexOrganisationId, cookieWorksOrganisationId].sort(),
      );
    });

    it("creates CookieWorks-specific job functions and assignments within tenant scope", () => {
      const cookieWorksJobFunction = runSupabaseDbQueryJson<{
        id: string;
        organisation_id: string;
      }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select id, organisation_id
          from public.job_functions
          where organisation_id = '${cookieWorksOrganisationId}'::uuid
            and code = '${SHARED_JOB_FUNCTION_CODE}'
            and status = 'active'
          limit 1;
        `,
      })[0];

      expect(cookieWorksJobFunction?.organisation_id).toBe(
        cookieWorksOrganisationId,
      );
      expect(cookieWorksJobFunction?.id).not.toBe(apexConflictingJobFunctionId);

      const assignment = runSupabaseDbQueryJson<{
        job_function_id: string;
        job_function_organisation_id: string;
        membership_user_id: string;
      }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select
            assignment.job_function_id,
            job_function.organisation_id as job_function_organisation_id,
            membership.user_id as membership_user_id
          from public.membership_job_function_assignments assignment
          join public.job_functions job_function
            on job_function.id = assignment.job_function_id
          join public.organisation_memberships membership
            on membership.id = assignment.membership_id
          where membership.organisation_id = '${cookieWorksOrganisationId}'::uuid
            and membership.user_id = '${QA_USERS.productionManager.id}'
            and assignment.valid_to is null
          limit 1;
        `,
      })[0];

      expect(assignment?.membership_user_id).toBe(
        QA_USERS.productionManager.id,
      );
      expect(assignment?.job_function_id).toBe(cookieWorksJobFunction?.id);
      expect(assignment?.job_function_organisation_id).toBe(
        cookieWorksOrganisationId,
      );
    });
  },
);
