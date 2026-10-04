export const DEMO_SITE = "Demo Manufacturing";
export const DEMO_VISITOR = "Visitor";
export const DEMO_MANAGER = "CI Manager";
export const SUGGESTION_REF = "SUG-DEMO-001";
export const ACTION_REF = "ACT-DEMO-001";
export const GEMBA_REF = "GEM-DEMO-001";

export type DemoModule =
  "home" | "suggestions" | "gemba" | "actions" | "problem-solving" | "maturity";

export type DemoView =
  | "selector"
  | "suggestion-form"
  | "suggestion-success"
  | "suggestion-record"
  | "suggestion-review"
  | "action-compose"
  | "action-success"
  | "action-record"
  | "action-list"
  | "gemba-walk"
  | "gemba-finding"
  | "problem-solving"
  | "maturity-questions"
  | "maturity-result"
  | "lineage";

export type DemoPerspective = "visitor" | "manager";

export type DemoActionSource = "suggestion" | "gemba" | "standalone";

export type SuggestionDecision = "request-info" | "park" | "decline" | "accept";

export type ActionStatus = "Open" | "In progress" | "Complete";

export type DemoNotificationKind =
  | "suggestion-submitted"
  | "suggestion-accepted"
  | "action-created"
  | "action-assigned";

export type DemoObjectType = "suggestion" | "action" | "gemba" | "maturity";

export type SuggestionDraft = {
  title: string;
  area: string;
  category: string;
  opportunity: string;
  benefit: string;
  evidenceName: string | null;
};

export type SuggestionRecord = SuggestionDraft & {
  id: typeof SUGGESTION_REF;
  status: "Submitted" | "Accepted" | "Parked" | "Declined" | "More information";
  submittedBy: typeof DEMO_VISITOR;
  createdLabel: "Just now";
  decision: SuggestionDecision | null;
};

export type ActionRecord = {
  id: string;
  title: string;
  owner: string;
  due: string;
  priority: "Low" | "Medium" | "High";
  source: string;
  status: ActionStatus;
  sourceKind: DemoActionSource;
};

export type GembaRecord = {
  id: typeof GEMBA_REF;
  area: string;
  finding: string;
  severity: "Observation" | "Issue" | "Escalate";
  promptAnswers: [string, string];
};

export type ProblemSolvingState = {
  stage: 0 | 1 | 2;
  define: string;
  currentCondition: string;
  cause: string;
  assistantDismissed: boolean;
};

export type MaturityAnswer = 1 | 2 | 3 | 4 | 5;

export type MaturityState = {
  index: number;
  answers: Array<MaturityAnswer | null>;
};

export type DemoNotification = {
  id: string;
  kind: DemoNotificationKind;
  title: string;
  body: string;
  meta: string;
  objectType: DemoObjectType;
  unread: boolean;
  createdLabel: "Just now";
};

export type DemoProgress = {
  label: string;
  stepIndex: number;
  stepCount: number;
};

export type DemoScenarioId =
  "suggestion" | "gemba" | "action" | "problem-solving" | "maturity";

export const SUGGESTION_EXAMPLE: SuggestionDraft = {
  title: "Move the changeover cleaning kit closer to the line.",
  area: "Packing",
  category: "Workplace organisation",
  opportunity: "Operators walk to the store several times during changeover.",
  benefit: "Reduce unnecessary movement and make the changeover easier.",
  evidenceName: null,
};

export const SUGGESTION_AREAS = [
  "Packing",
  "Goods-in",
  "Mixing",
  "Warehouse",
] as const;

export const SUGGESTION_CATEGORIES = [
  "Workplace organisation",
  "Safety",
  "Quality",
  "Standard work",
] as const;

export const ACTION_FROM_SUGGESTION: Omit<ActionRecord, "id" | "sourceKind"> = {
  title: "Relocate changeover cleaning kit to line-side storage",
  owner: "Area Leader",
  due: "Friday",
  priority: "Medium",
  source: SUGGESTION_REF,
  status: "Open",
};

export const ACTION_FROM_GEMBA: Omit<ActionRecord, "id" | "sourceKind"> = {
  title: "Restore pallet labels to point of use after changeover",
  owner: "Area Leader",
  due: "Friday",
  priority: "High",
  source: GEMBA_REF,
  status: "Open",
};

export const STANDALONE_ACTION: Omit<ActionRecord, "id" | "sourceKind"> = {
  title: "Confirm line-side storage is used on every changeover",
  owner: "Area Leader",
  due: "Friday",
  priority: "Medium",
  source: "Standalone",
  status: "Open",
};

export const ACTION_OWNERS = [
  "Area Leader",
  "Site Supervisor",
  "CI Manager",
  "Visitor",
] as const;

export const ACTION_DUES = [
  "Today",
  "Tomorrow",
  "Friday",
  "Next week",
] as const;

export const GEMBA_PROMPTS = [
  {
    question: "Is the changeover standard visible at the station?",
    hint: "Look at the board, not the meeting room.",
  },
  {
    question: "Are pallet labels stored at the point of use?",
    hint: "After the last SKU changeover.",
  },
] as const;

export const GEMBA_FINDING_EXAMPLE = {
  area: "Packing",
  finding: "Pallet labels are not stored at point of use after changeover.",
  severity: "Issue" as const,
};

export const PROBLEM_EXAMPLE = {
  define:
    "Labels are repeatedly missing from the station after SKU changeovers.",
  currentCondition:
    "Operators leave the line to collect labels from the store after most changeovers. The station is empty when the next SKU starts.",
  cause:
    "Labels are packed away with the previous SKU kit instead of remaining at the station.",
};

export const PROBLEM_STAGES = [
  "Define",
  "Current condition",
  "Cause",
  "Countermeasure",
  "Check",
  "Sustain",
] as const;

export const MATURITY_QUESTIONS = [
  {
    pillar: "Operations",
    prompt:
      "Gemba walks happen on a defined routine, not only when something goes wrong.",
  },
  {
    pillar: "Improvement discipline",
    prompt: "Actions are closed on time, with evidence of what changed.",
  },
  {
    pillar: "Operations",
    prompt: "Workplace organisation is sustained at the point of use.",
  },
  {
    pillar: "Improvement discipline",
    prompt:
      "Problem solving verifies cause before a countermeasure is assigned.",
  },
  {
    pillar: "Capability",
    prompt: "People have the capability required for the work they own.",
  },
] as const;

export const MATURITY_PILLARS = [
  "Operations",
  "People",
  "Improvement discipline",
  "Capability",
  "Leadership",
] as const;

export const DEMO_SCENARIOS: Array<{
  id: DemoScenarioId;
  module: DemoModule;
  title: string;
  duration: string;
  summary: string;
  featured?: boolean;
}> = [
  {
    id: "suggestion",
    module: "suggestions",
    title: "Suggestion",
    duration: "Flagship",
    summary:
      "Submit an idea, see it reviewed, and convert it into an owned action.",
    featured: true,
  },
  {
    id: "gemba",
    module: "gemba",
    title: "Gemba",
    duration: "Short path",
    summary: "Walk the packing cell, record a finding and create follow-up.",
  },
  {
    id: "action",
    module: "actions",
    title: "Action",
    duration: "Quick",
    summary: "Create an accountable action and move it through to complete.",
  },
  {
    id: "problem-solving",
    module: "problem-solving",
    title: "Problem solving",
    duration: "A few steps",
    summary:
      "Define the problem, describe the current condition and examine cause.",
  },
  {
    id: "maturity",
    module: "maturity",
    title: "Maturity",
    duration: "Five questions",
    summary: "Take an illustrative snapshot — not the 60-question Standard.",
  },
];

export const MODULE_NAV: Array<{ id: DemoModule; label: string }> = [
  { id: "home", label: "Workflows" },
  { id: "suggestions", label: "Suggestions" },
  { id: "gemba", label: "Gemba" },
  { id: "actions", label: "Actions" },
  { id: "problem-solving", label: "Problem solving" },
  { id: "maturity", label: "Maturity" },
];

export const SUGGESTION_TIMELINE = [
  "Idea submitted",
  "Review",
  "Decision",
  "Action / Project",
  "Complete",
] as const;

export const SUGGESTION_SUBMIT_STEPS = [
  "Saving idea",
  "Creating record",
  "Routing for review",
  "Ready",
] as const;

export const ACTION_CREATE_STEPS = [
  "Capturing action",
  "Assigning owner",
  "Ready",
] as const;

export const REVIEW_STEPS = [
  "Recording decision",
  "Updating status",
  "Ready",
] as const;
