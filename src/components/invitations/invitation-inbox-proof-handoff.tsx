"use client";

import { useEffect, useRef, useState } from "react";

import {
  INVITATION_INBOX_PROOF_COOKIE,
  isInvitationInboxProofValue,
} from "@/modules/identity/invitation-inbox-cookie-constants";

const INBOX_PROOF_HASH_PREFIX = "#inbox_proof=";

function readInboxProofFromLocationHash(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const hash = window.location.hash;
  if (!hash.startsWith(INBOX_PROOF_HASH_PREFIX)) {
    return null;
  }
  const encoded = hash.slice(INBOX_PROOF_HASH_PREFIX.length);
  if (!encoded) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(encoded);
    return isInvitationInboxProofValue(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function InvitationInboxProofHandoff({
  token,
  hasInboxProofCookie,
  onStaged,
}: {
  token: string;
  hasInboxProofCookie: boolean;
  onStaged: () => void;
}) {
  const [staging, setStaging] = useState(false);
  const [stagingError, setStagingError] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (hasInboxProofCookie || startedRef.current) {
      return;
    }

    const inboxProof = readInboxProofFromLocationHash();
    if (!inboxProof) {
      return;
    }

    startedRef.current = true;
    setStaging(true);
    setStagingError(false);

    void (async () => {
      try {
        const response = await fetch(
          `/api/invitations/${encodeURIComponent(token)}/stage-inbox-proof`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ inbox_proof: inboxProof }),
            credentials: "same-origin",
            referrerPolicy: "no-referrer",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          setStagingError(true);
          setStaging(false);
          return;
        }

        window.history.replaceState(
          null,
          "",
          `/invitations/${encodeURIComponent(token)}/activate`,
        );
        onStaged();
        setStaging(false);
      } catch {
        setStagingError(true);
        setStaging(false);
      }
    })();
  }, [hasInboxProofCookie, onStaged, token]);

  if (!staging && !stagingError) {
    return null;
  }

  return (
    <p
      className="text-sm text-muted-foreground"
      data-testid="invitation-inbox-proof-handoff"
      aria-live="polite"
    >
      {staging
        ? "Confirming your invitation email link…"
        : "We could not confirm that email link. Open the Create account button again or ask for a new invitation."}
    </p>
  );
}

export function invitationInboxProofCookiePresent(
  cookies: Array<{ name: string }>,
) {
  return cookies.some(
    (cookie) => cookie.name === INVITATION_INBOX_PROOF_COOKIE,
  );
}
