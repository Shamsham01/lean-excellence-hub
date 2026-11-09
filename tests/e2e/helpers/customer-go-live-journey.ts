import { execSync } from "node:child_process";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { FoundingE2eUser } from "./founding-onboarding";

function localDatabaseContainerName() {
  const names = execSync("docker ps --format '{{.Names}}' | grep supabase_db", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "ignore"],
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  if (names.length !== 1) {
    throw new Error("Local Supabase database container was not found.");
  }
  return names[0];
}

function runPsql(sql: string) {
  return execSync(
    `docker exec -i ${localDatabaseContainerName()} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -c ${JSON.stringify(sql)}`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}

export function queryOrganisationUnitIdByName(
  organisationId: string,
  unitName: string,
) {
  const escapedName = unitName.replace(/'/g, "''");
  const row = runPsql(
    `select unit.id::text from public.organisation_units unit where unit.organisation_id = '${organisationId}'::uuid and unit.name = '${escapedName}' and unit.status = 'active' limit 1;`,
  );
  if (!row) {
    throw new Error(`Unit ${unitName} was not found for organisation`);
  }
  return row;
}

export function queryPublishedRoleVersionId(
  organisationId: string,
  canonicalName: string,
) {
  const row = runPsql(
    `select role_version.id::text from public.roles role_row join public.role_versions role_version on role_version.organisation_id = role_row.organisation_id and role_version.role_id = role_row.id where role_row.organisation_id = '${organisationId}'::uuid and role_row.canonical_name = '${canonicalName.replace(/'/g, "''")}' and role_row.status = 'active' and role_version.status = 'published' limit 1;`,
  );
  if (!row) {
    throw new Error(`Role version ${canonicalName} was not found`);
  }
  return row;
}

export function queryJobFunctionIdByCode(organisationId: string, code: string) {
  const row = runPsql(
    `select job_function.id::text from public.job_functions job_function where job_function.organisation_id = '${organisationId}'::uuid and job_function.code = '${code.replace(/'/g, "''")}' and job_function.status = 'active' limit 1;`,
  );
  if (!row) {
    throw new Error(`Job function ${code} was not found`);
  }
  return row;
}

export function enableLeanAiCreditEnforcement(organisationId: string) {
  runPsql(
    `insert into public.organisation_ai_settings (organisation_id, ai_enabled, credit_policy_enforced) values ('${organisationId}'::uuid, true, true) on conflict (organisation_id) do update set ai_enabled = true, credit_policy_enforced = true; select private.ensure_organisation_ai_credit_period('${organisationId}'::uuid);`,
  );
}

export function exhaustLeanAiCreditAllowance(organisationId: string) {
  runPsql(
    `update public.organisation_ai_credit_periods period_row set consumed_credits = period_row.allowance_credits, reserved_credits = 0 where period_row.organisation_id = '${organisationId}'::uuid and period_row.period_end > statement_timestamp();`,
  );
}

export async function waitForSuggestionApprovalRouting(
  organisationId: string,
  suggestionId: string,
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = runPsql(
      `select coalesce(routing_row.primary_approver_membership_id::text, '') as primary_id, suggestion_row.status::text as status from public.improvement_suggestions suggestion_row left join public.suggestion_approval_routing routing_row on routing_row.organisation_id = suggestion_row.organisation_id and routing_row.suggestion_id = suggestion_row.id where suggestion_row.organisation_id = '${organisationId}'::uuid and suggestion_row.id = '${suggestionId}'::uuid limit 1;`,
    );
    const [primaryId, status] = row.split("|");
    if (
      primaryId &&
      primaryId.length > 0 &&
      (status === "submitted" || status === "under_review")
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Suggestion ${suggestionId} routing did not settle within ${timeoutMs}ms`,
  );
}

export async function assertModuleWriteDenied(
  client: SupabaseClient,
  moduleKey: string,
) {
  const entitled = await client.rpc(
    "current_organisation_plan_module_entitled",
    {
      target_module: moduleKey,
    },
  );
  if (entitled.error) {
    throw entitled.error;
  }
  return entitled.data === false;
}

export type GoLiveColleague = {
  email: string;
  password: string;
  displayName: string;
};

export function colleaguePath(siteName: string) {
  return `${siteName} > Operations`;
}

export const BASELINE_ROLE_LABELS_ON_ANY_PLAN = [
  "Organisation Owner",
  "Organisation Administrator",
  "Manager",
  "Team Member",
  "Finance Validator",
] as const;

export function summariseFoundingUser(user: FoundingE2eUser) {
  return `${user.organisationName} (${user.email})`;
}
