export const SEMANTIC_STAGE_KEYS = [
  "DEFINE",
  "CURRENT_CONDITION",
  "TARGET_CONDITION",
  "ROOT_CAUSE_ANALYSIS",
  "COUNTERMEASURES",
  "IMPLEMENTATION",
  "EFFECTIVENESS_CHECK",
  "SUSTAINMENT",
] as const;

export type SemanticStageKey = (typeof SEMANTIC_STAGE_KEYS)[number];

const STAGE_LABELS: Record<SemanticStageKey, string> = {
  DEFINE: "Define",
  CURRENT_CONDITION: "Current condition",
  TARGET_CONDITION: "Target condition",
  ROOT_CAUSE_ANALYSIS: "Root cause analysis",
  COUNTERMEASURES: "Countermeasures",
  IMPLEMENTATION: "Implementation",
  EFFECTIVENESS_CHECK: "Effectiveness check",
  SUSTAINMENT: "Sustainment",
};

export function semanticStageLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return STAGE_LABELS[key as SemanticStageKey] ?? key;
}

export type MethodStage = {
  id: string;
  title: string;
  semantic_stage_key: string;
  description: string | null;
  display_order: number;
};

export function sortMethodStages(stages: MethodStage[]): MethodStage[] {
  return [...stages].sort((a, b) => a.display_order - b.display_order);
}
