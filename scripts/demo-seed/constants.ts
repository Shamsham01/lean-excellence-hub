export const DEMO_ORGANISATION = {
  code: "apex-manufacturing",
  name: "Apex Manufacturing",
} as const;

export const DEMO_USERS = {
  admin: {
    id: "a0000000-0000-0000-0000-000000000001",
    email: "admin@apex.local",
    password: "Admin@Apex-Dev-2026!",
    displayName: "Apex Admin",
  },
  manager: {
    id: "a0000000-0000-0000-0000-000000000002",
    email: "manager@apex.local",
    password: "Manager@Apex-Dev-2026!",
    displayName: "Apex Manager",
  },
  operator: {
    id: "a0000000-0000-0000-0000-000000000003",
    email: "operator@apex.local",
    password: "Operator@Apex-Dev-2026!",
    displayName: "Apex Operator",
  },
} as const;

export const DEMO_UNITS = [
  {
    key: "cornwall-plant",
    code: "cornwall-plant",
    name: "Cornwall Plant",
    type: "plant",
    parentKey: null,
  },
  {
    key: "operations",
    code: "operations",
    name: "Operations",
    type: "department",
    parentKey: "cornwall-plant",
  },
  {
    key: "engineering",
    code: "engineering",
    name: "Engineering",
    type: "department",
    parentKey: "cornwall-plant",
  },
  {
    key: "quality",
    code: "quality",
    name: "Quality",
    type: "department",
    parentKey: "cornwall-plant",
  },
] as const;

export const DEMO_ROLES = {
  manager: {
    canonicalName: "plant-manager",
    displayName: "Plant Manager",
    description: "Unit-scoped manager for Cornwall Plant operations.",
    scopeType: "unit_subtree" as const,
    scopeUnitKey: "cornwall-plant",
    permissions: [
      "hierarchy.read",
      "memberships.read",
      "actions.read",
      "actions.create",
      "actions.update",
      "actions.assign",
      "templates.read",
      "submissions.read",
      "submissions.create",
      "attachments.read",
      "attachments.upload",
      "comments.read",
      "comments.create",
    ],
    invitationTokenSeed: "apex-demo-manager-invitation-v1",
  },
  operator: {
    canonicalName: "line-operator",
    displayName: "Line Operator",
    description: "Basic member permissions for shop-floor operators.",
    scopeType: "self" as const,
    scopeUnitKey: null,
    permissions: [
      "actions.read",
      "submissions.create",
      "comments.read",
      "comments.create",
    ],
    invitationTokenSeed: "apex-demo-operator-invitation-v1",
  },
} as const;

export const DEMO_PLATFORM_SAMPLES = {
  actionTitle: "Review Cornwall line clearance checklist",
  templateName: "Line clearance checklist",
  templateDescription:
    "Minimal Milestone 4 template for local platform demonstrations.",
} as const;
