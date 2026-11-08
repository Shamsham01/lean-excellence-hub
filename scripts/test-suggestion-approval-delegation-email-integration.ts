#!/usr/bin/env node
/**
 * Queued (outbox/ledger) vs delivered (fake provider) for suggestion approval delegation.
 * Run after Playwright `suggestion-approval-delegation.spec.ts` (shared local DB).
 */
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/platform/supabase/database.types";
import { runNotificationDeliveryWorker } from "../supabase/functions/_shared/notification-delivery/handler.ts";
import { createFakeOperationalEmailProvider } from "../supabase/functions/_shared/notification-delivery/provider/fake.ts";
import { createNotificationDeliveryWorkerClient } from "../supabase/functions/_shared/notification-delivery/worker-client.ts";
import { runNotificationProjector } from "../supabase/functions/_shared/notification-projector/handler.ts";
import { createNotificationProjectorWorkerClient } from "../supabase/functions/_shared/notification-projector/worker-client.ts";

const E2E_PROPOSED_TITLE = "Approval delegation end-to-end acceptance";

type SupabaseStatus = { API_URL?: string; SERVICE_ROLE_KEY?: string };

function parseJsonOutput(output: string): unknown {
  const start = output.indexOf("{");
  const arrayStart = output.indexOf("[");
  const jsonStart =
    start === -1
      ? arrayStart
      : arrayStart === -1
        ? start
        : Math.min(start, arrayStart);
  if (jsonStart < 0) {
    throw new Error(`no JSON in output: ${output}`);
  }
  return JSON.parse(output.slice(jsonStart));
}

function runLocalQuery<T extends Record<string, unknown>>(
  sql: string,
  context: string,
): T[] {
  const dir = mkdtempSync(join(tmpdir(), "suggestion-approval-email-"));
  const queryFile = join(dir, "query.sql");
  writeFileSync(queryFile, sql);
  try {
    const stdout = execSync(
      `npx supabase db query --local --output-format json -f ${JSON.stringify(queryFile)}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const parsed = parseJsonOutput(stdout) as {
      rows?: T[];
      error?: { message?: string };
    };
    if (parsed.error?.message) {
      throw new Error(`${context}: ${parsed.error.message}`);
    }
    return parsed.rows ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readSupabaseStatus(): SupabaseStatus {
  const stdout = execSync("npx supabase status -o json", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "ignore"],
  });
  return parseJsonOutput(stdout) as SupabaseStatus;
}

async function main() {
  const status = readSupabaseStatus();
  const url = status.API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    status.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("local Supabase status required");
  }

  const serviceClient = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const suggestionRow = runLocalQuery<{
    suggestion_id: string;
    org_id: string;
  }>(
    `select suggestion_row.id::text as suggestion_id,
            suggestion_row.organisation_id::text as org_id
     from public.improvement_suggestions suggestion_row
     where suggestion_row.title = '${E2E_PROPOSED_TITLE.replace(/'/g, "''")}'
     order by suggestion_row.updated_at desc
     limit 1;`,
    "resolve latest e2e suggestion",
  )[0];

  if (!suggestionRow?.suggestion_id) {
    throw new Error(
      "run Playwright suggestion-approval-delegation.spec.ts before this script",
    );
  }

  const orgId = suggestionRow.org_id;
  const suggestionId = suggestionRow.suggestion_id;

  const submittedEventId = runLocalQuery<{ event_id: string }>(
    `select id::text as event_id
       from private.domain_event_outbox
       where organisation_id = '${orgId}'::uuid
         and resource_record_id = '${suggestionId}'::uuid
         and event_type = 'SuggestionSubmitted'
       limit 1;`,
    "resolve submit outbox event",
  )[0]?.event_id;

  if (!submittedEventId) {
    throw new Error("SuggestionSubmitted outbox row missing");
  }

  const projectorClient = createNotificationProjectorWorkerClient({
    rpc: (fn, args) =>
      serviceClient.rpc(
        fn as keyof Database["public"]["Functions"],
        args as never,
      ),
    lookupRecognitionRecipients: async () => [],
    lookupSuggestionAuthorMembershipId: async () => null,
    lookupSuggestionApprovalRecipients: async (organisationId, sugId) => {
      const { data, error } = await serviceClient.rpc(
        "lookup_suggestion_approval_notification_recipients_for_worker",
        {
          target_organisation_id: organisationId,
          target_suggestion_id: sugId,
        },
      );
      if (error) {
        throw error;
      }
      return (data as string[] | null) ?? [];
    },
  });

  await runNotificationProjector(projectorClient, 1000);

  const staleSubmitDeliveries = runLocalQuery<{ count: string }>(
    `select count(*)::text as count
     from private.notification_delivery_ledger
     where organisation_id = '${orgId}'::uuid
       and source_domain_event_id = '${submittedEventId}'::uuid
       and notification_kind = 'suggestions.awaiting_review';`,
    "count stale submit deliveries",
  )[0]?.count;

  if (staleSubmitDeliveries !== "0") {
    throw new Error(
      `expected zero SuggestionSubmitted awaiting_review deliveries after delegation, got ${staleSubmitDeliveries}`,
    );
  }

  const reassignedEventId = runLocalQuery<{ event_id: string }>(
    `select id::text as event_id
       from private.domain_event_outbox
       where organisation_id = '${orgId}'::uuid
         and resource_record_id = '${suggestionId}'::uuid
         and event_type = 'SuggestionReviewerReassigned'
       order by created_at desc
       limit 1;`,
    "resolve reassigned event",
  )[0]?.event_id;

  assert(reassignedEventId, "SuggestionReviewerReassigned outbox row missing");

  const queuedBefore = runLocalQuery<{ count: string }>(
    `select count(*)::text as count
     from private.notification_delivery_ledger
     where organisation_id = '${orgId}'::uuid
       and source_domain_event_id = '${reassignedEventId}'::uuid;`,
    "queued deliveries before explicit projector pass",
  )[0]?.count;

  await runNotificationProjector(projectorClient, 1000);

  const queuedReassign = runLocalQuery<{ count: string }>(
    `select count(*)::text as count
     from private.notification_delivery_ledger
     where organisation_id = '${orgId}'::uuid
       and source_domain_event_id = '${reassignedEventId}'::uuid;`,
    "queued reassigned deliveries",
  )[0]?.count;

  const deliveryClient = createNotificationDeliveryWorkerClient({
    rpc: (fn, args) =>
      serviceClient.rpc(
        fn as keyof Database["public"]["Functions"],
        args as never,
      ),
  });

  const provider = createFakeOperationalEmailProvider({
    messageIdPrefix: "suggestion-approval-delegation",
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

  console.log(
    JSON.stringify(
      {
        scope: "suggestion-approval-delegation-email",
        queuedSuggestionSubmittedAwaitingReview: Number(staleSubmitDeliveries),
        queuedReassignDeliveriesBefore: Number(queuedBefore ?? "0"),
        queuedReassignDeliveriesAfterProjector: Number(queuedReassign ?? "0"),
        deliveredViaFakeProvider: deliveryRun.sent,
        providerSendCount: provider.getSendCount(),
        note: "ledger rows = queued; fake provider send count = delivered (no hosted/Mailpit in this script)",
      },
      null,
      2,
    ),
  );

  console.log("Suggestion approval delegation email integration: PASS");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
