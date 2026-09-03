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
  finance: {
    id: "a0000000-0000-0000-0000-000000000004",
    email: "finance@apex.local",
    password: "Finance@Apex-Dev-2026!",
    displayName: "Apex Finance",
  },
  psContributor: {
    id: "a0000000-0000-0000-0000-000000000005",
    email: "ps-contributor@apex.local",
    password: "PsContributor@Apex-Dev-2026!",
    displayName: "PS Contributor",
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
      "problem_solving.close",
      "ai.use",
      "ai.view_history",
    ],
    invitationTokenSeed: "apex-demo-manager-invitation-v1",
  },
  financeValidator: {
    canonicalName: "finance-validator",
    displayName: "Finance Validator",
    description: "Least-privilege finance validation for improvement benefits.",
    scopeType: "organisation" as const,
    scopeUnitKey: null,
    permissions: [
      "hierarchy.read",
      "memberships.read",
      "benefits.read",
      "benefits.validate.finance",
      "benefits.realisation.validate",
    ],
    invitationTokenSeed: "apex-demo-finance-invitation-v1",
  },
  psContributor: {
    canonicalName: "ps-contributor",
    displayName: "Problem Solving Contributor",
    description:
      "View and contribute to problem solving cases without verify or close rights.",
    scopeType: "organisation" as const,
    scopeUnitKey: null,
    permissions: ["problem_solving.view", "problem_solving.contribute"],
    invitationTokenSeed: "apex-demo-ps-contributor-invitation-v1",
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
  suggestionsReviewer: {
    canonicalName: "suggestions-reviewer",
    displayName: "Suggestions Reviewer",
    description:
      "Organisation-scoped reviewer for S2b2 workflow end-to-end fixtures.",
    scopeType: "organisation" as const,
    scopeUnitKey: null,
    permissions: ["suggestions.read", "suggestions.review"],
    invitationTokenSeed: "apex-demo-suggestions-reviewer-invitation-v1",
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
  name: "Continuous Improvement Ideas",
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

export const S2B2_WORKFLOW_FIXTURE_TITLES = {
  claim: "S2b2 workflow claim target",
  decline: "S2b2 workflow decline target",
  assign: "S2b2 workflow assign target",
  reassign: "S2b2 workflow reassign target",
  parked: "S2b2 workflow parked target",
  staleClaim: "S2b2 workflow stale claim target",
} as const;

/** Minimum suggestions after demo seed (M9 + S3a + S2b2 fixtures). */
export const DEMO_SUGGESTION_PORTFOLIO_MIN_COUNT = 40;

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

export const DEMO_BENEFIT_CATEGORIES = [
  { code: "waste", name: "Waste", displayOrder: 1 },
  { code: "labour-productivity", name: "Labour/Productivity", displayOrder: 2 },
  { code: "quality", name: "Quality", displayOrder: 3 },
  { code: "energy", name: "Energy", displayOrder: 4 },
  { code: "materials", name: "Materials", displayOrder: 5 },
  { code: "maintenance", name: "Maintenance", displayOrder: 6 },
  { code: "capacity", name: "Capacity", displayOrder: 7 },
  { code: "customer", name: "Customer", displayOrder: 8 },
  { code: "safety", name: "Safety", displayOrder: 9 },
  { code: "people", name: "People", displayOrder: 10 },
  { code: "sustainability", name: "Sustainability", displayOrder: 11 },
] as const;

export const DEMO_BENEFITS = [
  {
    key: "packaging-waste",
    projectCode: "packaging-waste",
    title: "Packaging Waste Reduction Savings",
    benefitClass: "financial" as const,
    financialType: "hard_saving" as const,
    categoryCode: "materials",
    baselineFinancialValue: 42_000,
    baselineDescription:
      "Annual packaging scrap cost before reduction programme.",
    forecastTotal: 36_000,
    realisationPattern: "recurring" as const,
    forecastStart: "2026-01-01",
    forecastEnd: "2026-12-31",
    monthlyForecastAmount: 3_000,
    targetStatus: "realising" as const,
    realisationEntries: [
      {
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        financialAmount: 2_800,
        dataSource: "Monthly scrap report",
      },
      {
        periodStart: "2026-02-01",
        periodEnd: "2026-02-28",
        financialAmount: 3_100,
        dataSource: "Monthly scrap report",
      },
    ],
  },
  {
    key: "changeover-reduction",
    projectCode: "changeover-reduction",
    title: "Changeover Time Savings",
    benefitClass: "financial" as const,
    financialType: "soft_saving" as const,
    categoryCode: "capacity",
    baselineFinancialValue: 18_000,
    baselineDescription: "Labour cost of excess changeover time on Line 2.",
    forecastTotal: 24_000,
    realisationPattern: "recurring" as const,
    forecastStart: "2026-01-01",
    forecastEnd: "2026-12-31",
    monthlyForecastAmount: 2_000,
    targetStatus: "realising" as const,
    realisationEntries: [
      {
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        financialAmount: 1_500,
        dataSource: "Changeover log",
      },
    ],
  },
  {
    key: "maintenance-avoidance",
    title: "Preventive Maintenance Cost Avoidance",
    benefitClass: "financial" as const,
    financialType: "cost_avoidance" as const,
    categoryCode: "maintenance",
    standalone: true,
    baselineFinancialValue: 12_000,
    baselineDescription: "Avoided emergency maintenance spend on filler line.",
    forecastTotal: 12_000,
    realisationPattern: "one_off" as const,
    forecastStart: "2026-03-01",
    forecastEnd: "2026-03-31",
    targetStatus: "submitted" as const,
    ciValidated: true,
  },
  {
    key: "visual-standards",
    projectCode: "visual-standards",
    title: "Visual Standards Quality Improvement",
    benefitClass: "non_financial" as const,
    nonFinancialType: "quality" as const,
    categoryCode: "quality",
    baselineMeasureValue: 120,
    baselineMeasureUnit: "ppm",
    baselineDescription: "Visual defect rate before standards deployment.",
    targetMeasureValue: 60,
    targetMeasureUnit: "ppm",
    targetDate: "2026-02-01",
    realisationPattern: "one_off" as const,
    forecastStart: "2026-01-01",
    forecastEnd: "2026-02-28",
    targetStatus: "realised" as const,
    realisationEntries: [
      {
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        measureValue: 95,
        measureUnit: "ppm",
        dataSource: "Quality inspection log",
      },
      {
        periodStart: "2026-02-01",
        periodEnd: "2026-02-28",
        measureValue: 58,
        measureUnit: "ppm",
        dataSource: "Quality inspection log",
      },
    ],
  },
] as const;

export const DEMO_PROBLEM_SOLVING_CASE = {
  title: "Packaging Line 3 Recurring Seal Defects",
  methodBuiltinCode: "a3_structured",
  problemStatement:
    "Recurring seal defects on Packaging Line 3 exceed the expected quality level and drive rework and scrap.",
  background:
    "Seal defects have increased over the last three production weeks on Line 3 after a maintenance intervention on the sealing station.",
  businessImpact:
    "Higher scrap, repeated rework, and elevated customer complaint risk on appearance-sensitive packs.",
  scopeIn: "Packaging Line 3 sealing station, film feed, and changeover setup.",
  scopeOut: "Upstream filler chemistry and downstream palletising.",
  targetCondition:
    "Seal defect rate sustained below 120 ppm with stable changeover performance.",
  priority: "high" as const,
  severity: "major" as const,
  currentCondition: {
    measuredFact:
      "Seal defect rate averaged 210 ppm across the last five production runs on Line 3.",
    observation:
      "Defects cluster on the leading seal immediately after film splice events.",
    assumption:
      "Operators may be rushing changeover because the line is behind schedule.",
  },
  containment: {
    description:
      "Increase in-process seal inspection frequency and hold suspect packs after splice events.",
    rationale: "Reduce customer exposure while root cause analysis proceeds.",
    actionTitle: "Hold packs after film splice until seal check passes",
  },
  hypotheses: {
    pressureVariation: {
      statement:
        "Sealing jaw pressure varies outside the validated setup window.",
      category: "Machine",
    },
    filmTension: {
      statement:
        "Film tension drift during run causes inconsistent seal bead formation.",
      category: "Material",
    },
    setupInconsistency: {
      statement:
        "Changeover setup for jaw height is inconsistent between shifts.",
      category: "Method",
    },
  },
  countermeasure: {
    title: "Replace sealing jaw regulator and add pressure verification check",
    description:
      "Replace the faulty regulator, recalibrate jaw pressure, and add a pre-run pressure verification step.",
    rationale:
      "Pressure test evidence supports mechanical instability as the verified cause.",
    actionTitle: "Replace Line 3 sealing jaw regulator and update PM checklist",
  },
  effectiveness: {
    criterion: "Seal defect rate (ppm)",
    baselineNumeric: 210,
    targetNumeric: 120,
    actualNumeric: 95,
    unit: "ppm",
    observationWindowStart: "2026-02-01",
    observationWindowEnd: "2026-02-28",
  },
  sustainment: {
    what: "Add sealing jaw pressure verification to the Line 3 changeover standard and weekly PM checklist.",
    checkMethod:
      "Technician verifies pressure within validated range before release to run.",
    result:
      "Standard work updated and first audit completed without deviation.",
  },
  session: {
    title: "Line 3 seal defect investigation review",
    summary:
      "Team reviewed test evidence, confirmed regulator instability as verified cause, and agreed countermeasure plus sustainment actions.",
    decision:
      "Proceed with regulator replacement and add pressure verification to changeover standard work.",
  },
  closureRationale:
    "Verified mechanical cause addressed with selected countermeasure; effectiveness check passed across the observation window.",
} as const;
