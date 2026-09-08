export const SITE_BOUNDARY_PEOPLE_DELEGATE = {
  id: "b0000000-0000-0000-0000-000000000008",
  email: "people-manager@cookieworks.local",
  password: "PeopleMgr@CookieWorks-QA-2026!",
  displayName: "CookieWorks People Manager",
} as const;

export const SITE_BOUNDARY_PEOPLE_DELEGATE_ROLE = {
  canonicalName: "bodmin-people-delegate-manager",
  displayName: "People Delegate Manager",
  description:
    "Bodmin-scoped people invitation and delegation authority for site-boundary QA.",
  scopeType: "unit_subtree" as const,
  scopeUnitKey: "packing",
  isProtected: true,
  permissions: [
    "hierarchy.read",
    "memberships.read",
    "invitations.manage",
    "roles.delegate",
    "job_functions.read",
    "job_functions.manage",
  ],
  invitationTokenSeed: "cookieworks-qa-people-delegate-manager-invitation-v1",
} as const;
