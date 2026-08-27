export type AiMessageRole = "user" | "assistant";

export type AiSessionMode = "ask" | "facilitate" | "review" | "challenge";

export type AiRunStatus =
  "running" | "completed" | "failed" | "timed_out" | "denied";

export type AiProposalType =
  | "current_condition_item"
  | "hypothesis"
  | "hypothesis_test"
  | "containment"
  | "countermeasure"
  | "universal_action"
  | "effectiveness_check"
  | "sustainment_item"
  | "session_question"
  | "session_summary"
  | "lessons_learned";

export const FORBIDDEN_PROPOSAL_TYPES = [
  "verify_root_cause",
  "close_case",
  "approve_benefit",
  "validate_saving",
  "assign_rbac",
] as const;

export type SourceRefKey =
  | "problem_solving_case_id"
  | "current_condition_item_id"
  | "containment_id"
  | "hypothesis_id"
  | "hypothesis_test_id"
  | "countermeasure_id"
  | "effectiveness_check_id"
  | "sustainment_item_id"
  | "problem_solving_session_id"
  | "action_id"
  | "lesson_learned_id";

export type TypedSourceRef = Partial<Record<SourceRefKey, string>>;

export type SupportLevel =
  "insufficient_evidence" | "partially_supported" | "well_supported";

export type FacilitatorEnvelope = {
  message: string;
  observations: Array<{ text: string; support_level?: SupportLevel }>;
  questions: string[];
  warnings: string[];
  source_refs: Array<{ label: string; ref: TypedSourceRef }>;
  proposals: Array<{
    proposal_type: AiProposalType;
    payload: Record<string, unknown>;
    explanation: string;
  }>;
};

export type ProviderToolCallRequest = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
};

export type CreateResponseInput = {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tools: Array<Record<string, unknown>>;
  maxOutputTokens: number;
  timeoutMs: number;
  previousResponseId?: string;
};

export type CreateResponseResult = {
  responseId?: string;
  outputText: string;
  structuredOutput?: FacilitatorEnvelope;
  toolCalls: ProviderToolCallRequest[];
  usage: ProviderUsage;
};

export type ProviderHealth = {
  ok: boolean;
  provider: string;
  detail?: string;
};

export interface AIProvider {
  readonly name: string;
  healthCheck(): Promise<ProviderHealth>;
  createResponse(input: CreateResponseInput): Promise<CreateResponseResult>;
}

export type ToolExecutionResult = {
  status: "succeeded" | "denied" | "failed";
  resultMetadata: Record<string, unknown>;
  denialReason?: string;
  sourceRefsAdded: TypedSourceRef[];
};
