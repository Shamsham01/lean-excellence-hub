import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { resolveAuthenticatedInvitationContinuation } from "@/modules/identity/invitation-continuation";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NoAccessPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const continuation = data.user
    ? await resolveAuthenticatedInvitationContinuation(supabase)
    : { kind: "none" as const };

  if (continuation.kind === "redirect") {
    redirect(continuation.path);
  }

  const expired = continuation.kind === "unavailable";
  const revoked =
    continuation.kind === "unavailable" &&
    continuation.detail === "invitation_revoked";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <AuthCard
          title={
            revoked
              ? "Invitation no longer active"
              : expired
                ? "Invitation expired"
                : "No organisation access"
          }
          description={
            revoked
              ? "The invitation linked to this account is no longer active."
              : expired
                ? "The invitation linked to this account has expired."
                : "Your identity is not currently eligible for an active organisation."
          }
        >
          {expired ? (
            <p className="text-sm text-muted-foreground">
              Ask your organisation administrator for a new invitation. An
              expired or withdrawn invitation is not extended automatically.
            </p>
          ) : null}
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </AuthCard>
      </div>
    </div>
  );
}
