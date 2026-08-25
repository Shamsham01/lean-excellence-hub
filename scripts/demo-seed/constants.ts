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
      "maturity.read",
      "maturity.assess.formal",
      "maturity.review",
      "maturity.approve",
      "maturity.results.publish",
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
      "templates.read",
      "comments.read",
      "comments.create",
      "maturity.read",
      "maturity.assess.self",
    ],
    invitationTokenSeed: "apex-demo-operator-invitation-v1",
  },
} as const;

export const DEMO_PLATFORM_SAMPLES = {
  actionTitle: "Review Cornwall line clearance checklist",
  templateName: "Line clearance checklist",
  templateDescription:
    "Minimal Milestone 4 template for local platform demonstrations.",
  maturityFrameworkName: "Lean Excellence Framework",
  maturityFrameworkDescription:
    "Demonstration maturity framework for Apex Manufacturing local development.",
} as const;

export const DEMO_MATURITY_LEVELS = [
  { number: 1, name: "Initial", color: "maturity-1" },
  { number: 2, name: "Developing", color: "maturity-2" },
  { number: 3, name: "Defined", color: "maturity-3" },
  { number: 4, name: "Embedded", color: "maturity-4" },
  { number: 5, name: "Excellence", color: "maturity-5" },
] as const;

export const DEMO_MATURITY_PILLARS = [
  {
    name: "Leadership",
    criteria: [
      "Leaders conduct structured Gemba",
      "Leadership standard work visible",
    ],
  },
  {
    name: "People & Capability",
    criteria: ["Skills matrix maintained", "Training plans active"],
  },
  {
    name: "Daily Management",
    criteria: ["Tier meetings run daily", "Visual boards current"],
  },
  {
    name: "Continuous Improvement",
    criteria: ["CI projects tracked", "Suggestion system active"],
  },
  {
    name: "Problem Solving",
    criteria: ["A3 countermeasure verification", "Root cause analysis used"],
  },
  {
    name: "Standardisation",
    criteria: ["Standards documented", "Standards audited"],
  },
  {
    name: "Flow & Waste Elimination",
    criteria: ["Value stream mapped", "Waste reduction targets set"],
  },
] as const;
