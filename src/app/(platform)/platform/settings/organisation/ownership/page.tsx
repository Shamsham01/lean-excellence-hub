import { notFound } from "next/navigation";

import { OwnershipTransferWorkspace } from "@/components/organisation-ownership/ownership-transfer-workspace";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  loadOrganisationOwnership,
  loadOwnershipTransferTargets,
} from "@/modules/organisation-ownership/queries";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

export default async function OrganisationOwnershipTransferPage() {
  if (!(await currentMemberHasPermission("hierarchy.read"))) {
    notFound();
  }

  const ownership = await loadOrganisationOwnership();
  if (!ownership?.canTransfer) {
    notFound();
  }

  const targets = await loadOwnershipTransferTargets();
  const currentOwner =
    ownership.owners.find((owner) => owner.membershipId) ??
    ownership.owners[0] ??
    null;

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="organisation-ownership-page"
    >
      <PageHeader
        title="Transfer organisation ownership"
        description={`${ownership.organisationName} stays the same organisation. Sites, billing and history are unchanged.`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/settings/organisation"
              data-testid="ownership-back-organisation"
            >
              Back to organisation
            </AppLink>
          </Button>
        }
      />
      <OwnershipTransferWorkspace
        organisationName={ownership.organisationName}
        currentOwner={currentOwner}
        targets={targets}
      />
    </div>
  );
}
