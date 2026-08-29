import "server-only";

import { createHmac } from "node:crypto";

import { headers } from "next/headers";

import { getServerEnvironment } from "@/platform/env";
import {
  authenticationRateLimitAllows,
  consumeAuthenticationRateLimit,
  recordAuthenticationRateLimitFailure,
  releaseAuthenticationRateLimit,
} from "@/platform/supabase/secret";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  invitationPathFromToken,
  INVITATION_TOKEN_PATTERN,
} from "./invitation-constants";
import { invitationTokenDigest } from "./invitations";

export type InvitationPreviewState =
  "invalid" | "valid" | "expired" | "revoked" | "accepted";

export type InvitationSessionState =
  | "unauthenticated"
  | "wrong_account"
  | "email_unconfirmed"
  | "already_member"
  | "ready_to_accept";

export type InvitationLifecycleView = {
  state: InvitationPreviewState;
  sessionState?: InvitationSessionState | undefined;
  organisationName?: string | undefined;
  recipientEmail?: string | undefined;
  recipientEmailMasked?: string | undefined;
  roleDisplayName?: string | undefined;
  scopeLabel?: string | undefined;
  expiresAt?: string | undefined;
  organisationId?: string | undefined;
};

function hashRateLimitKey(dimension: string, value: string) {
  const pepper = getServerEnvironment().AUTH_RATE_LIMIT_PEPPER;
  return `\\x${createHmac("sha256", pepper)
    .update(`${dimension}:${value}`)
    .digest("hex")}`;
}

async function consumeInvitationRateLimit(token: string) {
  const environment = getServerEnvironment();
  const signals: Array<{
    dimension: "ip" | "recipient";
    keyHash: string;
    maximumAttempts: number;
  }> = [
    {
      dimension: "recipient",
      keyHash: hashRateLimitKey("token", token),
      maximumAttempts: 30,
    },
  ];

  if (environment.TRUSTED_PROXY_IP_HEADER) {
    const requestHeaders = await headers();
    const sourceIp = requestHeaders.get(environment.TRUSTED_PROXY_IP_HEADER);
    if (sourceIp) {
      signals.push({
        dimension: "ip",
        keyHash: hashRateLimitKey("ip", sourceIp),
        maximumAttempts: 60,
      });
    }
  }

  const reservations: typeof signals = [];
  for (const signal of signals) {
    const allowed = await authenticationRateLimitAllows(
      "invitation",
      signal.dimension,
      signal.keyHash,
      signal.maximumAttempts,
    );
    if (allowed.error || allowed.data !== true) {
      return false;
    }

    const reservation = await consumeAuthenticationRateLimit(
      "invitation",
      signal.dimension,
      signal.keyHash,
      signal.maximumAttempts,
    );
    if (reservation.error || reservation.data !== true) {
      await Promise.all(
        reservations.map((entry) =>
          releaseAuthenticationRateLimit(
            "invitation",
            entry.dimension,
            entry.keyHash,
            entry.maximumAttempts,
          ),
        ),
      );
      return false;
    }
    reservations.push(signal);
  }

  return true;
}

async function releaseInvitationPreviewRateLimit(token: string) {
  const environment = getServerEnvironment();
  const signals: Array<{
    dimension: "ip" | "recipient";
    keyHash: string;
    maximumAttempts: number;
  }> = [
    {
      dimension: "recipient",
      keyHash: hashRateLimitKey("token", token),
      maximumAttempts: 30,
    },
  ];

  if (environment.TRUSTED_PROXY_IP_HEADER) {
    const requestHeaders = await headers();
    const sourceIp = requestHeaders.get(environment.TRUSTED_PROXY_IP_HEADER);
    if (sourceIp) {
      signals.push({
        dimension: "ip",
        keyHash: hashRateLimitKey("ip", sourceIp),
        maximumAttempts: 60,
      });
    }
  }

  await Promise.all(
    signals.map((signal) =>
      releaseAuthenticationRateLimit(
        "invitation",
        signal.dimension,
        signal.keyHash,
        signal.maximumAttempts,
      ),
    ),
  );
}

export async function recordInvitationPreviewFailure(token: string) {
  const environment = getServerEnvironment();
  const signals: Array<{
    dimension: "ip" | "recipient";
    keyHash: string;
    maximumAttempts: number;
  }> = [
    {
      dimension: "recipient",
      keyHash: hashRateLimitKey("token", token),
      maximumAttempts: 30,
    },
  ];

  if (environment.TRUSTED_PROXY_IP_HEADER) {
    const requestHeaders = await headers();
    const sourceIp = requestHeaders.get(environment.TRUSTED_PROXY_IP_HEADER);
    if (sourceIp) {
      signals.push({
        dimension: "ip",
        keyHash: hashRateLimitKey("ip", sourceIp),
        maximumAttempts: 60,
      });
    }
  }

  await Promise.all(
    signals.map((signal) =>
      recordAuthenticationRateLimitFailure(
        "invitation",
        signal.dimension,
        signal.keyHash,
        signal.maximumAttempts,
      ),
    ),
  );
}

function mapPreviewPayload(
  payload: Record<string, unknown> | null,
): InvitationLifecycleView {
  if (!payload || typeof payload.state !== "string") {
    return { state: "invalid" };
  }

  return {
    state: payload.state as InvitationPreviewState,
    sessionState:
      typeof payload.session_state === "string"
        ? (payload.session_state as InvitationSessionState)
        : undefined,
    organisationName:
      typeof payload.organisation_name === "string"
        ? payload.organisation_name
        : undefined,
    recipientEmail:
      typeof payload.recipient_email === "string"
        ? payload.recipient_email
        : undefined,
    recipientEmailMasked:
      typeof payload.recipient_email_masked === "string"
        ? payload.recipient_email_masked
        : undefined,
    roleDisplayName:
      typeof payload.role_display_name === "string"
        ? payload.role_display_name
        : undefined,
    scopeLabel:
      typeof payload.scope_label === "string" ? payload.scope_label : undefined,
    expiresAt:
      typeof payload.expires_at === "string" ? payload.expires_at : undefined,
    organisationId:
      typeof payload.organisation_id === "string"
        ? payload.organisation_id
        : undefined,
  };
}

export async function loadInvitationLifecycle(
  token: string,
  options: { authenticated?: boolean } = {},
): Promise<InvitationLifecycleView> {
  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    return { state: "invalid" };
  }

  const allowed = await consumeInvitationRateLimit(token);
  if (!allowed) {
    return { state: "invalid" };
  }

  const supabase = await createServerSupabaseClient();
  const rpcName = options.authenticated
    ? "resolve_organisation_invitation_session"
    : "preview_organisation_invitation";

  const { data, error } = await supabase.rpc(rpcName, {
    invitation_token_digest: invitationTokenDigest(token),
  });

  if (error) {
    await recordInvitationPreviewFailure(token);
    return { state: "invalid" };
  }

  return mapPreviewPayload(data as Record<string, unknown> | null);
}

export async function loadInvitationSignupBinding(
  bindingId: string,
): Promise<InvitationLifecycleView> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "resolve_organisation_invitation_signup_binding",
    {
      target_binding_id: bindingId,
    },
  );

  if (error) {
    return { state: "invalid" };
  }

  return mapPreviewPayload(data as Record<string, unknown> | null);
}

export function invitationLoginPath(token: string) {
  return `/login?next=${encodeURIComponent(invitationPathFromToken(token))}`;
}

export function invitationActivatePath(token: string) {
  return `/invitations/${token}/activate`;
}
