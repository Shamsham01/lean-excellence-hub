import "server-only";

import { createServerSupabaseClient } from "@/platform/supabase/server";

import type { WorkplaceModuleKey } from "./access";

export type WorkplaceFeedRecord = {
  id: string;
  title: string;
  status: string;
  scopeName: string | null;
  summary: string | null;
  occurredAt: string | null;
};

type FeedPayload = {
  records?: unknown;
};

function readRecord(value: unknown): WorkplaceFeedRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.title !== "string") {
    return null;
  }
  return {
    id: record.id,
    title: record.title,
    status: typeof record.status === "string" ? record.status : "",
    scopeName: typeof record.scope_name === "string" ? record.scope_name : null,
    summary: typeof record.summary === "string" ? record.summary : null,
    occurredAt:
      typeof record.occurred_at === "string" ? record.occurred_at : null,
  };
}

export async function loadWorkplaceFeed(module: WorkplaceModuleKey): Promise<
  | { status: "ready"; records: WorkplaceFeedRecord[] }
  | { status: "error"; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_workplace_feed", {
    target_module: module,
  });

  if (error) {
    return {
      status: "error",
      message: "Workplace records could not be loaded.",
    };
  }

  const records = Array.isArray((data as FeedPayload | null)?.records)
    ? ((data as FeedPayload).records as unknown[])
        .map(readRecord)
        .filter((record): record is WorkplaceFeedRecord => record !== null)
    : [];

  return { status: "ready", records };
}

export async function loadWorkplaceRecord(
  module: WorkplaceModuleKey,
  recordId: string,
): Promise<
  | { status: "ready"; record: WorkplaceFeedRecord | null }
  | { status: "error"; message: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_workplace_record", {
    target_module: module,
    target_record_id: recordId,
  });

  if (error) {
    return {
      status: "error",
      message: "This workplace record could not be loaded.",
    };
  }

  return { status: "ready", record: readRecord(data) };
}
