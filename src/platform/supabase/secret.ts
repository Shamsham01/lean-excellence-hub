import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnvironment, getServerEnvironment } from "@/platform/env";
import type { Database } from "@/platform/supabase/database.types";

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

export async function consumeAuthenticationRateLimit(
  purpose: "workforce_login" | "password_recovery" | "invitation",
  dimension: "ip" | "organisation_code" | "alias" | "account" | "recipient",
  keyHash: string,
  maximumAttempts = 10,
) {
  return createSecretClient().rpc("consume_authentication_rate_limit", {
    limiter_purpose: purpose,
    limiter_dimension: dimension,
    limiter_key_hash: keyHash,
    maximum_attempts: maximumAttempts,
    window_seconds: 300,
    block_seconds: 900,
  });
}

export async function authenticationRateLimitAllows(
  purpose: "workforce_login" | "password_recovery" | "invitation",
  dimension: "ip" | "organisation_code" | "alias" | "account" | "recipient",
  keyHash: string,
  maximumAttempts: number,
) {
  return createSecretClient().rpc("authentication_rate_limit_allows", {
    limiter_purpose: purpose,
    limiter_dimension: dimension,
    limiter_key_hash: keyHash,
    maximum_attempts: maximumAttempts,
    window_seconds: 300,
  });
}

export async function releaseAuthenticationRateLimit(
  purpose: "workforce_login" | "password_recovery" | "invitation",
  dimension: "ip" | "organisation_code" | "alias" | "account" | "recipient",
  keyHash: string,
  maximumAttempts: number,
) {
  return createSecretClient().rpc("release_authentication_rate_limit", {
    limiter_purpose: purpose,
    limiter_dimension: dimension,
    limiter_key_hash: keyHash,
    maximum_attempts: maximumAttempts,
    window_seconds: 300,
  });
}

export async function recordAuthenticationRateLimitFailure(
  purpose: "workforce_login" | "password_recovery" | "invitation",
  dimension: "ip" | "organisation_code" | "alias" | "account" | "recipient",
  keyHash: string,
  maximumAttempts: number,
) {
  return createSecretClient().rpc("record_authentication_rate_limit_failure", {
    limiter_purpose: purpose,
    limiter_dimension: dimension,
    limiter_key_hash: keyHash,
    maximum_attempts: maximumAttempts,
    window_seconds: 300,
    block_seconds: 900,
  });
}

export async function resolveWorkforceLogin(
  organisationCode: string,
  workforceAlias: string,
) {
  return createSecretClient().rpc("resolve_workforce_login", {
    organisation_code: organisationCode,
    workforce_alias: workforceAlias,
  });
}

export async function finaliseIdentityEnrolment(userId: string) {
  return createSecretClient().rpc("finalise_identity_enrolment", {
    target_user_id: userId,
  });
}

export async function provisionWorkforceIdentity(input: {
  aliasType: "username" | "workforce_id";
  canonicalAlias: string;
  internalLoginIdentifier: string | null;
  membershipId: string;
  organisationId: string;
  userId: string;
}) {
  return createSecretClient().rpc("provision_workforce_identity", {
    target_alias_type: input.aliasType,
    target_canonical_alias: input.canonicalAlias,
    // PostgREST accepts SQL null here for global-account reuse; generated
    // function argument types cannot represent PostgreSQL parameter nullability.
    target_internal_login_identifier: input.internalLoginIdentifier as string,
    target_membership_id: input.membershipId,
    target_organisation_id: input.organisationId,
    target_user_id: input.userId,
  });
}

export async function disableWorkforceIdentity(
  userId: string,
  changeReason: string,
) {
  return createSecretClient().rpc("disable_workforce_identity", {
    change_reason: changeReason,
    target_user_id: userId,
  });
}

export async function revokeIdentitySessions(
  userId: string,
  changeReason: string,
) {
  return createSecretClient().rpc("revoke_identity_sessions", {
    change_reason: changeReason,
    target_user_id: userId,
  });
}

export async function recordAuthenticationSecurityEvent(
  action:
    | "authentication.email_password"
    | "authentication.password_changed"
    | "authentication.password_recovery_requested"
    | "authentication.workforce",
  outcome: "denied" | "failed" | "succeeded",
  organisationId: string | null = null,
) {
  return createSecretClient().rpc("record_authentication_security_event", {
    event_action: action,
    event_outcome: outcome,
    ...(organisationId ? { event_organisation_id: organisationId } : {}),
  });
}

export async function restoreOrganisation(
  organisationId: string,
  changeReason: string,
) {
  return createSecretClient().rpc("restore_organisation", {
    change_reason: changeReason,
    target_organisation_id: organisationId,
  });
}
