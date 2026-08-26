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
      "job_functions.read",
      "job_functions.manage",
      "training.read",
      "training.catalog.manage",
      "training.curriculum.manage",
      "training.sessions.manage",
      "training.completions.manage",
      "skills.read",
      "skills.catalog.manage",
      "skills.requirements.manage",
      "skills.assess",
      "people.capability.read",
      "training.read",
      "skills.read",
      "suggestions.read",
      "suggestions.review",
      "suggestions.manage",
      "recognition.read",
      "recognition.award",
      "projects.read",
      "projects.manage",
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
      "five_s.read",
      "five_s.audit.perform",
      "gemba.read",
      "gemba.walk.perform",
      "schedules.read",
      "people.capability.read",
      "training.read",
      "skills.read",
      "suggestions.read",
      "suggestions.submit",
      "recognition.read",
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

export const DEMO_FIVE_S_CATEGORIES = [
  "Sort",
  "Set in Order",
  "Shine",
  "Standardise",
  "Sustain",
] as const;

export const DEMO_FIVE_S_STANDARD = {
  name: "Production 5S Standard",
  description: "Cornwall Plant / Operations 5S programme.",
  unitKey: "operations",
} as const;

export const DEMO_GEMBA_DEFINITION = {
  name: "Operations Gemba",
  description: "Weekly operations leadership Gemba walk.",
  unitKey: "operations",
} as const;

export const DEMO_JOB_FUNCTIONS = [
  { code: "operator", name: "Operator" },
  { code: "team-leader", name: "Team Leader" },
  { code: "engineer", name: "Engineer" },
  { code: "shift-manager", name: "Shift Manager" },
  { code: "department-manager", name: "Department Manager" },
] as const;

export const DEMO_TRAINING_SESSION = {
  title: "White Belt Classroom Session",
  courseCode: "white-belt",
} as const;

export const DEMO_TRAINING_COURSES = [
  { code: "lean-basic", name: "Lean Basic", validityDays: 365 },
  { code: "white-belt", name: "White Belt", validityDays: 365 },
  { code: "yellow-belt", name: "Yellow Belt", validityDays: 730 },
  { code: "green-belt", name: "Green Belt", validityDays: 730 },
  { code: "five-s-practitioner", name: "5S Practitioner", validityDays: 365 },
  { code: "problem-solving", name: "Problem Solving", validityDays: 365 },
] as const;

export const DEMO_SKILLS = [
  { code: "five-s-auditing", name: "5S Auditing" },
  { code: "gemba-coaching", name: "Gemba Coaching" },
  { code: "a3-facilitation", name: "A3 Facilitation" },
  { code: "problem-solving", name: "Problem Solving" },
  { code: "root-cause-analysis", name: "Root Cause Analysis" },
] as const;

export const DEMO_PROFICIENCY_SCALE = {
  name: "Operational Competency Scale",
  levels: [
    { order: 0, label: "Not Assessed" },
    { order: 1, label: "Awareness" },
    { order: 2, label: "Developing" },
    { order: 3, label: "Competent" },
    { order: 4, label: "Advanced" },
    { order: 5, label: "Coach / Trainer" },
  ],
} as const;

export const DEMO_SUGGESTION_PROGRAMME = {
  name: "Everyday Improvement Ideas",
  code: "everyday-ideas",
  reviewTargetDays: 7,
} as const;

export const DEMO_SUGGESTION_CATEGORIES = [
  { code: "safety", name: "Safety" },
  { code: "quality", name: "Quality" },
  { code: "delivery", name: "Delivery" },
  { code: "cost", name: "Cost" },
  { code: "people", name: "People" },
  { code: "waste", name: "Waste" },
] as const;

export const DEMO_RECOGNITION_TYPES = [
  { code: "great-idea", name: "Great Idea" },
  { code: "kaizen-contributor", name: "Kaizen Contributor" },
  { code: "improvement-champion", name: "Improvement Champion" },
  { code: "coach-support", name: "Coach & Support" },
] as const;

export const DEMO_CI_METHODOLOGIES = [
  {
    code: "dmaic",
    name: "DMAIC",
    phases: ["Define", "Measure", "Analyze", "Improve", "Control"],
  },
  {
    code: "pdca",
    name: "PDCA",
    phases: ["Plan", "Do", "Check", "Act"],
  },
  {
    code: "kaizen-event",
    name: "Kaizen Event",
    phases: ["Prepare", "Discover", "Implement", "Close"],
  },
  {
    code: "basic-improvement",
    name: "Basic Improvement",
    phases: ["Identify", "Implement", "Verify"],
  },
] as const;

export const DEMO_CI_PROJECTS = [
  {
    code: "changeover-reduction",
    title: "Changeover Reduction",
    methodologyCode: "dmaic",
    status: "active" as const,
    problem: "Changeovers on Line 2 exceed the 45-minute target.",
    objective: "Reduce average changeover time below 30 minutes.",
    metric: {
      key: "changeover-minutes",
      name: "Changeover duration",
      unit: "minutes",
      baseline: 48,
      target: 28,
    },
  },
  {
    code: "packaging-waste",
    title: "Packaging Waste Reduction",
    methodologyCode: "pdca",
    status: "active" as const,
    problem: "Packaging scrap on the filler line is above target.",
    objective: "Cut packaging waste by 20%.",
    metric: {
      key: "scrap-rate",
      name: "Packaging scrap rate",
      unit: "%",
      baseline: 4.2,
      target: 3.0,
    },
  },
  {
    code: "line3-kaizen",
    title: "Line 3 Workplace Organisation Kaizen",
    methodologyCode: "kaizen-event",
    status: "on_hold" as const,
    problem: "Line 3 workstations lack consistent organisation.",
    objective: "Standardise workplace layout and tooling placement.",
    metric: {
      key: "audit-score",
      name: "5S audit score",
      unit: "points",
      baseline: 62,
      target: 85,
    },
  },
  {
    code: "visual-standards",
    title: "Visual Standards Improvement",
    methodologyCode: "basic-improvement",
    status: "completed" as const,
    problem: "Visual standards for labels were inconsistent.",
    objective: "Deploy consistent visual standards across packaging.",
    metric: {
      key: "defect-rate",
      name: "Visual defect rate",
      unit: "ppm",
      baseline: 120,
      target: 60,
    },
  },
] as const;
