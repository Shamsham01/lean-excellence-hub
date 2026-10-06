import type { MaturityFrameworkScopeType } from "@/modules/maturity/semantic-scope";

export const MATURITY_BUILDER_MODULE_KEY = "maturity" as const;
export const MATURITY_BUILDER_INTERVENTION_KEY =
  "maturity_framework_builder" as const;
export const MATURITY_BUILDER_SESSION_TITLE =
  "LeanAI Maturity Framework builder";
export const MATURITY_BUILDER_CONTEXT_CONTRACT_VERSION =
  "maturity-builder-context-v1" as const;
export const MATURITY_BUILDER_PAYLOAD_KIND =
  "maturity_framework_builder" as const;
export const MATURITY_BUILDER_PAYLOAD_VERSION = 1 as const;

/**
 * Caller metadata recorded by `create_maturity_model_draft_from_definition`
 * in the draft-created audit event. It is not a catalogue template key and
 * the RPC does not treat it as proof of provenance.
 */
export const MATURITY_BUILDER_DECLARED_KEY = "leanai-maturity-builder" as const;

export const MATURITY_BUILDER_ROUTE = "/platform/maturity/builder" as const;

export const MATURITY_BUILDER_MAX_MESSAGE_CHARS = 2000;
/** Per logical conversation. Organisation ceilings and rate limits still apply in the database. */
export const MATURITY_BUILDER_MAX_TURNS = 20;
export const MATURITY_BUILDER_HISTORY_WINDOW = 6;

export const MATURITY_BUILDER_LIMITS = {
  minLevels: 3,
  maxLevels: 5,
  minPillars: 1,
  maxPillars: 8,
  minCriteriaPerPillar: 1,
  maxCriteriaPerPillar: 6,
  maxCriteriaTotal: 36,
  minQuestionsPerCriterion: 1,
  maxQuestionsPerCriterion: 3,
  maxQuestionsTotal: 72,
  frameworkNameMax: 120,
  frameworkDescriptionMax: 600,
  levelNameMax: 60,
  pillarNameMax: 100,
  criterionNameMax: 140,
  textMax: 600,
  /** Below `template_questions_prompt_check` (500) so stored prompts always fit. */
  questionPromptMax: 400,
} as const;

export type MaturityBuilderIntent = "answer" | "propose" | "refine";

/** `retry` re-runs the latest request with its original intent and focus. */
export type MaturityBuilderRequestIntent = MaturityBuilderIntent | "retry";

export type MaturityBuilderFocus =
  | { kind: "framework" }
  | { kind: "levels" }
  | { kind: "pillar"; pillarIndex: number }
  | { kind: "criterion"; pillarIndex: number; criterionIndex: number };

export type MaturityBuilderUnderstanding = {
  assessmentPurpose: string | null;
  assessmentScope: string | null;
  pillars: string | null;
  levelPhilosophy: string | null;
  existingStandards: string | null;
  suggestionAreas: string | null;
  existingFramework: string | null;
};

export type MaturityBuilderDiscoveryQuestion = {
  question: string;
  suggestedAnswers: string[];
};

export type MaturityBuilderProposalQuestion = { prompt: string };

export type MaturityBuilderProposalCriterion = {
  name: string;
  description: string;
  guidance: string | null;
  questions: MaturityBuilderProposalQuestion[];
};

export type MaturityBuilderProposalPillar = {
  name: string;
  description: string | null;
  guidance: string | null;
  criteria: MaturityBuilderProposalCriterion[];
};

export type MaturityBuilderProposalLevel = {
  name: string;
  description: string;
  guidance: string | null;
};

/** Validated, normalised LeanAI proposal. Not a saved framework. */
export type MaturityBuilderProposal = {
  name: string;
  description: string;
  assessmentScopes: MaturityFrameworkScopeType[];
  levels: MaturityBuilderProposalLevel[];
  pillars: MaturityBuilderProposalPillar[];
};

export type MaturityBuilderProposalCounts = {
  levels: number;
  pillars: number;
  criteria: number;
  questions: number;
};

export type MaturityBuilderProposalStatus = "none" | "valid" | "invalid";

/** Stored in `ai_messages.structured_payload` for builder assistant turns. */
export type MaturityBuilderStoredPayload = {
  kind: typeof MATURITY_BUILDER_PAYLOAD_KIND;
  version: typeof MATURITY_BUILDER_PAYLOAD_VERSION;
  response_status: "ok" | "invalid_response";
  phase: "discovery" | "proposal";
  intent: MaturityBuilderIntent;
  focus: MaturityBuilderFocus | null;
  understanding: MaturityBuilderUnderstanding | null;
  questions: MaturityBuilderDiscoveryQuestion[];
  change_summary: string[];
  proposal_status: MaturityBuilderProposalStatus;
  proposal: MaturityBuilderProposal | null;
  proposal_issues: string[];
};

export type MaturityBuilderUserTurn = {
  id: string;
  role: "user";
  text: string;
  createdAt: string;
};

export type MaturityBuilderAssistantTurn = {
  id: string;
  role: "assistant";
  message: string;
  createdAt: string;
  responseStatus: "ok" | "invalid_response";
  phase: "discovery" | "proposal";
  intent: MaturityBuilderIntent;
  focus: MaturityBuilderFocus | null;
  questions: MaturityBuilderDiscoveryQuestion[];
  changeSummary: string[];
  proposalStatus: MaturityBuilderProposalStatus;
  proposalIssues: string[];
  /** Revision number when this turn carried a valid proposal. */
  proposalRevision: number | null;
};

export type MaturityBuilderTurn =
  MaturityBuilderUserTurn | MaturityBuilderAssistantTurn;

export type MaturityBuilderCurrentProposal = {
  messageId: string;
  revision: number;
  createdAt: string;
  proposal: MaturityBuilderProposal;
  counts: MaturityBuilderProposalCounts;
  changeSummary: string[];
};

export type MaturityBuilderConversationState = {
  sessionId: string;
  turns: MaturityBuilderTurn[];
  understanding: MaturityBuilderUnderstanding | null;
  pendingQuestions: MaturityBuilderDiscoveryQuestion[];
  currentProposal: MaturityBuilderCurrentProposal | null;
  /** True when the most recent assistant turn could not be used. */
  lastTurnInvalid: boolean;
  userTurnCount: number;
  latestMessageAt: string | null;
};
