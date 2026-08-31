#!/usr/bin/env node
import { execSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

type SupabaseStatus = {
  API_URL?: string;
  SERVICE_ROLE_KEY?: string;
  ANON_KEY?: string;
};

function readSupabaseStatus(): SupabaseStatus {
  const output = execSync("npx supabase status -o json", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  return JSON.parse(output) as SupabaseStatus;
}

function runLocalQuery<T extends Record<string, unknown>>(sql: string): T[] {
  const output = execSync(
    `npx supabase db query --local --output-format json ${JSON.stringify(sql)}`,
    {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const parsed = JSON.parse(output) as { rows?: T[] };
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
  const status = readSupabaseStatus();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? status.API_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? status.ANON_KEY;

  assert(url, "Supabase API URL is required");
  assert(serviceRoleKey, "Supabase service role key is required");
  assert(anonKey, "Supabase anon key is required");

  const ownerUserId = "f1000000-0000-0000-0000-000000000099";
  const ownerEmail = "n1a-worker-integration@example.test";

  runLocalSql(
    `insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous) values ('${ownerUserId}', '${ownerEmail}', statement_timestamp(), statement_timestamp(), statement_timestamp(), '{"provider":"email","providers":["email"]}', '{}', false, false) on conflict (id) do nothing;`,
  );

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: organisationId, error: provisionError } =
    await serviceClient.rpc("provision_organisation", {
      owner_user_id: ownerUserId,
      organisation_code: "n1a-worker-integration",
      organisation_name: "N1a Worker Integration Org",
    });

  if (provisionError && !provisionError.message.includes("duplicate key")) {
    throw provisionError;
  }

  const resolvedOrganisationId =
    (organisationId as string | null) ??
    runLocalQuery<{ id: string }>(
      `select id::text from public.organisations where code = 'n1a-worker-integration' limit 1;`,
    )[0]?.id;

  assert(
    resolvedOrganisationId,
    "organisation id is required for integration test",
  );

  const eventRows = runLocalQuery<{ event_id: string }>(
    `select private.enqueue_domain_event('${resolvedOrganisationId}'::uuid, null, 'IntegrationWorkerEvent', 'n1a-worker-integration-event', '{"integration":true}'::jsonb)::text as event_id;`,
  );

  const eventId = eventRows[0]?.event_id;
  assert(eventId, "event id is required for integration test");

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
