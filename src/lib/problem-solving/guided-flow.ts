import type { MethodStage } from "@/lib/problem-solving/stages";
import { semanticStageLabel } from "@/lib/problem-solving/stages";

export type GuidedStageKey = string;

export type GuidedStageConfig = {
  semanticKey: GuidedStageKey;
  title: string;
  purpose: string;
  actions: string[];
  autoDraftPrompt: string;
};

const STAGE_CONFIG: Record<string, Omit<GuidedStageConfig, "semanticKey">> = {
  DEFINE: {
    title: "Define the problem",
    purpose:
      "Agree on a measurable problem statement and boundaries before jumping to causes or fixes.",
    actions: [
      "Confirm the problem statement is observable and specific.",
      "Capture scope, impact, and target condition.",
    ],
    autoDraftPrompt:
      "Review the case definition. Propose an improved problem statement and any missing current-condition facts as draft proposals I can accept.",
  },
  CURRENT_CONDITION: {
    title: "Current condition",
    purpose:
      "Separate observations and measured facts from assumptions about what is happening now.",
    actions: [
      "Add observations and measured facts with evidence.",
      "Challenge assumptions before cause analysis.",
    ],
    autoDraftPrompt:
      "From the authorised case data, propose current-condition items (observations and measured facts only) as draft proposals.",
  },
  TARGET_CONDITION: {
    title: "Target condition",
    purpose:
      "Describe the desired observable state after improvement—not the solution.",
    actions: [
      "State what good looks like in operation.",
      "Keep it testable later.",
    ],
    autoDraftPrompt:
      "Suggest concise target-condition wording and any supporting current-condition facts as draft proposals.",
  },
  ROOT_CAUSE_ANALYSIS: {
    title: "Cause analysis",
    purpose:
      "Explore causes with 5 Whys and fishbone, form testable hypotheses, and verify with evidence—not opinions.",
    actions: [
      "Build or extend a 5 Why chain with evidence at each step.",
      "Place fishbone causes on the 6M diagram and promote strong causes to hypotheses.",
      "Plan a test before calling anything a root cause.",
    ],
    autoDraftPrompt:
      "Using read tools first, draft a 5 Why chain and fishbone causes relevant to this case as propose_* draft proposals. Do not verify root cause.",
  },
  COUNTERMEASURES: {
    title: "Countermeasures",
    purpose: "Design changes linked to verified or well-supported causes.",
    actions: [
      "Tie countermeasures to tested hypotheses.",
      "Note safety and unintended effects.",
    ],
    autoDraftPrompt:
      "Propose countermeasures linked to the leading hypotheses as draft proposals.",
  },
  IMPLEMENTATION: {
    title: "Implementation",
    purpose: "Track doing the work separately from proving it worked.",
    actions: ["Create actions with clear owners and due dates."],
    autoDraftPrompt:
      "Propose implementation actions (universal_action) for the selected countermeasures as draft proposals.",
  },
  EFFECTIVENESS_CHECK: {
    title: "Effectiveness check",
    purpose: "Compare results to criteria after changes are in place.",
    actions: ["Define criteria, baseline, and target before claiming success."],
    autoDraftPrompt:
      "Propose effectiveness check criteria for this case as draft proposals.",
  },
  SUSTAINMENT: {
    title: "Sustainment",
    purpose:
      "Standardise checks so the gain holds after the project team moves on.",
    actions: ["Add sustainment checks and lessons learned."],
    autoDraftPrompt:
      "Propose sustainment items and lessons learned drafts for this case.",
  },
};

const STAGE_CONFIG_ALIASES: Record<string, keyof typeof STAGE_CONFIG> = {
  ANALYSE: "ROOT_CAUSE_ANALYSIS",
};

export function guidedStageConfig(
  semanticKey: string | null | undefined,
  methodStage?: MethodStage | null,
): GuidedStageConfig {
  const rawKey = semanticKey ?? "DEFINE";
  const key = STAGE_CONFIG_ALIASES[rawKey] ?? rawKey;
  const base = STAGE_CONFIG[key] ?? {
    title: methodStage?.title ?? semanticStageLabel(key),
    purpose:
      methodStage?.description ??
      "Work this stage with the team; accept Lean AI drafts before saving records.",
    actions: ["Use Lean AI drafts, then accept or edit each proposal."],
    autoDraftPrompt:
      "Facilitate this investigation stage and propose the next useful draft records.",
  };
  return { semanticKey: key, ...base };
}

export function resolveViewStage(
  methodStages: MethodStage[],
  viewStageId: string | null,
  currentMethodStageId: string | null,
): MethodStage | null {
  if (methodStages.length === 0) return null;
  const byId = viewStageId
    ? methodStages.find((stage) => stage.id === viewStageId)
    : null;
  if (byId) return byId;
  const current = currentMethodStageId
    ? methodStages.find((stage) => stage.id === currentMethodStageId)
    : null;
  return current ?? methodStages[0] ?? null;
}
