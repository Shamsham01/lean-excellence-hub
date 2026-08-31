#!/usr/bin/env node
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/platform/supabase/database.types";

type SupabaseStatus = {
  API_URL?: string;
  SERVICE_ROLE_KEY?: string;
  ANON_KEY?: string;
};

type DbQueryResult = {
  rows?: Record<string, unknown>[];
  error?: { message?: string };
  _tag?: string;
};

function extractJsonObject(output: string): string {
  const jsonStart = output.indexOf("{");
  if (jsonStart === -1) {
    throw new Error(`unexpected supabase command output: ${output}`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = jsonStart; index < output.length; index += 1) {
    const character = output[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return output.slice(jsonStart, index + 1);
      }
    }
  }

  throw new Error(
    `incomplete JSON object in supabase command output: ${output}`,
  );
}

function parseJsonObject<T>(output: string): T {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new Error("supabase command returned empty output");
  }

  return JSON.parse(extractJsonObject(trimmed)) as T;
}

function readSupabaseStatus(): SupabaseStatus {
  const output = execSync("npx supabase status -o json", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  return parseJsonObject<SupabaseStatus>(output);
}

function parseDbQueryOutput(output: string): DbQueryResult {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new Error("supabase db query returned empty output");
  }

  if (trimmed.includes("{")) {
    return parseJsonObject<DbQueryResult>(output);
  }

  if (/^(INSERT|UPDATE|DELETE|ALTER|CREATE)\s/i.test(trimmed)) {
    return { rows: [] };
  }

  throw new Error(`unexpected supabase db query output: ${output}`);
}

function runLocalQuery<T extends Record<string, unknown>>(
  sql: string,
  context: string,
): T[] {
  const queryDirectory = mkdtempSync(join(tmpdir(), "n1a-worker-query-"));
  const queryFile = join(queryDirectory, "query.sql");
  writeFileSync(queryFile, sql, "utf8");

  let output: string;

  try {
    output = execSync(
      `npx supabase db query --local --output-format json -f ${JSON.stringify(queryFile)}`,
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const execError = error as {
      stdout?: string | Buffer;
      message?: string;
    };
    const stdout = execError.stdout?.toString().trim() ?? "";

    if (stdout) {
      const parsed = parseDbQueryOutput(stdout);
      if (parsed._tag === "Error" || parsed.error) {
        throw new Error(
          `${context}: ${parsed.error?.message ?? "supabase db query failed"}`,
        );
      }
    }

    throw new Error(
      stdout || execError.message || `${context}: supabase db query failed`,
    );
  } finally {
    rmSync(queryDirectory, { recursive: true, force: true });
  }

  const parsed = parseDbQueryOutput(output);
  if (parsed._tag === "Error" || parsed.error) {
    throw new Error(
      `${context}: ${parsed.error?.message ?? "supabase db query failed"}`,
    );
  }

  const rows = (parsed.rows ?? []) as T[];
  if (rows.length === 0) {
    throw new Error(
      `${context}: query returned no rows (output: ${output.trim().slice(0, 500)})`,
    );
  }

  return rows;
}

function runLocalSql(sql: string): void {
  const queryDirectory = mkdtempSync(join(tmpdir(), "n1a-worker-query-"));
  const queryFile = join(queryDirectory, "query.sql");
  writeFileSync(queryFile, sql, "utf8");

  try {
    execSync(
      `npx supabase db query --local --output-format json -f ${JSON.stringify(queryFile)}`,
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const execError = error as {
      stdout?: string | Buffer;
      message?: string;
    };
    const stdout = execError.stdout?.toString().trim() ?? "";

    if (stdout) {
      const parsed = parseDbQueryOutput(stdout);
      if (parsed._tag === "Error" || parsed.error) {
        throw new Error(parsed.error?.message ?? "supabase db query failed");
      }
    }

    throw new Error(stdout || execError.message || "supabase db query failed");
  } finally {
    rmSync(queryDirectory, { recursive: true, force: true });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureAuthUser(
  admin: ReturnType<typeof createClient<Database>>,
  userId: string,
  email: string,
): Promise<void> {
  const existing = await admin.auth.admin.getUserById(userId);
  if (!existing.error && existing.data.user) {
    return;
  }

  const created = await admin.auth.admin.createUser({
    id: userId,
    email,
    email_confirm: true,
  });

  if (!created.error || created.error.status === 422) {
    return;
  }

  runLocalSql(
    `insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous) values ('${userId}', '${email}', statement_timestamp(), statement_timestamp(), statement_timestamp(), '{"provider":"email","providers":["email"]}', '{}', false, false) on conflict (id) do nothing;`,
  );
  runLocalSql(
    `insert into private.identity_controls (user_id) values ('${userId}'::uuid) on conflict (user_id) do nothing;`,
  );
}

function enqueueDomainEvent(
  organisationId: string,
  idempotencyKey: string,
): string {
  const eventRows = runLocalQuery<{ event_id: string }>(
    `insert into private.domain_event_outbox (
      organisation_id,
      event_type,
      idempotency_key,
      payload
    )
    values (
      '${organisationId}'::uuid,
      'IntegrationWorkerEvent',
      '${idempotencyKey}',
      '{"integration":true}'::jsonb
    )
    returning id::text as event_id;`,
    "enqueue integration domain event",
  );

  const eventId = eventRows[0]?.event_id;
  assert(
    eventId,
    `event id is required for integration test (enqueue rows: ${JSON.stringify(eventRows)})`,
  );

  return eventId;
}

async function main() {
  const status = readSupabaseStatus();
  // CI exports placeholder Supabase env vars. PostgREST must use JWT keys from
  // the running local stack, not sb_* placeholders from workflow env.
  const url = status.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    status.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const anonKey =
    status.ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  assert(url, "Supabase API URL is required");
  assert(serviceRoleKey, "Supabase service role key is required");
  assert(anonKey, "Supabase anon key is required");

  const ownerUserId = "f1000000-0000-0000-0000-000000000099";
  const ownerEmail = "n1a-worker-integration@example.test";
  const organisationCode = `n1a-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const idempotencyKey = `n1a-worker-integration-${randomUUID()}`;

  const serviceClient = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await ensureAuthUser(serviceClient, ownerUserId, ownerEmail);

  const { error: enrolmentError } = await serviceClient.rpc(
    "finalise_identity_enrolment",
    { target_user_id: ownerUserId },
  );
  if (enrolmentError) {
    throw enrolmentError;
  }

  const { data: organisationId, error: provisionError } =
    await serviceClient.rpc("provision_organisation", {
      owner_user_id: ownerUserId,
      organisation_code: organisationCode,
      organisation_name: "N1a Worker Integration Org",
    });

  if (
    provisionError &&
    !provisionError.message.includes("duplicate key value")
  ) {
    throw provisionError;
  }

  let resolvedOrganisationId: string | null = organisationId;
  if (!resolvedOrganisationId) {
    resolvedOrganisationId =
      runLocalQuery<{ organisation_id: string }>(
        `select id::text as organisation_id from public.organisations where code = '${organisationCode}' limit 1;`,
        "resolve existing organisation",
      )[0]?.organisation_id ?? null;
  }

  assert(
    resolvedOrganisationId,
    `organisation id is required for integration test (provision error: ${provisionError?.message ?? "none"})`,
  );

  const eventId = enqueueDomainEvent(resolvedOrganisationId, idempotencyKey);

  const { error: anonClaimError } = await anonClient.rpc(
    "claim_domain_events_for_worker",
    { batch_size: 1 },
  );
  assert(
    anonClaimError,
    "anon must be denied for claim_domain_events_for_worker",
  );

  const { data: claimedEvents, error: claimError } = await serviceClient.rpc(
    "claim_domain_events_for_worker",
    { batch_size: 1000 },
  );

  if (claimError) {
    throw claimError;
  }

  const claimed = (claimedEvents ?? []).find(
    (row) => row.event_id === eventId,
  );

  assert(
    claimed,
    "service_role claim through PostgREST must return the enqueued event",
  );
  assert(
    claimed.organisation_id === resolvedOrganisationId,
    "claimed event must include organisation_id",
  );
  assert(
    claimed.event_type === "IntegrationWorkerEvent",
    "claimed event must include event_type",
  );
  assert(claimed.lease_token, "claimed event must include lease_token");

  const { data: completed, error: completeError } = await serviceClient.rpc(
    "complete_domain_event_for_worker",
    {
      target_organisation_id: resolvedOrganisationId,
      target_event_id: eventId,
      expected_lease_token: claimed.lease_token,
    },
  );

  if (completeError) {
    throw completeError;
  }

  assert(
    completed === true,
    "complete_domain_event_for_worker must return true",
  );

  const { error: staleCompleteError, data: staleCompleted } =
    await serviceClient.rpc("complete_domain_event_for_worker", {
      target_organisation_id: resolvedOrganisationId,
      target_event_id: eventId,
      expected_lease_token: claimed.lease_token,
    });

  if (staleCompleteError) {
    throw staleCompleteError;
  }

  assert(
    staleCompleted === false,
    "stale lease token completion must return false through PostgREST",
  );

  console.log("N1a worker API PostgREST integration: PASS");
}

main().catch((error: unknown) => {
  console.error("N1a worker API PostgREST integration: FAIL");
  console.error(error);
  process.exit(1);
});
