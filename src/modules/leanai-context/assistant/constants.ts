export const LEANAI_ASSISTANT_MODULE_KEY = "platform" as const;
export const LEANAI_ASSISTANT_INTERVENTION_KEY = "workspace_assistant";
export const LEANAI_PAGE_CONTEXT_CONTRACT_VERSION = "leanai-page-context-v1";

export const LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY =
  "leanai-assistant-desktop-open";
export const LEANAI_ASSISTANT_SESSION_STORAGE_PREFIX =
  "leanai-assistant-session:";
export const LEANAI_ASSISTANT_CLEARED_AT_STORAGE_PREFIX =
  "leanai-assistant-cleared-at:";

export const LEANAI_ASSISTANT_MAX_TURNS = 24;
export const LEANAI_ASSISTANT_MAX_MESSAGE_CHARS = 2000;
export const LEANAI_ASSISTANT_HISTORY_WINDOW = 6;

export const MATURITY_AUTHORING_STEPS = [
  "details",
  "scopes",
  "levels",
  "pillars",
  "criteria",
  "questions",
  "review",
  "publish",
] as const;

export type MaturityAuthoringStep = (typeof MATURITY_AUTHORING_STEPS)[number];

export const MATURITY_AUTHORING_STEP_LABELS: Record<
  MaturityAuthoringStep,
  string
> = {
  details: "Details",
  scopes: "Assessment scope",
  levels: "Levels",
  pillars: "Pillars",
  criteria: "Criteria",
  questions: "Questions",
  review: "Review",
  publish: "Publish",
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAssistantUuid(
  value: string | null | undefined,
): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}
