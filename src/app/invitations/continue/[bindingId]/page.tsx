import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InvitationAcceptanceCard } from "@/components/invitations/invitation-acceptance-card";
import {
  invitationContinuePath,
  isInvitationSignupBindingId,
} from "@/modules/identity/invitation-constants";
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
  searchParams: Promise<{ accept_error?: string; replace_error?: string }>;
}) {
  const [{ bindingId }, query] = await Promise.all([params, searchParams]);
  const acceptError = query.accept_error;
  const replaceError = query.replace_error;

  if (!isInvitationSignupBindingId(bindingId)) {
    redirect("/login");
  }

  const lifecycle = await loadInvitationSignupBinding(bindingId);

  if (
    lifecycle.sessionState === "redirect_binding" &&
    lifecycle.continuationBindingId &&
    lifecycle.continuationBindingId !== bindingId &&
    isInvitationSignupBindingId(lifecycle.continuationBindingId)
  ) {
    redirect(invitationContinuePath(lifecycle.continuationBindingId));
  }

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
        {replaceError ? (
          <p className="mb-4 text-sm text-destructive" role="alert">
            Unable to continue this invitation right now. Try again or ask your
            organisation administrator for a new invitation.
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
