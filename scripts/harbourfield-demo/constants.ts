export const HARBOURFIELD_ORGANISATION = {
  code: "harbourfield-foods-group",
  name: "Harbourfield Foods Group",
  primarySiteName: "Bodmin Bakery",
} as const;

export const HARBOURFIELD_ORGANISATION_CODE = HARBOURFIELD_ORGANISATION.code;

/** Explicit hosted demo project ref — set via env on run; placeholder documents contract. */
export const HARBOURFIELD_HOSTED_DEMO_PROJECT_REF_ENV =
  "LEANHUB_HARBOURFIELD_DEMO_PROJECT_REF";

export const HARBOURFIELD_HOSTED_APPLY_CONFIRM_TOKEN =
  "APPLY_HARBOURFIELD_DEMO_TOP_UP";

export const HARBOURFIELD_USERS = {
  admin: {
    id: "c0000000-0000-0000-0000-000000000001",
    email: "admin@harbourfield.local",
    password: "Admin@Harbourfield-Demo-2026!",
    displayName: "Harbourfield Admin",
  },
  manager: {
    id: "c0000000-0000-0000-0000-000000000002",
    email: "manager@harbourfield.local",
    password: "Manager@Harbourfield-Demo-2026!",
    displayName: "Harbourfield Manager",
  },
  operator: {
    id: "c0000000-0000-0000-0000-000000000003",
    email: "operator@harbourfield.local",
    password: "Operator@Harbourfield-Demo-2026!",
    displayName: "Harbourfield Operator",
  },
} as const;

export type HarbourfieldUserKey = keyof typeof HARBOURFIELD_USERS;

export const HARBOURFIELD_UNITS = [
  {
    key: "bodmin-bakery",
    code: "bodmin-bakery",
    name: "Bodmin Bakery",
    type: "plant",
    parentKey: null,
  },
  {
    key: "packing",
    code: "packing",
    name: "Packing",
    type: "department",
    parentKey: "bodmin-bakery",
  },
  {
    key: "packing-line-1",
    code: "packing-line-1",
    name: "Packing Line 1",
    type: "area",
    parentKey: "packing",
  },
] as const;

export const HARBOURFIELD_ROLES = {
  manager: {
    canonicalName: "bodmin-plant-manager",
    displayName: "Bodmin Plant Manager",
    description: "Site manager for Bodmin Bakery.",
    scopeType: "unit_subtree" as const,
    scopeUnitKey: "bodmin-bakery",
    permissions: [
      "hierarchy.read",
      "memberships.read",
      "actions.read",
      "actions.create",
      "actions.update",
      "actions.assign",
      "actions.complete",
      "maturity.read",
      "maturity.assess.formal",
      "maturity.review",
      "maturity.approve",
      "maturity.results.publish",
      "five_s.read",
      "five_s.standards.manage",
      "five_s.audit.perform",
      "five_s.audit.review",
      "gemba.read",
      "gemba.definitions.manage",
      "gemba.walk.perform",
      "gemba.walk.review",
      "schedules.read",
      "schedules.manage",
      "schedules.complete",
      "suggestions.read",
      "suggestions.review",
      "suggestions.manage",
      "suggestions.programmes.manage",
      "projects.read",
      "projects.manage",
      "benefits.read",
      "benefits.create",
      "benefits.manage",
      "benefits.validate.ci",
      "benefits.realisation.record",
      "problem_solving.view",
      "problem_solving.create",
      "problem_solving.contribute",
      "problem_solving.manage",
      "problem_solving.facilitate",
      "problem_solving.verify_cause",
      "ai.use",
      "ai.view_history",
    ],
    invitationTokenSeed: "harbourfield-demo-manager-invitation-v1",
  },
  operator: {
    canonicalName: "packing-operator",
    displayName: "Packing Operator",
    description: "Shop-floor operator on Packing Line 1.",
    scopeType: "self" as const,
    scopeUnitKey: null,
    permissions: [
      "actions.read",
      "maturity.read",
      "maturity.assess.self",
      "five_s.read",
      "five_s.audit.perform",
      "gemba.read",
      "gemba.walk.perform",
      "schedules.read",
      "suggestions.read",
      "suggestions.submit",
    ],
    invitationTokenSeed: "harbourfield-demo-operator-invitation-v1",
  },
} as const;

export const HARBOURFIELD_STORYLINE = {
  gembaDefinitionName: "Bodmin Bakery Morning Gemba",
  fiveSStandardName: "Bodmin Bakery Packing 5S Standard",
  maturityModelName: "Harbourfield Operating Standard",
  suggestionProgrammeCode: "everyday-improvements",
  suggestionProgrammeName: "Everyday Improvements",
  gembaWalkCompletedSummary:
    "Morning Gemba — packaging film misalignment observed on Line 1.",
  gembaObservationText:
    "Packaging film misaligned on Packing Line 1 — leading edge drifting after splice.",
  correctiveActionTitle: "Realign the film guide and confirm the first-off pack",
  overdueActionTitle:
    "Harbourfield demo overdue: confirm film guide torque settings",
  problemSolvingCaseTitle: "Recurring film wander on Packing Line 1",
  problemSolvingSessionTitle: "Line 1 film-path cause review",
  projectTitle: "Packing Line 1 film-path countermeasures",
  benefitTitle: "Packing line film-path stability improvement",
  suggestionTitle: "Improve film splice checklist at Packing Line 1",
  inProgressGembaWalkNote: "In-progress Gemba — Packing Line 1 film path check.",
  inProgressFiveSAuditNote: "In-progress 5S — Packing Line 1 sustainment audit.",
} as const;

export const HARBOURFIELD_FIXTURE_TAGS = {
  prefix: "[Harbourfield demo]",
} as const;
