import type { Metadata } from "next";
import { cookies } from "next/headers";

import { InvitationActivateForm } from "@/components/invitations/invitation-activate-form";
import { invitationLoginPath } from "@/modules/identity/invitation-lifecycle";
import { INVITATION_INBOX_PROOF_COOKIE } from "@/modules/identity/invitation-inbox-cookie";

import { ensureActivationAllowed } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function InvitationActivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const lifecycle = await ensureActivationAllowed(token);
  const cookieStore = await cookies();
  const hasInboxProofCookie = Boolean(
    cookieStore.get(INVITATION_INBOX_PROOF_COOKIE)?.value,
  );

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-background px-4 py-12"
      data-testid="invitation-activate-page"
    >
      <div className="w-full max-w-md">
        <InvitationActivateForm
          token={token}
          hasInboxProofCookie={hasInboxProofCookie}
          lifecycle={lifecycle}
          loginPath={invitationLoginPath(token)}
        />
      </div>
    </main>
  );
}
