"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  invitationContinuePath,
  INVITATION_TOKEN_PATTERN,
} from "@/modules/identity/invitation-constants";
import { attestOrganisationInvitationInbox } from "@/modules/identity/attest-invitation-inbox";
import { loadInvitationLifecycle } from "@/modules/identity/invitation-lifecycle";
import { invitationTokenDigest } from "@/modules/identity/invitations";
import { passwordUpdateSchema } from "@/modules/identity/auth-input";
import { resolveApplicationOrigin } from "@/platform/application-origin";
import {
  assertInvitationInboxVerifiedForBinding,
  createConfirmedInvitationAuthUser,
  recordInvitationSignupDisplayName,
} from "@/platform/supabase/secret";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const activationSchema = z
  .object({
    token: z.string().regex(INVITATION_TOKEN_PATTERN),
    inboxProof: z.string().min(16).max(64).optional().or(z.literal("")),
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
    inboxProof: formData.get("inboxProof") ?? "",
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

  const inboxProof = parsed.data.inboxProof?.trim();
  if (inboxProof) {
    await attestOrganisationInvitationInbox(parsed.data.token, inboxProof);
  }

  const inboxVerified = await assertInvitationInboxVerifiedForBinding(bindingId);
  if (inboxVerified.error || inboxVerified.data !== true) {
    return {
      error:
        "Open the invitation email and use the Create account button before setting your password.",
    };
  }

  const created = await createConfirmedInvitationAuthUser({
    email: lifecycle.recipientEmail,
    password: parsed.data.password,
    invitationSignupBindingId: bindingId,
  });

  if (created.error) {
    return {
      error: mapSignupError(created.error.message ?? "Unable to create account."),
    };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: lifecycle.recipientEmail,
    password: parsed.data.password,
  });

  if (signInError) {
    return { error: "Account created. Sign in to continue." };
  }

  return {
    ok: true as const,
    continuePath: invitationContinuePath(bindingId),
  };
}

export async function ensureActivationAllowed(
  token: string,
  inboxProof?: string | null,
) {
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

  if (inboxProof?.trim()) {
    await attestOrganisationInvitationInbox(token, inboxProof.trim());
  }

  return lifecycle;
}
