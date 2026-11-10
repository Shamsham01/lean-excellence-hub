"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { CreateWorkforceUserForm } from "@/components/people/create-workforce-user-form";
import { InviteColleagueForm } from "@/components/people/invite-colleague-form";
import { PendingInvitationsList } from "@/components/people/pending-invitations-list";
import { PeopleDirectory } from "@/components/people/people-directory";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import type { PeopleDirectoryFilters } from "@/lib/people/directory-query";
import type {
  PeopleDirectoryPerson,
  PeopleDirectoryUnitOption,
} from "@/lib/people/directory-types";

type PendingInvitation = {
  id: string;
  email: string;
  displayName: string | null;
  expiresAtLabel: string;
  accessGrants: Array<{ roleName: string; scopeLabel: string }>;
};

export function PeopleSettingsShell({
  canManageInvitations,
  canProvisionWorkforce,
  canImportWorkforce,
  offers,
  units,
  jobFunctions,
  onInvite,
  onCreateWorkforce,
  pendingInvitations,
  namesUnavailable,
  onRevoke,
  onReissue,
  directory,
}: {
  canManageInvitations: boolean;
  canProvisionWorkforce: boolean;
  canImportWorkforce: boolean;
  offers: DelegatableAccessOffer[];
  units: Array<{
    id: string;
    name: string;
    code: string;
    parent_unit_id: string | null;
  }>;
  jobFunctions: Array<{ id: string; name: string; code: string }>;
  onInvite: Parameters<typeof InviteColleagueForm>[0]["onInvite"];
  onCreateWorkforce: Parameters<typeof CreateWorkforceUserForm>[0]["onCreate"];
  pendingInvitations: PendingInvitation[];
  namesUnavailable: boolean;
  onRevoke: Parameters<typeof PendingInvitationsList>[0]["onRevoke"];
  onReissue: Parameters<typeof PendingInvitationsList>[0]["onReissue"];
  directory: {
    people: PeopleDirectoryPerson[];
    totalCount: number;
    page: number;
    pageSize: number;
    filters: PeopleDirectoryFilters;
    units: PeopleDirectoryUnitOption[];
    canManageMemberships: boolean;
    canIncludeInactive: boolean;
    canImportColleagues: boolean;
  } | null;
}) {
  const [tab, setTab] = useState<"people" | "pending">("people");
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);

  function refreshPeople() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {canManageInvitations ? (
          <Button
            type="button"
            className="min-h-11"
            data-testid="people-invite-open"
            onClick={() => setInviteOpen(true)}
          >
            Invite colleague
          </Button>
        ) : null}
        {canProvisionWorkforce ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            data-testid="people-settings-create-link"
            onClick={() => setAddEmployeeOpen(true)}
          >
            Add employee
          </Button>
        ) : null}
        {canImportWorkforce ? (
          <Button variant="outline" className="min-h-11" asChild>
            <AppLink
              href="/platform/settings/people/import"
              data-testid="import-workforce-link"
            >
              Import workforce
            </AppLink>
          </Button>
        ) : null}
        {canManageInvitations ? (
          <Button variant="outline" className="min-h-11" asChild>
            <AppLink
              href="/platform/settings/people/colleague-import"
              data-testid="import-colleagues-link"
            >
              Import from CSV
            </AppLink>
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-border">
        <Button
          type="button"
          size="sm"
          variant={tab === "people" ? "default" : "ghost"}
          className="min-h-11"
          data-testid="people-settings-tab-people"
          onClick={() => setTab("people")}
        >
          People
        </Button>
        {canManageInvitations ? (
          <Button
            type="button"
            size="sm"
            variant={tab === "pending" ? "default" : "ghost"}
            className="min-h-11"
            data-testid="people-settings-tab-pending"
            onClick={() => setTab("pending")}
          >
            Pending invitations ({pendingInvitations.length})
          </Button>
        ) : null}
      </div>

      {tab === "people" && directory ? (
        <PeopleDirectory {...directory} />
      ) : null}

      {tab === "pending" && canManageInvitations ? (
        <PendingInvitationsList
          namesUnavailable={namesUnavailable}
          invitations={pendingInvitations}
          onRevoke={onRevoke}
          onReissue={onReissue}
        />
      ) : null}

      <ResponsiveFormDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite a colleague"
        description="Lean Excellence Hub emails a branded invitation with a Create account button."
        testId="people-invite-dialog"
        contentClassName="sm:max-w-2xl"
        enableGuard
      >
        <InviteColleagueForm
          offers={offers}
          units={units}
          jobFunctions={jobFunctions}
          onInvite={onInvite}
          onSuccess={() => {
            refreshPeople();
          }}
        />
      </ResponsiveFormDialog>

      <ResponsiveFormDialog
        open={addEmployeeOpen}
        onOpenChange={setAddEmployeeOpen}
        title="Add employee"
        description="Create a workforce user with a temporary password."
        testId="people-add-employee-dialog"
        contentClassName="sm:max-w-2xl"
        enableGuard
      >
        <CreateWorkforceUserForm
          offers={offers}
          units={units}
          jobFunctions={jobFunctions}
          onCreate={onCreateWorkforce}
          onProvisioned={refreshPeople}
        />
      </ResponsiveFormDialog>
    </div>
  );
}
