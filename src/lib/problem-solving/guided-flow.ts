import { buildStageAutoDraftPrompt } from "@/lib/problem-solving/stage-draft";
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
    autoDraftPrompt: "",
  },
  CURRENT_CONDITION: {
    title: "Current condition",
    purpose:
      "Separate observations and measured facts from assumptions about what is happening now.",
    actions: [
      "Add observations and measured facts with evidence.",
      "Challenge assumptions before cause analysis.",
    ],
    autoDraftPrompt: "",
  },
  TARGET_CONDITION: {
    title: "Target condition",
    purpose:
      "Describe the desired observable state after improvement—not the solution.",
    actions: [
      "State what good looks like in operation.",
      "Keep it testable later.",
    ],
    autoDraftPrompt: "",
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
    autoDraftPrompt: "",
  },
  COUNTERMEASURES: {
    title: "Countermeasures",
    purpose: "Design changes linked to verified or well-supported causes.",
    actions: [
      "Tie countermeasures to tested hypotheses.",
      "Note safety and unintended effects.",
    ],
    autoDraftPrompt: "",
  },
  IMPLEMENTATION: {
    title: "Implementation",
    purpose: "Track doing the work separately from proving it worked.",
    actions: ["Create actions with clear owners and due dates."],
    autoDraftPrompt: "",
  },
  EFFECTIVENESS_CHECK: {
    title: "Effectiveness check",
    purpose: "Compare results to criteria after changes are in place.",
    actions: ["Define criteria, baseline, and target before claiming success."],
    autoDraftPrompt: "",
  },
  SUSTAINMENT: {
    title: "Sustainment",
    purpose:
      "Standardise checks so the gain holds after the project team moves on.",
    actions: ["Add sustainment checks and lessons learned."],
    autoDraftPrompt: "",
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
    autoDraftPrompt: "",
  };
  const autoDraftPrompt = buildStageAutoDraftPrompt(key);
  return { semanticKey: key, ...base, autoDraftPrompt };
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
