/**
 * LeanAI contextual assistance contracts.
 *
 * Journey context exists solely to improve setup assistance, avoid repetitive
 * prompts, and provide relevant help. It must not become employee productivity
 * scoring, ranking, disciplinary profiling, or time-at-screen measurement.
 */

export const SETUP_READINESS_STATUSES = [
  "not_started",
  "incomplete",
  "ready",
  "blocked",
] as const;

export type SetupReadinessStatus = (typeof SETUP_READINESS_STATUSES)[number];

export const SETUP_READINESS_KEYS = [
  "organisation",
  "sites",
  "people",
  "maturity",
  "suggestions",
  "five_s",
  "gemba",
  "training",
  "skills",
  "recognition",
  "lean_ai",
] as const;

export type SetupReadinessKey = (typeof SETUP_READINESS_KEYS)[number];

export const LEANAI_SEMANTIC_EVENT_KEYS = [
  "onboarding.started",
  "onboarding.step_completed",
  "onboarding.step_skipped",
  "onboarding.completed",
  "module.opened",
  "leanai.intervention_shown",
  "leanai.intervention_accepted",
  "leanai.intervention_dismissed",
  "leanai.intervention_snoozed",
] as const;

export type LeanAiSemanticEventKey =
  (typeof LEANAI_SEMANTIC_EVENT_KEYS)[number];

export const LEANAI_MODULE_KEYS = [
  "organisation",
  "sites",
  "people",
  "maturity",
  "suggestions",
  "five_s",
  "gemba",
  "training",
  "skills",
  "recognition",
  "lean_ai",
  "problem_solving",
  "setup",
  "onboarding",
  "platform",
] as const;

export type LeanAiModuleKey = (typeof LEANAI_MODULE_KEYS)[number];

export const LEANAI_ONBOARDING_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;

export type LeanAiOnboardingStatus =
  (typeof LEANAI_ONBOARDING_STATUSES)[number];

export type SetupReadinessSupportingMetrics = Record<
  string,
  string | number | boolean | null
>;

export type SetupReadinessItem = {
  key: SetupReadinessKey;
  status: SetupReadinessStatus;
  reason: string;
  reasonCode: string;
  prerequisites: SetupReadinessKey[];
  recommendedAction: string;
  targetRoute: string;
  supportingMetrics: SetupReadinessSupportingMetrics;
};

export type OrganisationSetupReadiness = {
  organisationId: string;
  evaluatedAt: string;
  readyCount: number;
  totalCount: number;
  items: SetupReadinessItem[];
};

export type LeanAiInterventionState = {
  interventionKey: string;
  lastEventKey: LeanAiSemanticEventKey;
  lastShownAt: string | null;
  lastAcceptedAt: string | null;
  lastDismissedAt: string | null;
  snoozedUntil: string | null;
};

export type LeanAiJourneyContext = {
  organisationId: string;
  membershipId: string;
  recentModuleKey: LeanAiModuleKey | null;
  recentModuleOpenedAt: string | null;
  onboardingStatus: LeanAiOnboardingStatus;
  lastOnboardingStepKey: string | null;
  lastOnboardingEventKey: LeanAiSemanticEventKey | null;
  lastOnboardingAt: string | null;
  lastInterventionKey: string | null;
  lastInterventionEventKey: LeanAiSemanticEventKey | null;
  lastInterventionAt: string | null;
  interventionStates: LeanAiInterventionState[];
};

export type LeanAiRetentionPolicy = {
  eventRetentionDays: number;
  cleanupAvailable: boolean;
};

export type LeanAiContextualSnapshot = {
  readiness: OrganisationSetupReadiness;
  journey: LeanAiJourneyContext;
  retention: LeanAiRetentionPolicy;
  applicationAiAvailable: boolean;
  proactiveAssistanceEnabled: boolean;
  webSearchEnabled: boolean;
};

export type LeanAiSemanticEventInput = {
  eventKey: LeanAiSemanticEventKey;
  eventVersion?: number;
  moduleKey?: LeanAiModuleKey;
  interventionKey?: string;
  siteUnitId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  occurredAt?: string;
};

export type SetupReadinessFacts = {
  organisationOperational: boolean;
  organisationStatus: string;
  organisationName: string | null;
  onboardingRequired: boolean;
  activeBillableSiteCount: number;
  activeUnitCount: number;
  hasActiveOwner: boolean;
  activeJobFunctionCount: number;
  maturityModelCount: number;
  publishedMaturityVersionCount: number;
  suggestionProgrammeCount: number;
  activePublishedSuggestionProgrammeCount: number;
  fiveSStandardCount: number;
  publishedApplicableFiveSCount: number;
  gembaDefinitionCount: number;
  publishedApplicableGembaCount: number;
  trainingCourseCount: number;
  publishedTrainingCourseCount: number;
  publishedTrainingCurriculumWithRequirementCount: number;
  skillScaleCount: number;
  skillCount: number;
  skillCapabilitySetCount: number;
  publishedSkillScaleWithLevelCount: number;
  activeSkillCount: number;
  publishedSkillCapabilitySetWithRequirementCount: number;
  recognitionTypeCount: number;
  activeRecognitionTypeCount: number;
  leanAiOrganisationEnabled: boolean;
  leanAiCurrentUserCanUse: boolean;
};
