import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

import { DEMO_USERS } from "../../../scripts/demo-seed/constants";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const workforceProvisioningAdmin = {
  email: DEMO_USERS.admin.email,
  password: DEMO_USERS.admin.password,
} as const;

export function resolveSupabaseServiceEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

  if (url && serviceRoleKey) {
    return { url, serviceRoleKey };
  }

  if (process.env.E2E_WITH_SUPABASE !== "1") {
    return { url, serviceRoleKey };
  }

  try {
    const output = execSync("npx supabase status -o json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const status = JSON.parse(output) as {
      API_URL?: string;
      SERVICE_ROLE_KEY?: string;
      ANON_KEY?: string;
    };

    return {
      url: url ?? status.API_URL,
      serviceRoleKey: serviceRoleKey ?? status.SERVICE_ROLE_KEY,
      anonKey: status.ANON_KEY,
    };
  } catch {
    return { url, serviceRoleKey };
  }
}

export function createServiceRoleClient() {
  const { url, serviceRoleKey } = resolveSupabaseServiceEnv();
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role client is unavailable for E2E.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createPublishableClient() {
  const env = resolveSupabaseServiceEnv();
  const url = env.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.anonKey;

  if (!url || !publishableKey) {
    throw new Error("Supabase publishable client is unavailable for E2E.");
  }

  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function extractJsonSegment(
  output: string,
  start: number,
  open: "{" | "[",
  close: "}" | "]",
): string {
  let depth = 0;
  for (let index = start; index < output.length; index += 1) {
    const character = output[index];
    if (character === open) {
      depth += 1;
    } else if (character === close) {
      depth -= 1;
      if (depth === 0) {
        return output.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Unexpected database query output: ${output}`);
}

function parseQueryRows<T extends Record<string, unknown>>(
  output: string,
): T[] {
  const objectStart = output.indexOf("{");
  if (objectStart >= 0) {
    const payload = JSON.parse(
      extractJsonSegment(output, objectStart, "{", "}"),
    ) as { rows?: T[] };
    return payload.rows ?? [];
  }

  const arrayStart = output.indexOf("[");
  if (arrayStart >= 0) {
    return JSON.parse(extractJsonSegment(output, arrayStart, "[", "]")) as T[];
  }

  throw new Error(`Unexpected database query output: ${output}`);
}

export function queryDatabase<T extends Record<string, unknown>>(sql: string) {
  const normalized = sql.replace(/\s+/g, " ").trim();
  const output = execSync(
    `npx supabase db query --local --output-format json ${JSON.stringify(normalized)}`,
    {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    },
  );
  return parseQueryRows<T>(output);
}

export async function resolveDemoOrganisationId(): Promise<string> {
  const sql =
    "select id from public.organisations where code = 'apex-manufacturing' limit 1";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rows = queryDatabase<{ id: string }>(sql);
    if (rows[0]?.id) {
      return rows[0].id;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error("Demo organisation not found.");
}

export type WorkforceProvisionedUserState = {
  membership_id: string;
  user_id: string;
  display_name: string;
  membership_status: string;
  enrolment_status: string;
  canonical_alias: string;
  internal_login_identifier: string;
  scope_type: string | null;
  scope_unit_id: string | null;
  role_canonical_name: string | null;
  job_function_code: string | null;
  organisational_unit_id: string | null;
  unit_name: string | null;
};

export function lookupWorkforceProvisionedUser(
  organisationId: string,
  canonicalAlias: string,
): WorkforceProvisionedUserState | null {
  const rows = queryDatabase<WorkforceProvisionedUserState>(`
    select
      membership_registry.id as membership_id,
      membership_registry.user_id,
      membership_registry.display_name,
      membership_registry.status as membership_status,
      identity_control.enrolment_status,
      workforce_alias.canonical_alias,
      workforce_account.internal_login_identifier,
      grant_row.scope_type,
      grant_row.scope_unit_id,
      role_row.canonical_name as role_canonical_name,
      job_function_row.code as job_function_code,
      assignment_row.organisational_unit_id,
      unit_row.name as unit_name
    from private.workforce_aliases workforce_alias
    join public.organisation_memberships membership_registry
      on membership_registry.id = workforce_alias.membership_id
    join private.identity_controls identity_control
      on identity_control.user_id = membership_registry.user_id
    join private.workforce_accounts workforce_account
      on workforce_account.id = workforce_alias.workforce_account_id
    left join public.access_grants grant_row
      on grant_row.grantee_membership_id = membership_registry.id
     and grant_row.status = 'active'
    left join public.role_versions role_version
      on role_version.id = grant_row.role_version_id
    left join public.roles role_row
      on role_row.id = role_version.role_id
    left join public.membership_job_function_assignments assignment_row
      on assignment_row.membership_id = membership_registry.id
     and assignment_row.is_primary = true
     and assignment_row.valid_from <= statement_timestamp()
     and (
       assignment_row.valid_to is null
       or assignment_row.valid_to > statement_timestamp()
     )
    left join public.job_functions job_function_row
      on job_function_row.id = assignment_row.job_function_id
    left join public.organisation_units unit_row
      on unit_row.id = assignment_row.organisational_unit_id
    where workforce_alias.organisation_id = '${organisationId}'
      and workforce_alias.canonical_alias = '${canonicalAlias}'
      and workforce_alias.status = 'active'
    limit 1
  `);

  return rows[0] ?? null;
}

export function assertTemporaryPasswordNotPersisted(
  temporaryPassword: string,
  organisationId: string,
  canonicalAlias: string,
) {
  const intentRows = queryDatabase<{ metadata: string }>(`
    select metadata::text as metadata
    from public.security_audit_events
    where organisation_id = '${organisationId}'
      and action in (
        'workforce.provision_preauthorized',
        'workforce.provision_completed'
      )
  `);

  for (const row of intentRows) {
    if (row.metadata.includes(temporaryPassword)) {
      throw new Error(
        "Temporary password leaked into security audit metadata.",
      );
    }
  }

  const persisted = queryDatabase<{ payload: string }>(`
    select jsonb_build_object(
      'intents', (
        select coalesce(jsonb_agg(to_jsonb(intent_row)), '[]'::jsonb)
        from public.workforce_provision_intents intent_row
        where intent_row.organisation_id = '${organisationId}'
          and intent_row.target_canonical_alias = '${canonicalAlias}'
      ),
      'memberships', (
        select coalesce(jsonb_agg(to_jsonb(membership_registry)), '[]'::jsonb)
        from public.organisation_memberships membership_registry
        where membership_registry.organisation_id = '${organisationId}'
          and membership_registry.display_name = 'M1 Workforce Operator'
      ),
      'notification_contacts', (
        select coalesce(jsonb_agg(to_jsonb(contact_row)), '[]'::jsonb)
        from public.membership_notification_contacts contact_row
        where contact_row.organisation_id = '${organisationId}'
      )
    )::text as payload
  `);

  const payload = persisted[0]?.payload ?? "";
  if (payload.includes(temporaryPassword)) {
    throw new Error(
      "Temporary password leaked into persisted provisioning data.",
    );
  }
}

export async function createAuthenticatedClient(
  email: string,
  password: string,
) {
  const client = createPublishableClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  return client;
}

export async function submitWorkforceLogin(
  page: Page,
  input: {
    organisationCode: string;
    workforceAlias: string;
    password: string;
  },
) {
  await page.goto("/workforce-login");
  const response = await page.request.post("/api/auth/workforce", {
    form: {
      organisationCode: input.organisationCode,
      workforceAlias: input.workforceAlias,
      password: input.password,
    },
    headers: {
      Origin: "http://127.0.0.1:3000",
    },
    maxRedirects: 0,
  });

  const location = response.headers().location;
  if (!location) {
    throw new Error(
      `Workforce login did not redirect (${response.status()}): ${await response.text()}`,
    );
  }

  const redirectPath = new URL(location, "http://127.0.0.1:3000");
  await page.goto(`${redirectPath.pathname}${redirectPath.search}`);
  await page.waitForLoadState("networkidle");
}

export async function memberHasPermission(
  client: SupabaseClient,
  permissionKey: string,
) {
  const { data, error } = await client.rpc("member_has_permission", {
    target_permission_key: permissionKey,
  });
  if (error) {
    throw error;
  }
  return data === true;
}
