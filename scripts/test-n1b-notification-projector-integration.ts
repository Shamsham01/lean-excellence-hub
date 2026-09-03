#!/usr/bin/env node
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/platform/supabase/database.types";
import { runNotificationProjector } from "../supabase/functions/_shared/notification-projector/handler.ts";
import { createNotificationProjectorWorkerClient } from "../supabase/functions/_shared/notification-projector/worker-client.ts";
import {
  JOB_FUNCTION_ASSIGNED_KIND,
  projectJobFunctionAssigned,
} from "../supabase/functions/_shared/notification-projector/projectors/job-function-assigned.ts";
import type { ClaimedDomainEvent } from "../supabase/functions/_shared/notification-projector/types.ts";

type SupabaseStatus = {
  API_URL?: string;
  SERVICE_ROLE_KEY?: string;
};

type DbQueryResult = {
  rows?: Record<string, unknown>[];
  error?: { message?: string };
  _tag?: string;
};

function extractJsonValue(output: string): string {
  const objectStart = output.indexOf("{");
  const arrayStart = output.indexOf("[");

  if (objectStart === -1 && arrayStart === -1) {
    throw new Error(`unexpected supabase command output: ${output}`);
  }

  const jsonStart =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);
  const opener = output[jsonStart];
  const closer = opener === "[" ? "]" : "}";

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

    if (character === opener) {
      depth += 1;
      continue;
    }

    if (character === closer) {
      depth -= 1;
      if (depth === 0) {
        return output.slice(jsonStart, index + 1);
      }
    }
  }

  throw new Error(
    `incomplete JSON value in supabase command output: ${output}`,
  );
}

function parseJsonObject<T>(output: string): T {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new Error("supabase command returned empty output");
  }

  return JSON.parse(extractJsonValue(trimmed)) as T;
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

  const parsed = parseJsonObject<DbQueryResult | Record<string, unknown>[]>(
    output,
  );

  if (Array.isArray(parsed)) {
    return { rows: parsed };
  }

  return parsed;
}

function runLocalQuery<T extends Record<string, unknown>>(
  sql: string,
  context: string,
): T[] {
  const queryDirectory = mkdtempSync(join(tmpdir(), "n1b-projector-query-"));
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

  return (parsed.rows ?? []) as T[];
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

  throw created.error;
}

async function main() {
  const status = readSupabaseStatus();
  const url = status.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    status.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  assert(url, "Supabase API URL is required");
  assert(serviceRoleKey, "Supabase service role key is required");

  const ownerUserId = "f2000000-0000-0000-0000-000000000099";
  const ownerEmail = "n1b-projector-integration@example.test";
  const organisationCode = `n1b-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const idempotencyKey = `n1b-projector-${randomUUID()}`;

  const serviceClient = createClient<Database>(url, serviceRoleKey, {
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
      organisation_name: "N1b Projector Integration Org",
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

  assert(resolvedOrganisationId, "organisation id is required");

  const membershipId =
    runLocalQuery<{ membership_id: string }>(
      `select id::text as membership_id
       from public.organisation_memberships
       where organisation_id = '${resolvedOrganisationId}'::uuid
         and user_id = '${ownerUserId}'::uuid
       limit 1;`,
      "resolve owner membership",
    )[0]?.membership_id ?? null;

  assert(membershipId, "membership id is required");

  const eventId =
    runLocalQuery<{ event_id: string }>(
      `insert into private.domain_event_outbox (
         organisation_id,
         event_type,
         idempotency_key,
         payload
       )
       values (
         '${resolvedOrganisationId}'::uuid,
         'JobFunctionAssigned',
         '${idempotencyKey}',
         jsonb_build_object('membership_id', '${membershipId}')
       )
       returning id::text as event_id;`,
      "enqueue JobFunctionAssigned event",
    )[0]?.event_id ?? null;

  assert(eventId, "event id is required");

  const workerClient = createNotificationProjectorWorkerClient({
    rpc: (fn, args) =>
      serviceClient.rpc(
        fn as keyof Database["public"]["Functions"],
        args as never,
      ),
    lookupRecognitionRecipients: async () => [],
    lookupSuggestionAuthorMembershipId: async () => null,
  });

  const firstRun = await runNotificationProjector(workerClient, 1000);
  const firstProcessed = firstRun.events.find(
    (event) => event.eventId === eventId,
  );

  assert(firstProcessed, "first worker run must process the enqueued event");
  assert(firstProcessed.outcome === "completed", "event must complete");
  assert(firstProcessed.deliveryCount === 1, "one delivery must be created");

  const expectedDeliveryKey = projectJobFunctionAssigned({
    organisationId: resolvedOrganisationId,
    eventId,
    resourceRecordId: null,
    eventType: "JobFunctionAssigned",
    payload: { membership_id: membershipId },
    leaseToken: "unused",
    attemptCount: 1,
  } satisfies ClaimedDomainEvent);

  if (expectedDeliveryKey.kind !== "project") {
    throw new Error("expected delivery projection");
  }

  const deliveryCountAfterFirstRun = runLocalQuery<{ delivery_count: string }>(
    `select count(*)::text as delivery_count
     from private.notification_delivery_ledger
     where organisation_id = '${resolvedOrganisationId}'::uuid
       and source_domain_event_id = '${eventId}'::uuid
       and delivery_key = '${expectedDeliveryKey.intents[0]?.deliveryKey}';`,
    "count deliveries after first run",
  )[0]?.delivery_count;

  assert(
    deliveryCountAfterFirstRun === "1",
    "delivery ledger must contain exactly one row",
  );

  const eventStateAfterFirstRun = runLocalQuery<{ processing_state: string }>(
    `select processing_state
     from private.domain_event_outbox
     where id = '${eventId}'::uuid;`,
    "read event state after first run",
  )[0]?.processing_state;

  assert(
    eventStateAfterFirstRun === "processed",
    "event must be marked processed after first run",
  );

  const secondRun = await runNotificationProjector(workerClient, 1000);
  assert(
    secondRun.deliveriesCreated === 0,
    "second worker run must not create duplicate deliveries",
  );

  const deliveryCountAfterSecondRun = runLocalQuery<{ delivery_count: string }>(
    `select count(*)::text as delivery_count
     from private.notification_delivery_ledger
     where organisation_id = '${resolvedOrganisationId}'::uuid
       and source_domain_event_id = '${eventId}'::uuid;`,
    "count deliveries after second run",
  )[0]?.delivery_count;

  assert(
    deliveryCountAfterSecondRun === "1",
    "delivery ledger must remain idempotent after re-invocation",
  );

  const deliveryKind = runLocalQuery<{ notification_kind: string }>(
    `select notification_kind
     from private.notification_delivery_ledger
     where organisation_id = '${resolvedOrganisationId}'::uuid
       and source_domain_event_id = '${eventId}'::uuid
     limit 1;`,
    "read delivery kind",
  )[0]?.notification_kind;

  assert(
    deliveryKind === JOB_FUNCTION_ASSIGNED_KIND,
    "delivery kind must match projector output",
  );

  console.log("N1b notification projector integration: PASS");
}

main().catch((error: unknown) => {
  console.error("N1b notification projector integration: FAIL");
  console.error(error);
  process.exit(1);
});
