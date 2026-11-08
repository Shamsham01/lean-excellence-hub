import Link from "next/link";

import { AuthBackLink } from "@/components/auth/auth-back-link";
import { AuthFieldLabel } from "@/components/auth/auth-field-label";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { AuthPasswordInput } from "@/components/auth/auth-password-input";
import { AuthStatus } from "@/components/auth/auth-status";
import { updatePassword } from "./actions";
import { Button } from "@/components/ui/button";
import { AUTH_COPY } from "@/modules/identity/auth-copy";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function updatePasswordErrorCopy(error: string | undefined) {
  if (error === "weak") {
    return AUTH_COPY.updatePasswordWeak;
  }
  if (error === "failed") {
    return AUTH_COPY.updatePasswordFailed;
  }
  return null;
}

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const hasSession = Boolean(!claimsError && claimsData?.claims?.sub);
  const formError = hasSession ? updatePasswordErrorCopy(error) : null;

  if (!hasSession) {
    return (
      <AuthPageFrame>
        <AuthBackLink href="/login">Back to sign in</AuthBackLink>
        <AuthPageHeader
          title="Set a new password"
          description="A signed-in recovery or password-change session is required."
        />
        <AuthStatus testId="update-password-session" tone="danger">
          {AUTH_COPY.updatePasswordSession}
        </AuthStatus>
        <footer className="mt-6 flex flex-col gap-2 text-center text-sm">
          <Link href="/recover" className="text-primary hover:underline">
            Request another recovery email
          </Link>
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </footer>
      </AuthPageFrame>
    );
  }

  return (
    <AuthPageFrame>
      <AuthBackLink href="/login">Back to sign in</AuthBackLink>
      <AuthPageHeader
        title="Set a new password"
        description="Choose a strong password for your account."
      />
      {formError ? (
        <AuthStatus testId="update-password-error" tone="danger">
          {formError}
        </AuthStatus>
      ) : null}
      <form action={updatePassword} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <AuthFieldLabel htmlFor="password" required>
            New password
          </AuthFieldLabel>
          <AuthPasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          Update password
        </Button>
      </form>
    </AuthPageFrame>
  );
}
