import type { SettingsHubCard } from "@/components/settings/settings-hub";

export type SettingsHubCardAccess = {
  canReadHierarchy: boolean;
  canReadJobFunctions: boolean;
  canManageAiAtOrgScope: boolean;
  canManageInvitations: boolean;
  canProvisionWorkforce: boolean;
  canImportWorkforce: boolean;
  canDelegateAccess: boolean;
};

export function canAccessPeopleSettings(access: SettingsHubCardAccess) {
  return (
    access.canManageInvitations ||
    access.canProvisionWorkforce ||
    access.canImportWorkforce ||
    access.canDelegateAccess
  );
}

export function buildSettingsHubCards(
  access: SettingsHubCardAccess,
): SettingsHubCard[] {
  return [
    {
      title: "Organisation",
      description:
        "View your organisation identity, locale, and reporting settings.",
      href: "/platform/settings/organisation",
      available: access.canReadHierarchy,
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
      available: access.canReadHierarchy,
    },
    {
      title: "People and invitations",
      description:
        "Invite colleagues and manage pending invitations with appropriate access.",
      href: "/platform/settings/people",
      available: canAccessPeopleSettings(access),
    },
    {
      title: "Job functions",
      description: "Define job functions for capability and training.",
      href: "/platform/settings/job-functions",
      available: access.canReadJobFunctions,
    },
    {
      title: "Lean AI",
      description: "Organisation-wide Lean AI settings and usage review.",
      href: "/platform/settings/ai",
      available: access.canManageAiAtOrgScope,
      unavailableMessage:
        "Organisation-wide Lean AI settings require organisation-scoped authority.",
    },
  ];
}
