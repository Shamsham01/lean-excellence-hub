import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InvitationAcceptanceCard } from "@/components/invitations/invitation-acceptance-card";
import { isInvitationSignupBindingId } from "@/modules/identity/invitation-constants";
import { loadInvitationSignupBinding } from "@/modules/identity/invitation-lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Organisation invitation",
  robots: { index: false, follow: false },
};

export default async function InvitationContinuePage({
  params,
  searchParams,
}: {
  params: Promise<{ bindingId: string }>;
  searchParams: Promise<{ accept_error?: string }>;
}) {
  const [{ bindingId }, { accept_error: acceptError }] = await Promise.all([
    params,
    searchParams,
  ]);

  if (!isInvitationSignupBindingId(bindingId)) {
    redirect("/login");
  }

  const lifecycle = await loadInvitationSignupBinding(bindingId);

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-background px-4 py-12"
      data-testid="invitation-continue-page"
    >
      <div className="w-full max-w-md">
        {acceptError && lifecycle.sessionState === "ready_to_accept" ? (
          <p className="mb-4 text-sm text-destructive" role="alert">
            Unable to accept this invitation right now. Try again or contact
            your organisation administrator.
          </p>
        ) : null}
        <InvitationAcceptanceCard
          bindingId={bindingId}
          lifecycle={lifecycle}
          acceptEndpoint="/api/auth/invitations/accept-binding"
        />
      </div>
    </main>
  );
}
