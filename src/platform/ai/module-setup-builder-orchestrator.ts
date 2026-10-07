import "server-only";

import { createHash } from "node:crypto";

import { buildModuleSetupStoredPayload } from "@/modules/module-setup/ai-builder/conversation";
import type { ModuleSetupBuilderContext } from "@/modules/module-setup/ai-builder/context";
import { wrapModuleSetupBuilderContext } from "@/modules/module-setup/ai-builder/context";
import type {
  ModuleSetupBuilderFocus,
  ModuleSetupBuilderIntent,
} from "@/modules/module-setup/ai-builder/types";
import {
  AI_DEFAULTS,
  getAiEnvironment,
  isApplicationAiProviderAvailable,
} from "@/platform/ai/config";
import {
  assertModelClassNotEscalated,
  resolveLogicalModelId,
  selectCoachTaskModelClass,
} from "@/platform/ai/model-routing";
import { resolveAIProvider } from "@/platform/ai/registry";
import type { Json } from "@/platform/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUILDER_MAX_OUTPUT_TOKENS = 4000;

export const MODULE_SETUP_BUILDER_INVALID_RESPONSE_MESSAGE =
  "LeanAI's reply could not be used, so nothing changed. Try again or rephrase your request.";

type ParsedEnvelope = {
  message: string;
  phase: "discovery" | "proposal";
  understanding: Record<string, string | null>;
  questions: Array<{ question: string; suggestedAnswers: string[] }>;
  changeSummary: string[];
  proposal: unknown;
  proposalStatus: "none" | "valid" | "invalid";
  proposalIssues: string[];
};

export type ModuleSetupBuilderAdapter = {
  moduleKey: "five_s" | "gemba";
  interventionKey: "setup_builder";
  payloadKind: string;
  contextContract: string;
  promptKey: string;
  promptVersion: string;
  formatName: string;
  jsonSchema: Record<string, unknown>;
  systemPrompt: string;
  promptHash: string;
  contextStart: string;
  contextEnd: string;
  denialReason: string;
  parseEnvelope: (
    value: unknown,
  ) => { ok: true; envelope: ParsedEnvelope } | { ok: false; issues: string[] };
};

export type RunModuleSetupBuilderTurnInput = {
  supabase: SupabaseClient;
  adapter: ModuleSetupBuilderAdapter;
  sessionId: string;
  userRequest: string;
  intent: ModuleSetupBuilderIntent;
  focus: ModuleSetupBuilderFocus | null;
  idempotencyKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  context: ModuleSetupBuilderContext;
};

export async function runModuleSetupBuilderTurn(
  input: RunModuleSetupBuilderTurnInput,
): Promise<{
  responseStatus: "ok" | "invalid_response";
  proposalStatus: "none" | "valid" | "invalid";
  issues: string[];
}> {
  if (!isApplicationAiProviderAvailable()) {
    throw new Error("LeanAI is not available.");
  }

  const logicalModelClass = selectCoachTaskModelClass("setup_builder");
  assertModelClassNotEscalated(logicalModelClass, "standard");
  const env = getAiEnvironment();
  const provider = resolveAIProvider();
  const model = resolveLogicalModelId(logicalModelClass, env);
  const maxOutputTokens = Math.min(
    env.AI_MAX_OUTPUT_TOKENS ?? AI_DEFAULTS.maxOutputTokens,
    BUILDER_MAX_OUTPUT_TOKENS,
  );
  const timeoutMs = env.AI_RUN_TIMEOUT_MS ?? AI_DEFAULTS.runTimeoutMs;
  const contextHash = hashJson(input.context);
  const storedUserMessage = `[${input.adapter.moduleKey} setup builder · context ${contextHash.slice(0, 12)}]\n\nUser request:\n${input.userRequest}`;
  const providerUserMessage = `${wrapModuleSetupBuilderContext(input.adapter.contextStart, input.adapter.contextEnd, input.context)}\n\nUser request:\n${input.userRequest}`;

  const { data: runId, error: startError } = await input.supabase.rpc(
    "start_ai_run",
    {
      target_ai_session_id: input.sessionId,
      target_user_message: storedUserMessage,
      target_idempotency_key: input.idempotencyKey,
      target_provider: provider.name,
      target_model: model,
      target_prompt_key: input.adapter.promptKey,
      target_prompt_version: input.adapter.promptVersion,
      target_prompt_hash: input.adapter.promptHash,
    },
  );
  if (startError || !runId) {
    throw startError ?? new Error("Failed to start LeanAI run");
  }

  const startedAt = Date.now();
  try {
    const response = await provider.createResponse({
      model,
      systemPrompt: input.adapter.systemPrompt,
      messages: [
        ...input.conversationHistory,
        { role: "user", content: providerUserMessage },
      ],
      tools: [],
      maxOutputTokens,
      timeoutMs,
      expectsStructuredOutput: true,
      structuredOutputFormat: {
        name: input.adapter.formatName,
        schema: input.adapter.jsonSchema,
      },
    });

    const toolCallRecords = response.toolCalls.map((toolCall, index) => ({
      sequence_number: index + 1,
      tool_name: toolCall.name,
      arguments_json: toolCall.arguments,
      arguments_hash: hashJson(toolCall.arguments),
      status: "denied",
      denial_reason: input.adapter.denialReason,
      result_metadata_json: {},
      duration_ms: 0,
    }));

    const parsed =
      toolCallRecords.length > 0
        ? {
            ok: false as const,
            issues: ["LeanAI requested a tool, which setup does not allow."],
          }
        : input.adapter.parseEnvelope(response.parsedJson ?? null);

    const payload = parsed.ok
      ? buildModuleSetupStoredPayload({
          kind: input.adapter.payloadKind,
          responseStatus: "ok",
          phase: parsed.envelope.phase,
          intent: input.intent,
          focus: input.focus,
          understanding: parsed.envelope.understanding,
          questions: parsed.envelope.questions,
          changeSummary: parsed.envelope.changeSummary,
          proposalStatus: parsed.envelope.proposalStatus,
          proposal: parsed.envelope.proposal,
          proposalIssues: parsed.envelope.proposalIssues,
        })
      : buildModuleSetupStoredPayload({
          kind: input.adapter.payloadKind,
          responseStatus: "invalid_response",
          phase: input.context.current_proposal ? "proposal" : "discovery",
          intent: input.intent,
          focus: input.focus,
          understanding: null,
          questions: [],
          changeSummary: [],
          proposalStatus: "none",
          proposal: null,
          proposalIssues: parsed.issues.slice(0, 5),
        });

    const assistantContent = parsed.ok
      ? parsed.envelope.message
      : MODULE_SETUP_BUILDER_INVALID_RESPONSE_MESSAGE;

    const manifest = {
      context_type: "coach",
      module_key: input.adapter.moduleKey,
      intervention_key: input.adapter.interventionKey,
      logical_model_class: logicalModelClass,
      context_contract_version: input.context.contract,
      context_hash: contextHash,
      intent: input.intent,
      retry: input.context.request.retry,
      focus_kind: input.focus?.kind ?? null,
      response_status: payload.response_status,
      proposal_status: payload.proposal_status,
      denied_tool_count: toolCallRecords.length,
    };

    const { error: finishError } = await input.supabase.rpc("finish_ai_run", {
      target_ai_run_id: runId,
      target_assistant_content: assistantContent,
      target_structured_payload: payload as Json,
      target_manifest_version: input.context.contract,
      target_manifest_json: manifest as Json,
      target_manifest_hash: hashJson(manifest),
      target_provider_request_id: response.responseId ?? null,
      target_tool_calls: toolCallRecords as Json,
      target_source_references: [],
      target_proposals: [],
      target_input_tokens: response.usage.inputTokens,
      target_output_tokens: response.usage.outputTokens,
      target_cached_input_tokens: response.usage.cachedInputTokens,
      target_reasoning_tokens: response.usage.reasoningTokens,
      target_tool_call_count: toolCallRecords.length,
      target_duration_ms: Date.now() - startedAt,
    });
    if (finishError) {
      throw finishError;
    }

    return {
      responseStatus: payload.response_status,
      proposalStatus: payload.proposal_status,
      issues: payload.proposal_issues,
    };
  } catch (error) {
    await input.supabase.rpc("fail_ai_run", {
      target_ai_run_id: runId,
      target_error_category:
        error instanceof Error &&
        error.message.toLowerCase().includes("timeout")
          ? "timeout"
          : "provider_error",
      target_final_output:
        error instanceof Error ? error.message.slice(0, 500) : "provider_error",
    });
    throw error;
  }
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
