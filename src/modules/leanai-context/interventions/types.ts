import type {
  LeanAiContextualSnapshot,
  LeanAiModuleKey,
  SetupReadinessKey,
  SetupReadinessStatus,
} from "../types";

/**
 * LeanAI Coach surfaces for CONTEXT-03. Keep this list small; later modules
 * reuse the same engine without duplicating ranking logic.
 */
export const LEANAI_COACH_SURFACES = [
  "onboarding",
  "setup",
  "platform_home",
  "workspace",
  "maturity",
  "suggestions",
] as const;

export type LeanAiCoachSurface = (typeof LEANAI_COACH_SURFACES)[number];

export const LEANAI_COACH_PRESENTATIONS = [
  "card",
  "empty_state",
  "compact",
] as const;

export type LeanAiCoachPresentation =
  (typeof LEANAI_COACH_PRESENTATIONS)[number];

export type LeanAiInterventionDefinition = {
  key: string;
  moduleKey: LeanAiModuleKey;
  readinessKey: SetupReadinessKey;
  eligibleStatuses: readonly SetupReadinessStatus[];
  requiredPermissions: readonly string[];
  priority: number;
  surfaces: readonly LeanAiCoachSurface[];
  title: string;
  body: string;
  explain: string;
  primaryCtaLabel: string;
  targetRoute: string;
  dismissCooldownHours: number;
  snoozeMinutes: number;
};

export type LeanAiInterventionCandidate = {
  key: string;
  moduleKey: LeanAiModuleKey;
  readinessKey: SetupReadinessKey;
  status: SetupReadinessStatus;
  priority: number;
  title: string;
  body: string;
  explain: string;
  primaryCtaLabel: string;
  targetRoute: string;
  snoozeMinutes: number;
  organisationId: string;
};

export type LeanAiInterventionSelectionInput = {
  snapshot: LeanAiContextualSnapshot;
  permissions: Record<string, boolean>;
  surface: LeanAiCoachSurface;
  now?: Date;
  limit?: number;
};
