import "server-only";

import { createServerSupabaseClient } from "@/platform/supabase/server";

import type { WorkplaceModuleKey } from "./access";
import { readWorkplacePage } from "./page-query";

export const WORKPLACE_FEED_PAGE_SIZE = 25;

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
  page?: unknown;
  page_size?: unknown;
  has_more?: unknown;
};

export type WorkplaceFeedResult =
  | {
      status: "ready";
      records: WorkplaceFeedRecord[];
      page: number;
      pageSize: number;
      hasMore: boolean;
    }
  | { status: "error"; message: string };

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

export async function loadWorkplaceFeed(
  module: WorkplaceModuleKey,
  page = 1,
): Promise<WorkplaceFeedResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_workplace_feed", {
    target_module: module,
    target_page: page,
  });

  if (error) {
    return {
      status: "error",
      message: "Workplace records could not be loaded.",
    };
  }

  const payload = data as FeedPayload | null;
  const records = Array.isArray(payload?.records)
    ? payload.records
        .map(readRecord)
        .filter((record): record is WorkplaceFeedRecord => record !== null)
    : [];

  return {
    status: "ready",
    records,
    page: typeof payload?.page === "number" ? payload.page : page,
    pageSize:
      typeof payload?.page_size === "number"
        ? payload.page_size
        : WORKPLACE_FEED_PAGE_SIZE,
    hasMore: payload?.has_more === true,
  };
}

export async function loadWorkplaceFeedPage(module: WorkplaceModuleKey) {
  return loadWorkplaceFeed(module, await readWorkplacePage());
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
