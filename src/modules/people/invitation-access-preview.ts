export type InvitationAccessPreview = {
  viewing: string;
  contribution: string;
  management: string;
};

export function describeInvitationAccess(offer: {
  role_canonical_name: string;
  role_display_name: string;
  responsibility_kind?: string | null;
}): InvitationAccessPreview {
  if (offer.role_canonical_name === "workplace-viewer") {
    return {
      viewing: "Published and shared workplace records in the chosen scope",
      contribution: "No contribution from Workplace Viewer",
      management: "No administration",
    };
  }

  if (offer.role_canonical_name === "suggestions-contributor") {
    return {
      viewing: "Their own suggestions",
      contribution: "Submit suggestions",
      management: "No review or programme administration",
    };
  }

  if (offer.role_canonical_name === "responsibility-suggestions") {
    return {
      viewing: "Suggestions in the chosen scope",
      contribution: "Review suggestions",
      management: "Manage suggestions and programmes",
    };
  }

  if (offer.role_canonical_name === "team-member") {
    return {
      viewing: "Operational records included in Team Member",
      contribution: "Participate, including creating and submitting work",
      management: "No administration from Team Member alone",
    };
  }

  if (
    offer.role_canonical_name === "organisation-administrator" ||
    offer.responsibility_kind === "admin"
  ) {
    return {
      viewing: "Organisation administration",
      contribution: "Configure people, invitations, and platform settings",
      management: "Organisation administration",
    };
  }

  if (offer.responsibility_kind === "module") {
    return {
      viewing: `${offer.role_display_name} records in the chosen scope`,
      contribution: `Work included in ${offer.role_display_name}`,
      management: `Administer ${offer.role_display_name}`,
    };
  }

  return {
    viewing: "The published permissions for this role",
    contribution: "The published permissions for this role",
    management: "Only the management permissions published on this role",
  };
}
