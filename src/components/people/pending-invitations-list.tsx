"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type PendingInvitation = {
  id: string;
  email: string;
  displayName?: string | null;
  expiresAtLabel: string;
  accessGrants: Array<{
    roleName: string;
    scopeLabel: string;
  }>;
};

export function PendingInvitationsList({
  invitations,
  namesUnavailable = false,
  onRevoke,
  onReissue,
}: {
  invitations: PendingInvitation[];
  namesUnavailable?: boolean;
  onRevoke: (invitationId: string) => Promise<{ error?: string; ok?: true }>;
  onReissue: (
    invitationId: string,
  ) => Promise<{ error?: string; ok?: true; invitationUrl?: string }>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [reissuedUrl, setReissuedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (invitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No pending invitations.</p>
    );
  }

  async function handleRevoke(invitationId: string) {
    setLoadingId(invitationId);
    setMessage(null);
    setReissuedUrl(null);
    const result = await onRevoke(invitationId);
    setMessage(result.error ?? (result.ok ? "Invitation revoked." : null));
    setLoadingId(null);
  }

  async function handleReissue(invitationId: string) {
    setLoadingId(invitationId);
    setMessage(null);
    setReissuedUrl(null);
    setCopied(false);
    const result = await onReissue(invitationId);
    if (result.error) {
      setMessage(result.error);
    } else if (result.ok) {
      setReissuedUrl(result.invitationUrl ?? null);
      setMessage(
        "Invitation reissued. Share the new secure link with your colleague.",
      );
    }
    setLoadingId(null);
  }

  async function handleCopy() {
    if (!reissuedUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(reissuedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Unable to copy the invitation link. Copy it manually below.");
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="pending-invitations-list">
      {namesUnavailable ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="pending-invitation-names-error"
        >
          Invited names could not be loaded.
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-col gap-3 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium break-words text-foreground">
                {invitation.email}
              </p>
              {invitation.displayName ? (
                <p
                  className="break-words text-foreground"
                  data-testid={`pending-invitation-name-${invitation.id}`}
                >
                  {invitation.displayName}
                </p>
              ) : null}
              <ul
                className="text-muted-foreground"
                data-testid={`pending-invitation-grants-${invitation.id}`}
              >
                {invitation.accessGrants.map((grant, index) => (
                  <li
                    key={`${grant.roleName}-${grant.scopeLabel}-${index}`}
                    className="break-words"
                  >
                    {grant.roleName} · {grant.scopeLabel}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Expires {invitation.expiresAtLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingId === invitation.id}
                data-testid={`reissue-invitation-${invitation.id}`}
                onClick={() => void handleReissue(invitation.id)}
              >
                Reissue
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingId === invitation.id}
                onClick={() => void handleRevoke(invitation.id)}
              >
                Revoke
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {reissuedUrl ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs break-all text-muted-foreground">
            New invitation link: {reissuedUrl}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            data-testid="copy-reissued-invitation-link-button"
            onClick={() => void handleCopy()}
          >
            {copied ? "Copied" : "Copy invitation link"}
          </Button>
        </div>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
