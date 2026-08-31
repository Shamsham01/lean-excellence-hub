#!/usr/bin/env node
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

  if (/^(INSERT|UPDATE|DELETE|ALTER|CREATE)\s/i.test(trimmed)) {
    return { rows: [] };
  }

  return parseJsonObject<DbQueryResult>(output);
}

function runLocalQuery<T extends Record<string, unknown>>(sql: string): T[] {
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
        throw new Error(parsed.error?.message ?? "supabase db query failed");
      }
    }

    throw new Error(stdout || execError.message || "supabase db query failed");
  } finally {
    rmSync(queryDirectory, { recursive: true, force: true });
  }

  const parsed = parseDbQueryOutput(output);
  if (parsed._tag === "Error" || parsed.error) {
    throw new Error(parsed.error?.message ?? "supabase db query failed");
  }

  return (parsed.rows ?? []) as T[];
}

function runLocalSql(sql: string): void {
  runLocalQuery(sql);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureAuthUser(userId: string, email: string): void {
  runLocalSql(
    `insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous) values ('${userId}', '${email}', statement_timestamp(), statement_timestamp(), statement_timestamp(), '{"provider":"email","providers":["email"]}', '{}', false, false) on conflict (id) do nothing;`,
  );
  runLocalSql(
    `insert into public.profiles (user_id) values ('${userId}'::uuid) on conflict (user_id) do nothing;`,
  );
  runLocalSql(
    `insert into private.identity_controls (user_id) values ('${userId}'::uuid) on conflict (user_id) do nothing;`,
  );
}

async function resolveOrganisationId(
  serviceClient: SupabaseClient<Database>,
  ownerUserId: string,
  organisationCode: string,
  organisationName: string,
): Promise<string> {
  const { data: organisationId, error: provisionError } =
    await serviceClient.rpc("provision_organisation", {
      owner_user_id: ownerUserId,
      organisation_code: organisationCode,
      organisation_name: organisationName,
    });

  if (provisionError && !provisionError.message.includes("duplicate key")) {
    throw provisionError;
  }

  if (typeof organisationId === "string" && organisationId.length > 0) {
    return organisationId;
  }

  const existingOrganisationId = runLocalQuery<{ organisation_id: string }>(
    `select id::text as organisation_id from public.organisations where code = '${organisationCode}' limit 1;`,
  )[0]?.organisation_id;

  if (existingOrganisationId) {
    return existingOrganisationId;
  }

  throw new Error(
    `organisation id is required for integration test (provision error: ${provisionError?.message ?? "none"})`,
  );
}

function enqueueDomainEvent(
  organisationId: string,
  idempotencyKey: string,
): string {
  const eventRows = runLocalQuery<{ event_id: string }>(
    `select private.enqueue_domain_event('${organisationId}'::uuid, null, 'IntegrationWorkerEvent', '${idempotencyKey}', '{"integration":true}'::jsonb)::text as event_id;`,
  );

  const eventId = eventRows[0]?.event_id;
  if (!eventId) {
    throw new Error(
      `event id is required for integration test (enqueue rows: ${JSON.stringify(eventRows)})`,
    );
  }

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
  const organisationCode = `n1a-worker-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const idempotencyKey = `n1a-worker-integration-${randomUUID()}`;

  const serviceClient = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  ensureAuthUser(ownerUserId, ownerEmail);

  const { error: enrolmentError } = await serviceClient.rpc(
    "finalise_identity_enrolment",
    { target_user_id: ownerUserId },
  );
  if (enrolmentError && !enrolmentError.message.includes("duplicate key")) {
    throw enrolmentError;
  }

  const resolvedOrganisationId = await resolveOrganisationId(
    serviceClient,
    ownerUserId,
    organisationCode,
    "N1a Worker Integration Org",
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
    (row: { event_id: string }) => row.event_id === eventId,
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
