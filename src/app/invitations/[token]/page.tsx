import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InvitationAcceptanceCard } from "@/components/invitations/invitation-acceptance-card";
import {
  invitationActivatePath,
  invitationLoginPath,
  loadInvitationLifecycle,
} from "@/modules/identity/invitation-lifecycle";
import { INVITATION_TOKEN_PATTERN } from "@/modules/identity/invitation-constants";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { accept } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Organisation invitation",
  robots: { index: false, follow: false },
};

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ accept_error?: string }>;
}) {
  const [{ token }, { accept_error: acceptError }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(userData.user?.id);

  const lifecycle = await loadInvitationLifecycle(token, {
    authenticated: isAuthenticated,
  });

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-background px-4 py-12"
      data-testid="invitation-page"
    >
      <div className="w-full max-w-md">
        {acceptError && lifecycle.sessionState === "ready_to_accept" ? (
          <p className="mb-4 text-sm text-destructive" role="alert">
            Unable to accept this invitation right now. Try again or contact
            your organisation administrator.
          </p>
        ) : null}
        <InvitationAcceptanceCard
          token={token}
          lifecycle={lifecycle}
          loginPath={invitationLoginPath(token)}
          activatePath={invitationActivatePath(token)}
          acceptAction={accept}
        />
      </div>
    </main>
  );
}
