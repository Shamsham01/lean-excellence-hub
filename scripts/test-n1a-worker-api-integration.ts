#!/usr/bin/env node
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

function readSupabaseEnv(): Record<string, string> {
  const output = execSync("npx supabase status -o env", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  const env: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    let value = trimmed.slice(separatorIndex + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function runLocalQuery<T extends Record<string, unknown>>(sql: string): T[] {
  const output = execSync(
    `npx supabase db query --local --output-format json ${JSON.stringify(sql)}`,
    {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const parsed = JSON.parse(output) as {
    rows?: T[];
    error?: { message?: string };
    _tag?: string;
  };

  if (parsed._tag === "Error" || parsed.error) {
    throw new Error(parsed.error?.message ?? "supabase db query failed");
  }

  return parsed.rows ?? [];
}

function runLocalSql(sql: string): void {
  execSync(
    `npx supabase db query --local --output-format json ${JSON.stringify(sql)}`,
    {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const status = readSupabaseEnv();
  // Local PostgREST integration must use keys from the running Supabase stack.
  // CI sets placeholder env vars for app jobs; those are not valid JWTs here.
  const url = status.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    status.SERVICE_ROLE_KEY ??
    status.SECRET_KEY ??
    process.env.SUPABASE_SECRET_KEY;
  const anonKey =
    status.ANON_KEY ??
    status.PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  assert(url, "Supabase API URL is required");
  assert(serviceRoleKey, "Supabase service role key is required");
  assert(anonKey, "Supabase anon key is required");

  const ownerUserId = "f1000000-0000-0000-0000-000000000099";
  const ownerEmail = "n1a-worker-integration@example.test";
  const organisationCode = "n1a-worker-integration";
  const idempotencyKey = `n1a-worker-integration-${randomUUID()}`;

  runLocalSql(
    `insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous) values ('${ownerUserId}', '${ownerEmail}', statement_timestamp(), statement_timestamp(), statement_timestamp(), '{"provider":"email","providers":["email"]}', '{}', false, false) on conflict (id) do nothing;`,
  );

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existingOrganisationId = runLocalQuery<{ organisation_id: string }>(
    `select id::text as organisation_id from public.organisations where code = '${organisationCode}' limit 1;`,
  )[0]?.organisation_id;

  const resolvedOrganisationId =
    existingOrganisationId ??
    runLocalQuery<{ organisation_id: string }>(
      `select private.provision_organisation('${ownerUserId}'::uuid, '${organisationCode}', 'N1a Worker Integration Org')::text as organisation_id;`,
    )[0]?.organisation_id;

  assert(
    resolvedOrganisationId,
    "organisation id is required for integration test",
  );

  const eventRows = runLocalQuery<{ event_id: string }>(
    `select private.enqueue_domain_event('${resolvedOrganisationId}'::uuid, null, 'IntegrationWorkerEvent', '${idempotencyKey}', '{"integration":true}'::jsonb)::text as event_id;`,
  );

  const eventId = eventRows[0]?.event_id;
  assert(
    eventId,
    `event id is required for integration test (enqueue rows: ${JSON.stringify(eventRows)})`,
  );

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
    { batch_size: 10 },
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
