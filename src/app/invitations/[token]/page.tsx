import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Button } from "@/components/ui/button";

import { accept } from "./actions";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, { error }] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();
  if (!claims.data?.claims?.sub) {
    redirect(`/login?next=${encodeURIComponent(`/invitations/${token}`)}`);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <AuthCard
          title="Accept invitation"
          description="Accepting will apply the role and scope offered to you for this organisation."
          footer={
            <p className="text-center text-xs text-muted-foreground">
              Need help? Contact your organisation administrator.
            </p>
          }
        >
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              This invitation is unavailable.
            </p>
          ) : null}
          <form action={accept} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />
            <Button type="submit">Accept invitation</Button>
          </form>
          <Button variant="ghost" size="sm" asChild className="w-full">
            <Link href="/platform">Return to workspace</Link>
          </Button>
        </AuthCard>
      </div>
    </main>
  );
}
