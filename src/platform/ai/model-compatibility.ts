import type { AiEnvironment } from "@/platform/ai/config";
import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
  logAiProviderDiagnostics,
} from "@/platform/ai/providers/errors";
import {
  AI_REASONING_EFFORTS,
  type AiReasoningEffort,
} from "@/platform/ai/types";

/**
 * Reasoning and output-budget policy for LeanAI workflows.
 *
 * Precedence, from baseline to the value that is sent:
 * 1. Workflow default effort (this file).
 * 2. `AI_MODEL_REASONING`, when set, replaces that default for every workflow.
 *    This is the operator override. It never changes the model id.
 * 3. Known-model compatibility. `gpt-6.1-sol` and `gpt-6-astra` reject
 *    `reasoning.effort=none` (HTTP 400). That effort is rewritten to `low`,
 *    which is the documented substitute. The model id is not changed.
 *    Unknown model ids are sent as configured; a 400 is reported, not retried
 *    on a more expensive model.
 * 4. Output budget is the workflow's visible budget plus a reserve for the
 *    resolved effort, because reasoning tokens count against
 *    `max_output_tokens`. `AI_MAX_OUTPUT_TOKENS`, when set, can only lower
 *    that budget. It cannot raise it and it cannot select another model.
 *
 * Checked against OpenAI reasoning and model docs on 2026-10-26.
 * GPT-6 Luna and GPT-6.1 Terra accept `none`. GPT-6.1 Sol does not.
 * Omitting effort makes Luna and Sol default to `medium`, so explain sends
 * `none` explicitly.
 */
export const AI_WORKFLOWS = [
  "explain",
  "explain_follow_up",
  "setup_conversation",
  "framework_builder",
  "setup_builder",
  "complex_reasoning",
  "problem_solving",
  "problem_solving_challenge",
] as const;

export type AiWorkflow = (typeof AI_WORKFLOWS)[number];

export const WORKFLOW_REASONING_DEFAULTS: Record<
  AiWorkflow,
  AiReasoningEffort
> = {
  explain: "none",
  explain_follow_up: "none",
  setup_conversation: "low",
  setup_builder: "low",
  framework_builder: "medium",
  complex_reasoning: "medium",
  problem_solving: "medium",
  problem_solving_challenge: "high",
};

/**
 * Visible completion budget before reasoning tokens. Explain stays at the
 * historical 1,500 because `none` adds no reasoning reserve.
 */
export const WORKFLOW_VISIBLE_OUTPUT_TOKENS: Record<AiWorkflow, number> = {
  explain: 1_500,
  explain_follow_up: 1_500,
  setup_conversation: 1_500,
  setup_builder: 4_000,
  framework_builder: 6_000,
  complex_reasoning: 6_000,
  problem_solving: 6_000,
  problem_solving_challenge: 6_000,
};

/** Headroom so reasoning tokens do not consume the visible JSON budget. */
export const REASONING_TOKEN_RESERVE: Record<AiReasoningEffort, number> = {
  none: 0,
  low: 1_500,
  medium: 4_000,
  high: 8_000,
  xhigh: 12_000,
  max: 16_000,
};

/** Hard stop so an explicit `max` override cannot request an unbounded completion. */
export const OUTPUT_TOKEN_HARD_CAP = 16_000;

const EFFORTS_WITHOUT_NONE: readonly AiReasoningEffort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

const NONE_UNSUPPORTED_MODEL = /^(?:gpt-6\.1-sol|gpt-6-astra)(?:-|$)/;

const NONE_SUPPORTED_MODEL = /^(?:gpt-6-luna|gpt-6\.1-terra|gpt-6-sol)(?:-|$)/;

export type ReasoningSource = "task_default" | "environment_override";

export type ReasoningDecision = {
  effort: AiReasoningEffort;
  source: ReasoningSource;
  adjustedFrom: AiReasoningEffort | null;
};

export type PreparedModelCall = {
  model: string;
  reasoningEffort: AiReasoningEffort;
  maxOutputTokens: number;
  reasoning: ReasoningDecision;
};

type ReasoningEnvironment = Pick<
  AiEnvironment,
  "AI_MODEL_REASONING" | "AI_MAX_OUTPUT_TOKENS"
>;

export function supportedReasoningEfforts(
  model: string,
): readonly AiReasoningEffort[] | null {
  const id = model.trim();
  if (NONE_UNSUPPORTED_MODEL.test(id)) return EFFORTS_WITHOUT_NONE;
  if (NONE_SUPPORTED_MODEL.test(id)) return AI_REASONING_EFFORTS;
  return null;
}

export function applyReasoningCompatibility(
  model: string,
  effort: AiReasoningEffort,
): { effort: AiReasoningEffort; adjustedFrom: AiReasoningEffort | null } {
  const supported = supportedReasoningEfforts(model);
  if (!supported || supported.includes(effort)) {
    return { effort, adjustedFrom: null };
  }

  if (effort === "none" && supported.includes("low")) {
    return { effort: "low", adjustedFrom: "none" };
  }

  const diagnostics = {
    provider: "openai",
    model: model.trim(),
    errorCode: "unsupported_reasoning_effort",
    reasoningEffort: effort,
  };
  logAiProviderDiagnostics(diagnostics);
  throw new AiProviderError(
    AI_PROVIDER_ERROR_CODES.RESPONSE_UNSUPPORTED_PARAMETER,
    `Reasoning effort "${effort}" is not supported by ${model.trim()}. LeanAI did not switch models.`,
    diagnostics,
  );
}

export function resolveWorkflowReasoning(
  workflow: AiWorkflow,
  model: string,
  environment: ReasoningEnvironment,
): ReasoningDecision {
  const override = environment.AI_MODEL_REASONING;
  const selected = override ?? WORKFLOW_REASONING_DEFAULTS[workflow];
  const compatible = applyReasoningCompatibility(model, selected);
  return {
    effort: compatible.effort,
    source: override ? "environment_override" : "task_default",
    adjustedFrom: compatible.adjustedFrom,
  };
}

export function workflowOutputTokenBudget(
  workflow: AiWorkflow,
  effort: AiReasoningEffort,
): number {
  return Math.min(
    WORKFLOW_VISIBLE_OUTPUT_TOKENS[workflow] + REASONING_TOKEN_RESERVE[effort],
    OUTPUT_TOKEN_HARD_CAP,
  );
}

export function resolveWorkflowOutputTokens(
  workflow: AiWorkflow,
  effort: AiReasoningEffort,
  environmentCeiling: number | undefined,
): number {
  const budget = workflowOutputTokenBudget(workflow, effort);
  if (environmentCeiling === undefined) return budget;
  return Math.min(environmentCeiling, budget);
}

export function prepareWorkflowModelCall(input: {
  workflow: AiWorkflow;
  model: string;
  environment: ReasoningEnvironment;
}): PreparedModelCall {
  const model = input.model.trim();
  const reasoning = resolveWorkflowReasoning(
    input.workflow,
    model,
    input.environment,
  );
  return {
    model,
    reasoningEffort: reasoning.effort,
    maxOutputTokens: resolveWorkflowOutputTokens(
      input.workflow,
      reasoning.effort,
      input.environment.AI_MAX_OUTPUT_TOKENS,
    ),
    reasoning,
  };
}

export function reasoningManifestFields(prepared: PreparedModelCall): {
  reasoning_effort: AiReasoningEffort;
  reasoning_effort_source: ReasoningSource;
  reasoning_adjusted_from: AiReasoningEffort | null;
} {
  return {
    reasoning_effort: prepared.reasoning.effort,
    reasoning_effort_source: prepared.reasoning.source,
    reasoning_adjusted_from: prepared.reasoning.adjustedFrom,
  };
}
