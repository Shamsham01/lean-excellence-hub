#!/usr/bin/env node
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/platform/supabase/database.types";
import {
  processClaimedNotificationDelivery,
  runNotificationDeliveryWorker,
} from "../supabase/functions/_shared/notification-delivery/handler.ts";
import { createFakeOperationalEmailProvider } from "../supabase/functions/_shared/notification-delivery/provider/fake.ts";
import { createNotificationDeliveryWorkerClient } from "../supabase/functions/_shared/notification-delivery/worker-client.ts";
import { runNotificationProjector } from "../supabase/functions/_shared/notification-projector/handler.ts";
import { createNotificationProjectorWorkerClient } from "../supabase/functions/_shared/notification-projector/worker-client.ts";

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
  const queryDirectory = mkdtempSync(join(tmpdir(), "n1c-delivery-query-"));
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

  const ownerUserId = "f3000000-0000-0000-0000-000000000099";
  const ownerEmail = "n1c-delivery-integration@example.test";
  const organisationCode = `n1c-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const idempotencyKey = `n1c-delivery-${randomUUID()}`;

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
      organisation_name: "N1c Delivery Integration Org",
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

  const projectorClient = createNotificationProjectorWorkerClient({
    rpc: (fn, args) =>
      serviceClient.rpc(
        fn as keyof Database["public"]["Functions"],
        args as never,
      ),
    lookupRecognitionRecipients: async () => [],
    lookupSuggestionAuthorMembershipId: async () => null,
  });

  const projectionRun = await runNotificationProjector(projectorClient, 1000);
  assert(
    projectionRun.deliveriesCreated === 1,
    "N1b must create one pending delivery",
  );

  const deliveryRow =
    runLocalQuery<{
      delivery_id: string;
      delivery_key: string;
      status: string;
    }>(
      `select id::text as delivery_id, delivery_key, status
       from private.notification_delivery_ledger
       where organisation_id = '${resolvedOrganisationId}'::uuid
         and source_domain_event_id = '${eventId}'::uuid
       limit 1;`,
      "read pending delivery",
    )[0] ?? null;

  assert(deliveryRow, "pending delivery row is required");
  assert(deliveryRow.status === "pending", "delivery must start pending");

  const deliveryClient = createNotificationDeliveryWorkerClient({
    rpc: (fn, args) =>
      serviceClient.rpc(
        fn as keyof Database["public"]["Functions"],
        args as never,
      ),
  });

  const provider = createFakeOperationalEmailProvider({
    messageIdPrefix: "n1c-integration",
  });

  const deliveryRun = await runNotificationDeliveryWorker(
    deliveryClient,
    provider,
    {
      appOrigin: "http://127.0.0.1:3000",
      operationalEmailFrom: "Lean Excellence Hub <notifications@example.test>",
    },
    10,
  );

  assert(deliveryRun.sent >= 1, "N1c must send at least one delivery");

  const sentRow =
    runLocalQuery<{
      status: string;
      provider_message_id: string | null;
    }>(
      `select status, provider_message_id
       from private.notification_delivery_ledger
       where id = '${deliveryRow.delivery_id}'::uuid;`,
      "read sent delivery",
    )[0] ?? null;

  assert(sentRow?.status === "sent", "delivery must be marked sent");
  assert(sentRow.provider_message_id, "provider message id must be stored");
  assert(
    provider.getSendsByKey().has(deliveryRow.delivery_key),
    "provider must receive delivery_key as idempotency key",
  );

  const payloadStabilityEventId =
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
         '${idempotencyKey}-payload-stability',
         jsonb_build_object('membership_id', '${membershipId}')
       )
       returning id::text as event_id;`,
      "enqueue payload-stability event",
    )[0]?.event_id ?? null;

  assert(payloadStabilityEventId, "payload stability event id is required");
  await runNotificationProjector(projectorClient, 1000);

  const payloadStabilityDelivery =
    runLocalQuery<{
      delivery_id: string;
      delivery_key: string;
    }>(
      `select id::text as delivery_id, delivery_key
       from private.notification_delivery_ledger
       where organisation_id = '${resolvedOrganisationId}'::uuid
         and source_domain_event_id = '${payloadStabilityEventId}'::uuid
       limit 1;`,
      "read payload-stability delivery",
    )[0] ?? null;

  assert(payloadStabilityDelivery, "payload stability delivery is required");

  const payloadProvider = createFakeOperationalEmailProvider({
    messageIdPrefix: "n1c-payload-stability",
  });

  let payloadCompleteCalls = 0;
  const payloadClient = createNotificationDeliveryWorkerClient({
    rpc: async (fn, args) => {
      if (fn === "complete_notification_delivery_for_worker") {
        payloadCompleteCalls += 1;
        if (payloadCompleteCalls === 1) {
          return { data: false, error: null };
        }
      }

      return serviceClient.rpc(
        fn as keyof Database["public"]["Functions"],
        args as never,
      );
    },
  });

  const payloadClaimRows = runLocalQuery<{
    organisation_id: string;
    delivery_id: string;
    source_domain_event_id: string;
    recipient_membership_id: string;
    notification_kind: string;
    delivery_key: string;
    lease_token: string;
    attempt_count: number;
  }>(
    `select *
     from public.claim_notification_deliveries_for_worker(10);`,
    "claim payload-stability delivery",
  ).filter((row) => row.delivery_id === payloadStabilityDelivery.delivery_id);

  assert(payloadClaimRows[0], "payload stability delivery must be claimable");

  const firstPayloadAttempt = await processClaimedNotificationDelivery(
    payloadClient,
    payloadProvider,
    {
      appOrigin: "http://127.0.0.1:3000",
      operationalEmailFrom: "Lean Excellence Hub <notifications@example.test>",
    },
    {
      organisationId: payloadClaimRows[0].organisation_id,
      deliveryId: payloadClaimRows[0].delivery_id,
      sourceDomainEventId: payloadClaimRows[0].source_domain_event_id,
      recipientMembershipId: payloadClaimRows[0].recipient_membership_id,
      notificationKind: payloadClaimRows[0].notification_kind,
      deliveryKey: payloadClaimRows[0].delivery_key,
      leaseToken: payloadClaimRows[0].lease_token,
      attemptCount: payloadClaimRows[0].attempt_count,
    },
  );

  assert(
    firstPayloadAttempt.outcome === "fencing_loss_after_provider_accept",
    "payload stability first attempt must accept provider then lose lease",
  );

  const firstProviderPayload = payloadProvider
    .getSendsByKey()
    .get(payloadStabilityDelivery.delivery_key)?.message;

  assert(firstProviderPayload, "first provider payload must be captured");

  runLocalQuery(
    `update public.organisation_memberships
     set display_name = 'Mutated Display Name'
     where id = '${membershipId}'::uuid;`,
    "mutate membership display name",
  );

  runLocalQuery(
    `insert into public.membership_notification_contacts (
       organisation_id,
       membership_id,
       channel_type,
       contact_address,
       status,
       source
     )
     values (
       '${resolvedOrganisationId}'::uuid,
       '${membershipId}'::uuid,
       'email',
       'mutated-contact@example.test',
       'active',
       'manual'
     )
     on conflict (organisation_id, membership_id, channel_type)
     do update set contact_address = excluded.contact_address,
                   status = 'active',
                   updated_at = statement_timestamp();`,
    "mutate notification contact",
  );

  runLocalQuery(
    `update private.notification_delivery_ledger
     set status = 'pending',
         lease_token = null,
         lease_expires_at = null,
         processing_started_at = null,
         available_at = statement_timestamp()
     where id = '${payloadStabilityDelivery.delivery_id}'::uuid;`,
    "requeue payload-stability delivery",
  );

  const payloadRetryRun = await runNotificationDeliveryWorker(
    deliveryClient,
    payloadProvider,
    {
      appOrigin: "http://127.0.0.1:3000",
      operationalEmailFrom: "Lean Excellence Hub <notifications@example.test>",
    },
    10,
  );

  assert(
    payloadRetryRun.sent >= 1,
    "payload stability delivery must eventually send",
  );

  const retryProviderPayload = payloadProvider
    .getSendsByKey()
    .get(payloadStabilityDelivery.delivery_key)?.message;

  assert(retryProviderPayload, "retry provider payload must exist");
  assert(
    JSON.stringify(retryProviderPayload) ===
      JSON.stringify(firstProviderPayload),
    "retry must reuse exact same provider payload after live data mutation",
  );
  assert(
    payloadProvider.getSendsByKey().size === 1,
    "provider idempotency must keep one logical send for the delivery key",
  );

  const envelopeRow =
    runLocalQuery<{ recipient_email: string; subject: string }>(
      `select recipient_email, subject
       from private.notification_delivery_provider_envelopes
       where delivery_id = '${payloadStabilityDelivery.delivery_id}'::uuid;`,
      "read immutable provider envelope",
    )[0] ?? null;

  assert(envelopeRow, "provider envelope must exist");
  assert(
    envelopeRow.recipient_email !== "mutated-contact@example.test",
    "stored envelope must not reflect post-send contact mutation",
  );

  const workforceUserId = randomUUID();
  const workforceMembershipId = randomUUID();
  const syntheticEmail = `${randomUUID().replaceAll("-", "")}@workforce.invalid`;

  runLocalQuery(
    `insert into auth.users (
       id, email, email_confirmed_at, created_at, updated_at,
       raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
     )
     values (
       '${workforceUserId}',
       '${syntheticEmail}',
       statement_timestamp(), statement_timestamp(), statement_timestamp(),
       '{"provider":"email","providers":["email"]}', '{}', false, false
     );`,
    "create synthetic workforce auth user",
  );

  runLocalQuery(
    `insert into public.organisation_memberships (
       id, organisation_id, user_id, display_name, status, activated_at
     )
     values (
       '${workforceMembershipId}',
       '${resolvedOrganisationId}'::uuid,
       '${workforceUserId}'::uuid,
       'Synthetic Workforce',
       'active',
       statement_timestamp()
     );`,
    "create synthetic workforce membership",
  );

  runLocalQuery(
    `insert into private.workforce_accounts (
       user_id, internal_login_identifier, status
     )
     values (
       '${workforceUserId}'::uuid,
       '${syntheticEmail}',
       'active'
     );`,
    "create synthetic workforce account",
  );

  const terminalEventId =
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
         '${idempotencyKey}-terminal',
         jsonb_build_object('membership_id', '${workforceMembershipId}')
       )
       returning id::text as event_id;`,
      "enqueue terminal-path event",
    )[0]?.event_id ?? null;

  assert(terminalEventId, "terminal event id is required");

  await runNotificationProjector(projectorClient, 1000);

  const terminalDelivery =
    runLocalQuery<{ delivery_id: string }>(
      `select id::text as delivery_id
       from private.notification_delivery_ledger
       where organisation_id = '${resolvedOrganisationId}'::uuid
         and source_domain_event_id = '${terminalEventId}'::uuid
       limit 1;`,
      "read terminal delivery",
    )[0] ?? null;

  assert(terminalDelivery, "terminal delivery row is required");

  const terminalRun = await runNotificationDeliveryWorker(
    deliveryClient,
    provider,
    {
      appOrigin: "http://127.0.0.1:3000",
      operationalEmailFrom: "Lean Excellence Hub <notifications@example.test>",
    },
    10,
  );

  assert(
    terminalRun.failedTerminal >= 1,
    "synthetic workforce recipient must terminal-fail",
  );

  const terminalStatus =
    runLocalQuery<{ status: string; last_error_code: string | null }>(
      `select status, last_error_code
       from private.notification_delivery_ledger
       where id = '${terminalDelivery.delivery_id}'::uuid;`,
      "read terminal delivery status",
    )[0] ?? null;

  assert(
    terminalStatus?.status === "needs_remediation",
    "terminal delivery must need remediation",
  );
  assert(
    terminalStatus?.last_error_code === "synthetic_auth_email",
    "terminal delivery must record synthetic auth email reason",
  );

  const fencingEventId =
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
         '${idempotencyKey}-fencing',
         jsonb_build_object('membership_id', '${membershipId}')
       )
       returning id::text as event_id;`,
      "enqueue fencing-path event",
    )[0]?.event_id ?? null;

  assert(fencingEventId, "fencing event id is required");
  await runNotificationProjector(projectorClient, 1000);

  const fencingDelivery =
    runLocalQuery<{
      delivery_id: string;
      delivery_key: string;
    }>(
      `select id::text as delivery_id, delivery_key
       from private.notification_delivery_ledger
       where organisation_id = '${resolvedOrganisationId}'::uuid
         and source_domain_event_id = '${fencingEventId}'::uuid
       limit 1;`,
      "read fencing delivery",
    )[0] ?? null;

  assert(fencingDelivery, "fencing delivery row is required");

  const claimRows = runLocalQuery<{
    organisation_id: string;
    delivery_id: string;
    source_domain_event_id: string;
    recipient_membership_id: string;
    notification_kind: string;
    delivery_key: string;
    lease_token: string;
    attempt_count: number;
  }>(
    `select *
     from public.claim_notification_deliveries_for_worker(10);`,
    "claim fencing delivery",
  ).filter((row) => row.delivery_id === fencingDelivery.delivery_id);

  assert(claimRows[0], "fencing delivery must be claimable");

  const fencingProvider = createFakeOperationalEmailProvider({
    messageIdPrefix: "n1c-fencing",
  });

  let completeCalls = 0;
  const fencingClient = createNotificationDeliveryWorkerClient({
    rpc: async (fn, args) => {
      if (fn === "complete_notification_delivery_for_worker") {
        completeCalls += 1;
        if (completeCalls === 1) {
          return { data: false, error: null };
        }
      }

      return serviceClient.rpc(
        fn as keyof Database["public"]["Functions"],
        args as never,
      );
    },
  });

  const firstFencingAttempt = await processClaimedNotificationDelivery(
    fencingClient,
    fencingProvider,
    {
      appOrigin: "http://127.0.0.1:3000",
      operationalEmailFrom: "Lean Excellence Hub <notifications@example.test>",
    },
    {
      organisationId: claimRows[0].organisation_id,
      deliveryId: claimRows[0].delivery_id,
      sourceDomainEventId: claimRows[0].source_domain_event_id,
      recipientMembershipId: claimRows[0].recipient_membership_id,
      notificationKind: claimRows[0].notification_kind,
      deliveryKey: claimRows[0].delivery_key,
      leaseToken: claimRows[0].lease_token,
      attemptCount: claimRows[0].attempt_count,
    },
  );

  assert(
    firstFencingAttempt.outcome === "fencing_loss_after_provider_accept",
    "first fencing attempt must report lease loss after provider accept",
  );
  assert(
    fencingProvider.getSendsByKey().size === 1,
    "provider must accept the first fencing send",
  );

  runLocalQuery(
    `update private.notification_delivery_ledger
     set status = 'pending',
         lease_token = null,
         lease_expires_at = null,
         processing_started_at = null,
         available_at = statement_timestamp()
     where id = '${fencingDelivery.delivery_id}'::uuid;`,
    "requeue fencing delivery for reclaim",
  );

  const reclaimRun = await runNotificationDeliveryWorker(
    deliveryClient,
    fencingProvider,
    {
      appOrigin: "http://127.0.0.1:3000",
      operationalEmailFrom: "Lean Excellence Hub <notifications@example.test>",
    },
    10,
  );

  assert(reclaimRun.sent >= 1, "reclaimed delivery must eventually complete");

  const fencingStatus =
    runLocalQuery<{ status: string; provider_message_id: string | null }>(
      `select status, provider_message_id
       from private.notification_delivery_ledger
       where id = '${fencingDelivery.delivery_id}'::uuid;`,
      "read reclaimed fencing delivery",
    )[0] ?? null;

  assert(fencingStatus?.status === "sent", "reclaimed delivery must be sent");
  assert(
    fencingProvider.getSendsByKey().size === 1,
    "provider idempotency must prevent duplicate logical send",
  );

  console.log("N1c notification delivery integration: PASS");
}

main().catch((error: unknown) => {
  console.error("N1c notification delivery integration: FAIL");
  console.error(error);
  process.exit(1);
});
