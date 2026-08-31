import { SettingsHub } from "@/components/settings/settings-hub";
import { PageHeader } from "@/components/platform/page-header";
import { buildSettingsHubCards } from "@/modules/settings/settings-hub-cards";
import {
  currentMemberHasDelegatableAccess,
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";

export default async function SettingsPage() {
  const [
    canReadHierarchy,
    canReadJobFunctions,
    canManageAiAtOrgScope,
    canManageInvitations,
    canProvisionWorkforce,
    canImportWorkforce,
    canDelegateAccess,
  ] = await Promise.all([
    currentMemberHasPermission("hierarchy.read"),
    currentMemberHasPermission("job_functions.read"),
    currentMemberHasOrganisationScopedPermission("ai.manage_settings"),
    currentMemberHasPermission("invitations.manage"),
    currentMemberHasPermission("workforce.provision"),
    currentMemberHasPermission("workforce.import"),
    currentMemberHasDelegatableAccess(),
  ]);

  return (
    <div className="flex flex-col gap-8" data-testid="settings-page">
      <PageHeader
        title="Settings"
        description="Manage your organisation configuration and preferences."
      />

      <SettingsHub
        cards={buildSettingsHubCards({
          canReadHierarchy,
          canReadJobFunctions,
          canManageAiAtOrgScope,
          canManageInvitations,
          canProvisionWorkforce,
          canImportWorkforce,
          canDelegateAccess,
        })}
      />
    </div>
  );
}
