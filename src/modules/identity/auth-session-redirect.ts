import "server-only";

import { redirect } from "next/navigation";

import { safeRelativeRedirect } from "@/modules/identity/redirects";
import { readRequestPathname } from "@/platform/http/request-path";
import {
  classifySupabaseError,
  readSupabaseErrorFields,
} from "@/platform/supabase/error-classification";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function readAuthFailureMessage(error: unknown): string {
  const { message } = readSupabaseErrorFields(error);
  return message?.toLowerCase() ?? "";
}

export function isRecoverableAuthSessionFailure(error: unknown): boolean {
  if (classifySupabaseError(error) === "auth_session_failure") {
    return true;
  }

  const { code } = readSupabaseErrorFields(error);
  if (code === "refresh_token_not_found") {
    return true;
  }

  const message = readAuthFailureMessage(error);
  return (
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token") ||
    message.includes("jwt expired")
  );
}

export async function clearSessionAndRedirectToLogin(): Promise<never> {
  const pathname = await readRequestPathname();
  const nextPath = safeRelativeRedirect(pathname, "/platform");
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });

  const loginPath =
    nextPath && nextPath !== "/"
      ? `/login?next=${encodeURIComponent(nextPath)}`
      : "/login";
  redirect(loginPath);
}

export async function redirectIfRecoverableAuthSessionFailure(
  error: unknown,
): Promise<void> {
  if (isRecoverableAuthSessionFailure(error)) {
    await clearSessionAndRedirectToLogin();
  }
}
