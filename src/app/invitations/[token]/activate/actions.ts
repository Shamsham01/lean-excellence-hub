"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  invitationContinuePath,
  INVITATION_TOKEN_PATTERN,
} from "@/modules/identity/invitation-constants";
import { loadInvitationLifecycle } from "@/modules/identity/invitation-lifecycle";
import { invitationTokenDigest } from "@/modules/identity/invitations";
import { passwordUpdateSchema } from "@/modules/identity/auth-input";
import { resolveApplicationOrigin } from "@/platform/application-origin";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const activationSchema = z
  .object({
    token: z.string().regex(INVITATION_TOKEN_PATTERN),
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
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
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

  const originResult = resolveApplicationOrigin({
    requestHeaders: await headers(),
  });
  if (!originResult.ok) {
    return { error: originResult.error };
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

  const { error } = await supabase.auth.signUp({
    email: lifecycle.recipientEmail,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${originResult.origin}/auth/confirm`,
      data: {
        invitation_signup_binding: bindingId,
      },
    },
  });

  if (error) {
    return { error: mapSignupError(error.message) };
  }

  return {
    ok: true as const,
    continuePath: invitationContinuePath(bindingId),
  };
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
