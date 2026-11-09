"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  invitationContinuePath,
  INVITATION_TOKEN_PATTERN,
} from "@/modules/identity/invitation-constants";
import {
  INVITATION_INBOX_PROOF_COOKIE,
  isInvitationInboxProofValue,
} from "@/modules/identity/invitation-inbox-cookie";
import { loadInvitationLifecycle } from "@/modules/identity/invitation-lifecycle";
import { invitationTokenDigest } from "@/modules/identity/invitations";
import { passwordUpdateSchema } from "@/modules/identity/auth-input";
import { recordAuthenticationRateLimitFailure } from "@/platform/supabase/secret";
import {
  createConfirmedInvitationAuthUser,
  recordInvitationSignupDisplayName,
} from "@/platform/supabase/secret";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { getServerEnvironment } from "@/platform/env";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";

const activationSchema = z
  .object({
    token: z.string().regex(INVITATION_TOKEN_PATTERN),
    displayName: z.string().trim().max(120).optional().or(z.literal("")),
    password: passwordUpdateSchema.shape.password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function mapSignupError(message: string) {
  const normalised = message.toLowerCase();

  if (normalised.includes("password")) {
    if (normalised.includes("length") || normalised.includes("short")) {
      return "Use at least 12 characters in your password.";
    }
    if (normalised.includes("upper") || normalised.includes("lower")) {
      return "Include upper and lower case letters in your password.";
    }
    if (normalised.includes("digit") || normalised.includes("number")) {
      return "Include at least one number in your password.";
    }
    if (normalised.includes("symbol") || normalised.includes("special")) {
      return "Include at least one symbol in your password.";
    }
    return "Choose a stronger password that meets the requirements.";
  }

  if (
    normalised.includes("already registered") ||
    normalised.includes("already exists") ||
    normalised.includes("user already")
  ) {
    return "An account already exists for this email address. Sign in instead.";
  }

  if (normalised.includes("organisation invitation")) {
    return "Account creation requires a valid organisation invitation.";
  }

  return "Unable to create your account. Try again or sign in if you already have an account.";
}

export async function createInvitationAccount(formData: FormData) {
  const parsed = activationSchema.safeParse({
    token: formData.get("token"),
    displayName: formData.get("displayName") ?? "",
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path.includes("displayName")) {
      return { error: "Enter a name using 1 to 120 characters." };
    }
    return {
      error:
        issue?.message === "Passwords do not match."
          ? "Passwords do not match."
          : "Check your password meets the requirements.",
    };
  }

  const lifecycle = await loadInvitationLifecycle(parsed.data.token);
  if (lifecycle.state !== "valid" || !lifecycle.recipientEmail) {
    return { error: "This invitation is no longer available." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: bindingId, error: bindingError } = await supabase.rpc(
    "prepare_organisation_invitation_signup_binding",
    {
      invitation_token_digest: invitationTokenDigest(parsed.data.token),
    },
  );

  if (bindingError || !bindingId) {
    return { error: "This invitation is no longer available." };
  }

  const confirmedName = parsed.data.displayName?.trim();
  if (confirmedName) {
    const recorded = await recordInvitationSignupDisplayName(
      bindingId,
      confirmedName,
    );
    if (recorded.error) {
      return { error: "Enter a name using 1 to 120 characters." };
    }
  }

  const cookieStore = await cookies();
  const inboxProof = cookieStore.get(INVITATION_INBOX_PROOF_COOKIE)?.value;

  if (!isInvitationInboxProofValue(inboxProof)) {
    await recordInvitationActivationFailure(parsed.data.token);
    return {
      error:
        "Open the invitation email and use the Create account button before setting your password.",
    };
  }

  const created = await createConfirmedInvitationAuthUser({
    email: lifecycle.recipientEmail,
    password: parsed.data.password,
    invitationSignupBindingId: bindingId,
    invitationToken: parsed.data.token,
    inboxProof: inboxProof!,
  });

  if (created.error) {
    const message = created.error.message ?? "Unable to create account.";
    if (
      !message.toLowerCase().includes("already been used") &&
      !message.toLowerCase().includes("no longer valid")
    ) {
      await recordInvitationActivationFailure(parsed.data.token);
    }
    return {
      error: mapSignupError(message),
    };
  }

  cookieStore.delete({
    name: INVITATION_INBOX_PROOF_COOKIE,
    path: `/invitations/${parsed.data.token}/activate`,
  });

  await supabase.auth.signInWithPassword({
    email: lifecycle.recipientEmail,
    password: parsed.data.password,
  });

  redirect(invitationContinuePath(bindingId));
}

function hashRateLimitKey(token: string) {
  const pepper = getServerEnvironment().AUTH_RATE_LIMIT_PEPPER;
  return `\\x${createHmac("sha256", pepper)
    .update(`invitation-activate:${token}`)
    .digest("hex")}`;
}

async function recordInvitationActivationFailure(token: string) {
  await recordAuthenticationRateLimitFailure(
    "invitation",
    "recipient",
    hashRateLimitKey(token),
    30,
  );
}

export async function ensureActivationAllowed(token: string) {
  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user?.id) {
    redirect(`/invitations/${token}`);
  }

  const lifecycle = await loadInvitationLifecycle(token);
  if (lifecycle.state !== "valid" || !lifecycle.recipientEmail) {
    redirect(`/invitations/${token}`);
  }

  return lifecycle;
}
