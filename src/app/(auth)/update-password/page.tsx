import Link from "next/link";

import { updatePassword } from "./actions";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthStatus } from "@/components/auth/auth-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <AuthCard
        title="Set a new password"
        description="A signed-in recovery or password-change session is required."
        footer={
          <div className="flex flex-col gap-2 text-center text-sm">
            <Link href="/recover" className="text-primary hover:underline">
              Request another recovery email
            </Link>
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        }
      >
        <AuthStatus testId="update-password-session" tone="danger">
          {AUTH_COPY.updatePasswordSession}
        </AuthStatus>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      description="Choose a strong password for your account."
    >
      {formError ? (
        <AuthStatus testId="update-password-error" tone="danger">
          {formError}
        </AuthStatus>
      ) : null}
      <form action={updatePassword} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
