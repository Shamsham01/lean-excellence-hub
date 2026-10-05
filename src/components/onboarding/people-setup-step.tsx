"use client";

import { useState, useTransition } from "react";

import { skipStructureFirstStep } from "@/app/onboarding/setup/actions";
import {
  inviteColleague,
  reissueInvitation,
  revokeInvitation,
} from "@/app/(platform)/platform/settings/people/actions";
import { StructureFirstGuidance } from "@/components/onboarding/structure-first-guidance";
import {
  InviteColleagueForm,
  type DelegatableAccessOffer,
} from "@/components/people/invite-colleague-form";
import { PendingInvitationsList } from "@/components/people/pending-invitations-list";
import { Button } from "@/components/ui/button";
import { hardNavigate } from "@/lib/navigation/navigate";
import type {
  StructureFirstMember,
  StructureFirstOwner,
  StructureFirstPendingInvitation,
  StructureGuidance,
} from "@/modules/organisation-onboarding";

export function PeopleSetupStep({
  owners,
  members,
  pendingInvitations,
  offers,
  units,
  jobFunctions,
  canInvite,
  guidance,
}: {
  owners: StructureFirstOwner[];
  members: StructureFirstMember[];
  pendingInvitations: StructureFirstPendingInvitation[];
  offers: DelegatableAccessOffer[];
  units: Array<{
    id: string;
    name: string;
    code: string;
    parent_unit_id: string | null;
  }>;
  jobFunctions: Array<{ id: string; name: string; code: string }>;
  canInvite: boolean;
  guidance: readonly StructureGuidance[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSkip() {
    startTransition(async () => {
      const result = await skipStructureFirstStep("people");
      if (result.error) {
        setMessage(result.error);
        return;
      }
      hardNavigate("/onboarding/setup?step=readiness");
    });
  }

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="structure-first-people-step"
      aria-labelledby="people-setup-heading"
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          People
        </p>
        <h2 id="people-setup-heading" className="typography-page-title">
          Who is in this organisation?
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          You do not need to invite everyone now. People context improves later
          setup and LeanAI help.
        </p>
      </div>

      <StructureFirstGuidance items={guidance} />

      <dl
        className="grid gap-4 sm:grid-cols-3"
        data-testid="structure-first-people-summary"
      >
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Organisation Owner
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {owners.length > 0
              ? owners.map((owner) => owner.displayName).join(", ")
              : "Not listed"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            People added
          </dt>
          <dd className="mt-1 text-sm text-foreground">{members.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Invitations pending
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {pendingInvitations.length}
          </dd>
        </div>
      </dl>

      {canInvite ? (
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Invite a colleague
          </h3>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Access role is what somebody is allowed to do. Job function is what
            somebody does.
          </p>
          <InviteColleagueForm
            offers={offers}
            units={units}
            jobFunctions={jobFunctions}
            onInvite={inviteColleague}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ask an Organisation Administrator to invite colleagues.
        </p>
      )}

      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">
          Pending invitations
        </h3>
        <PendingInvitationsList
          invitations={pendingInvitations}
          onRevoke={revokeInvitation}
          onReissue={reissueInvitation}
        />
      </div>

      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={() => hardNavigate("/onboarding/setup?step=readiness")}
          data-testid="structure-first-continue-people"
        >
          Continue to readiness
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSkip}
          disabled={pending}
          data-testid="structure-first-skip-people"
        >
          Skip for now
        </Button>
      </div>
    </section>
  );
}
