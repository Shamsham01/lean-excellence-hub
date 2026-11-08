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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ inbox_proof?: string }>;
}) {
  const [{ token }, { inbox_proof: inboxProof }] = await Promise.all([
    params,
    searchParams,
  ]);
  const lifecycle = await ensureActivationAllowed(token, inboxProof ?? null);

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-background px-4 py-12"
      data-testid="invitation-activate-page"
    >
      <div className="w-full max-w-md">
        <InvitationActivateForm
          token={token}
          inboxProof={inboxProof ?? ""}
          lifecycle={lifecycle}
          loginPath={invitationLoginPath(token)}
        />
      </div>
    </main>
  );
}
