import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnvironment, getServerEnvironment } from "@/platform/env";
import type { Database, Json } from "@/platform/supabase/database.types";

import {
  platformDirectorySchema,
  platformNotificationHistorySchema,
  platformOrganisationDetailSchema,
  platformOverviewSchema,
  type PlatformDirectory,
  type PlatformNotificationHistory,
  type PlatformOrganisationDetail,
  type PlatformOverview,
} from "./schemas";

function createSecretClient() {
  const publicEnvironment = getPublicEnvironment();
  const serverEnvironment = getServerEnvironment();
  return createClient<Database>(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    serverEnvironment.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

async function callPlatformRpc(name: string, args: Record<string, unknown>) {
  const client = createSecretClient();
  return client.rpc(name as never, args as never);
}

export async function platformAdminIdentityActive(userId: string) {
  const { data, error } = await callPlatformRpc(
    "platform_admin_identity_active",
    { target_user_id: userId },
  );
  if (error) {
    return false;
  }
  return data === true;
}

export async function recordPlatformAdminAccess(input: {
  action:
    | "console.read"
    | "directory.read"
    | "organisation.read"
    | "notifications.read"
    | "login.attempt";
  actorUserId: string | null;
  detail?: Json;
  outcome: "allowed" | "denied" | "mfa_required" | "rate_limited";
  requestPath: string | null;
  resourceId?: string | null;
}) {
  await callPlatformRpc("record_platform_admin_access", {
    actor_user_id: input.actorUserId,
    event_action: input.action,
    event_detail: input.detail ?? {},
    event_outcome: input.outcome,
    request_path: input.requestPath,
    resource_id: input.resourceId ?? null,
  });
}

export async function consumePlatformAdminRateLimit(input: {
  blockSeconds: number;
  key: string;
  maximumAttempts: number;
  windowSeconds: number;
}) {
  const { data, error } = await callPlatformRpc(
    "consume_platform_admin_rate_limit",
    {
      block_seconds: input.blockSeconds,
      limiter_key: input.key,
      maximum_attempts: input.maximumAttempts,
      window_seconds: input.windowSeconds,
    },
  );
  if (error) {
    return false;
  }
  return data === true;
}

export async function loadPlatformOverview(input: {
  requestPath: string | null;
  userId: string;
}): Promise<PlatformOverview> {
  const { data, error } = await callPlatformRpc("platform_admin_overview", {
    actor_user_id: input.userId,
    authenticator_assurance_level: "aal2",
    request_path: input.requestPath,
  });
  if (error) {
    throw new Error("Platform admin data could not be read.");
  }
  return platformOverviewSchema.parse(data);
}

export async function loadPlatformDirectory(input: {
  limit: number;
  offset: number;
  requestPath: string | null;
  search: string | null;
  status: string | null;
  userId: string;
}): Promise<PlatformDirectory> {
  const { data, error } = await callPlatformRpc(
    "platform_admin_organisation_directory",
    {
      actor_user_id: input.userId,
      authenticator_assurance_level: "aal2",
      request_path: input.requestPath,
      result_limit: input.limit,
      result_offset: input.offset,
      search: input.search,
      status_filter: input.status,
    },
  );
  if (error) {
    throw new Error("Platform admin data could not be read.");
  }
  return platformDirectorySchema.parse(data);
}

export async function loadPlatformOrganisationDetail(input: {
  organisationId: string;
  requestPath: string | null;
  userId: string;
}): Promise<PlatformOrganisationDetail> {
  const { data, error } = await callPlatformRpc(
    "platform_admin_organisation_detail",
    {
      actor_user_id: input.userId,
      authenticator_assurance_level: "aal2",
      request_path: input.requestPath,
      target_organisation_id: input.organisationId,
    },
  );
  if (error) {
    throw new Error("Platform admin data could not be read.");
  }
  return platformOrganisationDetailSchema.parse(data);
}

export async function loadPlatformNotificationHistory(input: {
  limit: number;
  offset: number;
  requestPath: string | null;
  userId: string;
}): Promise<PlatformNotificationHistory> {
  const { data, error } = await callPlatformRpc(
    "platform_admin_notification_history",
    {
      actor_user_id: input.userId,
      authenticator_assurance_level: "aal2",
      request_path: input.requestPath,
      result_limit: input.limit,
      result_offset: input.offset,
    },
  );
  if (error) {
    throw new Error("Platform admin data could not be read.");
  }
  return platformNotificationHistorySchema.parse(data);
}
