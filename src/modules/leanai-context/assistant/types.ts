import type { LeanAiCoachSurface } from "@/modules/leanai-context/interventions/types";
import type { LeanAiInterventionCandidate } from "@/modules/leanai-context/interventions/types";
import type { LeanAiModuleKey } from "@/modules/leanai-context/types";

import type { MaturityAuthoringStep } from "./constants";

export const ASSISTANT_WORKFLOWS = [
  "platform_home",
  "organisation_setup",
  "organisation_profile",
  "structure",
  "job_functions",
  "people",
  "maturity_overview",
  "maturity_models",
  "maturity_builder",
  "maturity_template_preview",
  "maturity_authoring",
  "maturity_assessment",
  "suggestions_overview",
  "programme_configuration",
  "five_s",
  "gemba",
  "training",
  "skills",
  "recognition",
  "lean_ai_settings",
  "generic_platform",
] as const;

export type AssistantWorkflow = (typeof ASSISTANT_WORKFLOWS)[number];

export type AssistantRouteIdentity = {
  pathname: string;
  search: string;
  module: LeanAiModuleKey;
  workflow: AssistantWorkflow;
  pageTitle: string;
  surface: LeanAiCoachSurface;
  entityId: string | null;
  authoringStep: MaturityAuthoringStep | null;
};

export type AssistantTerminologyEntry = {
  term: string;
  meaning: string;
};

export type AssistantPageDefinition = {
  module: LeanAiModuleKey;
  workflow: AssistantWorkflow;
  pageTitle: string;
  contextLabel: string;
  summary: string;
  terminology: readonly AssistantTerminologyEntry[];
  starterPrompts: readonly string[];
  facts: readonly string[];
};

export type AssistantRelevantState = Record<
  string,
  string | number | boolean | null
>;

export type LeanAiAssistantPageEnvelope = {
  module: LeanAiModuleKey;
  workflow: AssistantWorkflow;
  route: string;
  pageTitle: string;
  authoringStep: MaturityAuthoringStep | null;
  entityValidated: boolean;
};

export type LeanAiAssistantView = {
  organisationId: string;
  membershipId: string;
  organisation: {
    name: string;
  };
  capabilities: {
    webSearchEnabled: boolean;
  };
  applicationAiAvailable: boolean;
  conversationAvailable: boolean;
  conversationUnavailableReason: string | null;
  contextLabel: string;
  page: LeanAiAssistantPageEnvelope;
  site: {
    mode: string;
    activeSiteName: string | null;
  };
  terminology: AssistantTerminologyEntry[];
  starterPrompts: string[];
  summary: string;
  remainingSetup: Array<{
    key: string;
    status: string;
    reason: string;
  }>;
  relevantState: AssistantRelevantState;
  allowedActions: string[];
  recommendation: LeanAiInterventionCandidate | null;
};

export type LeanAiAssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string | null;
  source: "ai" | "static" | "deterministic";
  externalSources?: Array<{ title: string; url: string }>;
};
