"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { passwordUpdateSchema } from "@/modules/identity/auth-input";
import { resolveApplicationOrigin } from "@/platform/application-origin";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { prepareFoundingSignupBinding } from "@/platform/supabase/secret";

const signupSchema = z
  .object({
    email: z.string().trim().pipe(z.email().max(320)),
    password: passwordUpdateSchema.shape.password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function createFoundingAccount(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect("/signup?error=invalid");
  }

  const email = parsed.data.email.toLowerCase();
  const prepared = await prepareFoundingSignupBinding(email);
  if (prepared.error || !prepared.data) {
    redirect("/signup?error=prepare");
  }

  const originResult = resolveApplicationOrigin({
    requestHeaders: await headers(),
  });
  if (!originResult.ok) {
    redirect("/signup?error=origin");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${originResult.origin}/auth/confirm`,
      data: {
        founding_signup_binding: prepared.data,
      },
    },
  });

  if (error) {
    redirect("/signup?error=signup");
  }

  redirect("/signup?status=check-email");
}
