import type { Metadata } from "next";

import { InvitationActivateForm } from "@/components/invitations/invitation-activate-form";
import { invitationLoginPath } from "@/modules/identity/invitation-lifecycle";

import { ensureActivationAllowed } from "./actions";

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

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-background px-4 py-12"
      data-testid="invitation-activate-page"
    >
      <div className="w-full max-w-md">
        <InvitationActivateForm
          token={token}
          lifecycle={lifecycle}
          loginPath={invitationLoginPath(token)}
        />
      </div>
    </main>
  );
}
