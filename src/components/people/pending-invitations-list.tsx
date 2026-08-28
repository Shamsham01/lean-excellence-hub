"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type PendingInvitation = {
  id: string;
  email: string;
  expiresAt: string;
  roleName: string;
  scopeLabel: string;
};

export function PendingInvitationsList({
  invitations,
  onRevoke,
}: {
  invitations: PendingInvitation[];
  onRevoke: (invitationId: string) => Promise<{ error?: string; ok?: true }>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (invitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No pending invitations.</p>
    );
  }

  async function handleRevoke(invitationId: string) {
    setLoadingId(invitationId);
    setMessage(null);
    const result = await onRevoke(invitationId);
    setMessage(result.error ?? (result.ok ? "Invitation revoked." : null));
    setLoadingId(null);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="pending-invitations-list">
      <ul className="flex flex-col gap-2">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-col gap-3 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-foreground">{invitation.email}</p>
              <p className="text-muted-foreground">
                {invitation.roleName} · {invitation.scopeLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                Expires{" "}
                {new Date(invitation.expiresAt).toLocaleDateString("en-GB")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingId === invitation.id}
              onClick={() => handleRevoke(invitation.id)}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
