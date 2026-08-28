import { SettingsHub } from "@/components/settings/settings-hub";
import { PageHeader } from "@/components/platform/page-header";
import {
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";

export default async function SettingsPage() {
  const [canReadHierarchy, canReadJobFunctions, canManageAiAtOrgScope] =
    await Promise.all([
      currentMemberHasPermission("hierarchy.read"),
      currentMemberHasPermission("job_functions.read"),
      currentMemberHasOrganisationScopedPermission("ai.manage_settings"),
    ]);

  return (
    <div className="flex flex-col gap-8" data-testid="settings-page">
      <PageHeader
        title="Settings"
        description="Manage your organisation configuration and preferences."
      />

      <SettingsHub
        cards={[
          {
            title: "Organisation",
            description:
              "View your organisation identity, locale, and reporting settings.",
            href: "/platform/settings/organisation",
            available: true,
          },
          {
            title: "Your profile",
            description: "Set how your name appears across the platform.",
            href: "/platform/settings/profile",
            available: true,
          },
          {
            title: "Organisation structure",
            description: "Create and review organisational units.",
            href: "/platform/settings/structure",
            available: canReadHierarchy,
          },
          {
            title: "People and invitations",
            description:
              "Plan team access. Invitation issuance requires a safe delegation workflow.",
            href: "/platform/settings/people",
            available: true,
          },
          {
            title: "Job functions",
            description: "Define job functions for capability and training.",
            href: "/platform/settings/job-functions",
            available: canReadJobFunctions,
          },
          {
            title: "Lean AI",
            description: "Organisation-wide Lean AI settings and usage review.",
            href: "/platform/settings/ai",
            available: canManageAiAtOrgScope,
            unavailableMessage:
              "Organisation-wide Lean AI settings require organisation-scoped authority.",
          },
        ]}
      />
    </div>
  );
}
