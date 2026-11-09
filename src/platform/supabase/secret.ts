import "server-only";

import { createClient } from "@supabase/supabase-js";

import { invitationInboxProofDigest } from "@/modules/identity/invitation-inbox-proof";
import { invitationTokenDigest } from "@/modules/identity/invitations";
import { getPublicEnvironment, getServerEnvironment } from "@/platform/env";
import type { Database } from "@/platform/supabase/database.types";

export function createSecretClient() {
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

export async function finaliseFoundingSignup(
  bindingId: string,
  userId: string,
) {
  return createSecretClient().rpc("finalise_founding_signup", {
    target_binding_id: bindingId,
    target_user_id: userId,
  });
}

export async function prepareFoundingSignupBinding(email: string) {
  return createSecretClient().rpc("prepare_founding_signup_binding", {
    target_email: email,
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

export async function recordInvitationSignupDisplayName(
  bindingId: string,
  displayName: string,
) {
  return createSecretClient().rpc("record_invitation_signup_display_name", {
    target_binding_id: bindingId,
    target_display_name: displayName,
  });
}

export async function assertInvitationInboxVerifiedForBinding(
  bindingId: string,
) {
  return createSecretClient().rpc(
    "assert_invitation_inbox_verified_for_binding",
    {
      target_binding_id: bindingId,
    },
  );
}

export async function createConfirmedInvitationAuthUser(input: {
  email: string;
  password: string;
  invitationSignupBindingId: string;
  invitationToken: string;
  inboxProof: string;
}) {
  const client = createSecretClient();

  const tokenDigest = invitationTokenDigest(input.invitationToken);
  const proofDigest = invitationInboxProofDigest(input.inboxProof);

  const authorized = await client.rpc("authorize_invitation_identity_signup", {
    target_binding_id: input.invitationSignupBindingId,
    target_user_email: input.email,
    invitation_token_digest: tokenDigest,
    target_inbox_proof_digest: proofDigest,
  });

  if (authorized.error || authorized.data !== true) {
    return {
      error: new Error(
        "Account creation requires a valid organisation invitation.",
      ),
    };
  }

  const created = await client.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      invitation_signup_binding: input.invitationSignupBindingId,
    },
  });

  if (created.error || !created.data.user?.id) {
    return { error: created.error ?? new Error("Unable to create account.") };
  }

  const userId = created.data.user.id;

  const finalised = await client.rpc("finalise_invitation_identity_signup", {
    target_binding_id: input.invitationSignupBindingId,
    target_user_id: userId,
    invitation_token_digest: tokenDigest,
    target_inbox_proof_digest: proofDigest,
  });

  if (finalised.error || finalised.data !== true) {
    await client.auth.admin.deleteUser(userId);
    await client.rpc("clear_invitation_signup_binding_auth_user", {
      target_binding_id: input.invitationSignupBindingId,
    });
    return {
      error: new Error("This invitation is no longer available."),
    };
  }

  const redeemed = await client.rpc(
    "redeem_organisation_invitation_inbox_proof",
    {
      invitation_token_digest: tokenDigest,
      target_inbox_proof_digest: proofDigest,
      target_binding_id: input.invitationSignupBindingId,
    },
  );

  if (redeemed.error || redeemed.data !== true) {
    await client.rpc("clear_invitation_signup_binding_auth_user", {
      target_binding_id: input.invitationSignupBindingId,
    });
    await client.auth.admin.deleteUser(userId);
    return {
      error: new Error(
        "This invitation email link has already been used or is no longer valid.",
      ),
    };
  }

  return { userId };
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
