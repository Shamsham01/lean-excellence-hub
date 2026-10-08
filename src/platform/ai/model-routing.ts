import type { AiEnvironment } from "@/platform/ai/config";
import { AI_DEFAULTS } from "@/platform/ai/config";
import type { AiLogicalModelClass } from "@/platform/ai/types";
import { AI_LOGICAL_MODEL_CLASSES } from "@/platform/ai/types";

/**
 * Official OpenAI Responses API identifiers (not ChatGPT product names).
 * Checked against OpenAI model docs on 2026-09-30:
 * - gpt-4.1-nano — $0.10 / $0.40 per 1M tokens
 * - gpt-4.1-mini — $0.40 / $1.60 per 1M tokens (existing LEH default)
 * - gpt-4.1 — same family, higher capability; reserved for deep tasks
 *
 * Operators may remap via AI_MODEL_ECONOMY / AI_MODEL_STANDARD / AI_MODEL_DEEP.
 * Problem Solving continues to use AI_MODEL_DEFAULT and is not silently retargeted.
 */
export const AI_MODEL_CLASS_DEFAULTS: Record<AiLogicalModelClass, string> = {
  economy: "gpt-4.1-nano",
  standard: "gpt-4.1-mini",
  deep: "gpt-4.1",
};

export const AI_MODEL_CLASS_PURPOSES: Record<AiLogicalModelClass, string> = {
  economy: "Short explanations and simple contextual assistance",
  standard: "Normal onboarding, setup conversations and Lean coaching",
  deep: "Complex multi-step reasoning and advanced problem-solving assistance",
};

export const COACH_AI_TASKS = [
  "explain",
  "explain_follow_up",
  "setup_conversation",
  "framework_builder",
  "setup_builder",
  "complex_reasoning",
] as const;

export type CoachAiTask = (typeof COACH_AI_TASKS)[number];

export function isAiLogicalModelClass(
  value: string,
): value is AiLogicalModelClass {
  return (AI_LOGICAL_MODEL_CLASSES as readonly string[]).includes(value);
}

export function resolveLogicalModelId(
  modelClass: AiLogicalModelClass,
  environment: AiEnvironment,
): string {
  switch (modelClass) {
    case "economy":
      return (
        environment.AI_MODEL_ECONOMY?.trim() || AI_MODEL_CLASS_DEFAULTS.economy
      );
    case "standard":
      return (
        environment.AI_MODEL_STANDARD?.trim() ||
        environment.AI_MODEL_DEFAULT?.trim() ||
        AI_MODEL_CLASS_DEFAULTS.standard
      );
    case "deep":
      return environment.AI_MODEL_DEEP?.trim() || AI_MODEL_CLASS_DEFAULTS.deep;
    default: {
      const exhaustive: never = modelClass;
      return exhaustive;
    }
  }
}

export function selectCoachTaskModelClass(
  task: CoachAiTask,
): AiLogicalModelClass {
  switch (task) {
    case "explain":
    case "explain_follow_up":
      return "economy";
    case "setup_conversation":
    case "framework_builder":
    case "setup_builder":
      return "standard";
    case "complex_reasoning":
      return "deep";
    default: {
      const exhaustive: never = task;
      return exhaustive;
    }
  }
}

export function assertModelClassNotEscalated(
  requested: AiLogicalModelClass,
  allowed: AiLogicalModelClass,
): void {
  const rank: Record<AiLogicalModelClass, number> = {
    economy: 0,
    standard: 1,
    deep: 2,
  };
  if (rank[requested] > rank[allowed]) {
    throw new Error(
      `Logical model class '${requested}' is not permitted for this task (max '${allowed}').`,
    );
  }
}

export function problemSolvingModelId(environment: AiEnvironment): string {
  return environment.AI_MODEL_DEFAULT?.trim() || AI_DEFAULTS.model;
}
