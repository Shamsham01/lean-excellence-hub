import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fallbackCoachEnvelope,
  parseCoachEnvelope,
} from "@/platform/ai/coach-envelope";
import {
  AI_DEFAULTS,
  getAiEnvironment,
  isApplicationAiProviderAvailable,
} from "@/platform/ai/config";
import {
  assertModelClassNotEscalated,
  resolveLogicalModelId,
  selectCoachTaskModelClass,
  type CoachAiTask,
} from "@/platform/ai/model-routing";
import { AiProviderError } from "@/platform/ai/providers/errors";
import {
  COACH_ENVELOPE_JSON_SCHEMA,
  COACH_EXPLAIN_PROMPT_KEY,
  COACH_EXPLAIN_PROMPT_VERSION,
  buildCoachExplainSystemPrompt,
  hashCoachPrompt,
} from "@/platform/ai/prompts/coach-explain";
import {
  COACH_ASSISTANT_PROMPT_KEY,
  COACH_ASSISTANT_PROMPT_VERSION,
  buildCoachAssistantSystemPrompt,
  hashCoachAssistantPrompt,
} from "@/platform/ai/prompts/coach-assistant";
import { resolveAIProvider } from "@/platform/ai/registry";
import type { CoachEnvelope } from "@/platform/ai/types";
import type { CoachExplainContext } from "@/modules/leanai-context/coach/context-assembly";
import { wrapUntrustedCoachData } from "@/modules/leanai-context/coach/context-assembly";
import {
  coachStructuredPayload,
  workspaceAssistantTools,
} from "@/platform/ai/web-search";

const PROBLEM_SOLVING_TOOL_NAMES = new Set([
  "get_problem_solving_case_overview",
  "get_current_condition",
  "get_containments",
  "get_hypotheses",
  "get_hypothesis_tests",
  "get_cause_analysis",
  "get_countermeasures",
  "get_case_actions",
  "get_effectiveness_checks",
  "get_sustainment",
  "get_problem_solving_sessions",
  "get_lessons_learned",
  "search_related_problem_solving_cases",
]);

export type RunCoachAiTurnInput = {
  supabase: SupabaseClient;
  sessionId: string;
  task: CoachAiTask;
  userMessage: string;
  idempotencyKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  context: CoachExplainContext;
  provenanceHash: string;
  webSearchEnabled?: boolean;
};

export type RunCoachAiTurnResult = {
  runId: string;
  assistantMessageId: string;
  envelope: CoachEnvelope;
  model: string;
  logicalModelClass: "economy" | "standard" | "deep";
  externalSources: Array<{ title: string; url: string }>;
};

export async function runCoachAiTurn(
  input: RunCoachAiTurnInput,
): Promise<RunCoachAiTurnResult> {
  if (!isApplicationAiProviderAvailable()) {
    throw new Error("LeanAI is not available.");
  }

  const allowedClass = selectCoachTaskModelClass(input.task);
  const classCeiling =
    input.task === "setup_conversation" ? "standard" : "economy";
  assertModelClassNotEscalated(allowedClass, classCeiling);
  if (
    input.task !== "explain" &&
    input.task !== "explain_follow_up" &&
    input.task !== "setup_conversation"
  ) {
    throw new Error("This Coach task is not enabled in this milestone.");
  }

  const env = getAiEnvironment();
  const provider = resolveAIProvider();
  const logicalModelClass = allowedClass;
  const model = resolveLogicalModelId(logicalModelClass, env);
  const maxOutputTokens = Math.min(
    env.AI_MAX_OUTPUT_TOKENS ?? AI_DEFAULTS.maxOutputTokens,
    1500,
  );
  const timeoutMs = env.AI_RUN_TIMEOUT_MS ?? AI_DEFAULTS.runTimeoutMs;
  const isAssistantTurn = input.task === "setup_conversation";
  const webSearchEnabled =
    isAssistantTurn &&
    input.webSearchEnabled === true &&
    input.context.capabilities.webSearchEnabled === true;
  const tools = isAssistantTurn
    ? workspaceAssistantTools(webSearchEnabled)
    : [];
  const systemPrompt = isAssistantTurn
    ? buildCoachAssistantSystemPrompt({ webSearchEnabled })
    : buildCoachExplainSystemPrompt();
  const promptHash = isAssistantTurn
    ? hashCoachAssistantPrompt(systemPrompt)
    : hashCoachPrompt(systemPrompt);
  const untrusted = wrapUntrustedCoachData(input.context);
  const userMessage = `${untrusted}\n\nUser request:\n${input.userMessage}`;

  const { data: runId, error: startError } = await input.supabase.rpc(
    "start_ai_run",
    {
      target_ai_session_id: input.sessionId,
      target_user_message: userMessage,
      target_idempotency_key: input.idempotencyKey,
      target_provider: provider.name,
      target_model: model,
      target_prompt_key: isAssistantTurn
        ? COACH_ASSISTANT_PROMPT_KEY
        : COACH_EXPLAIN_PROMPT_KEY,
      target_prompt_version: isAssistantTurn
        ? COACH_ASSISTANT_PROMPT_VERSION
        : COACH_EXPLAIN_PROMPT_VERSION,
      target_prompt_hash: promptHash,
    },
  );

  if (startError || !runId) {
    throw startError ?? new Error("Failed to start LeanAI run");
  }

  const startedAt = Date.now();
  const toolCallRecords: Array<Record<string, unknown>> = [];
  let envelope: CoachEnvelope | undefined;
  let providerRequestId: string | undefined;
  const totalUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
  };

  try {
    const response = await provider.createResponse({
      model,
      systemPrompt,
      messages: [
        ...input.conversationHistory,
        { role: "user", content: userMessage },
      ],
      tools,
      maxOutputTokens,
      timeoutMs,
      expectsStructuredOutput: true,
      structuredOutputFormat: {
        name: "coach_envelope",
        schema: COACH_ENVELOPE_JSON_SCHEMA as unknown as Record<
          string,
          unknown
        >,
      },
    });

    providerRequestId = response.responseId;
    totalUsage.inputTokens += response.usage.inputTokens;
    totalUsage.outputTokens += response.usage.outputTokens;
    totalUsage.cachedInputTokens += response.usage.cachedInputTokens;
    totalUsage.reasoningTokens += response.usage.reasoningTokens;

    if (response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        toolCallRecords.push({
          sequence_number: toolCallRecords.length + 1,
          tool_name: toolCall.name,
          arguments_json: toolCall.arguments,
          arguments_hash: hashJson(toolCall.arguments),
          status: "denied",
          denial_reason: PROBLEM_SOLVING_TOOL_NAMES.has(toolCall.name)
            ? "coach_cannot_use_problem_solving_tools"
            : "unknown_tool",
          result_metadata_json: {},
          duration_ms: 0,
        });
      }
      envelope = fallbackCoachEnvelope(
        "I can explain this setup step, but I cannot run organisation tools or make changes.",
      );
    } else {
      try {
        envelope = parseCoachEnvelope(
          response.parsedJson ??
            response.structuredOutput ?? {
              message: response.outputText,
            },
        );
      } catch {
        envelope = fallbackCoachEnvelope(response.outputText);
      }
    }

    const externalSources = webSearchEnabled
      ? (response.externalSources ?? [])
      : [];
    const webSearchUsed = webSearchEnabled && response.webSearch?.used === true;
    if (webSearchUsed) {
      toolCallRecords.push({
        sequence_number: toolCallRecords.length + 1,
        tool_name: "web_search",
        arguments_json: {},
        arguments_hash: hashJson({}),
        status: "succeeded",
        result_metadata_json: {
          used: true,
          invocation_count: response.webSearch?.invocationCount ?? 0,
          source_count: externalSources.length,
        },
        duration_ms: 0,
      });
    }

    const structuredPayload = coachStructuredPayload({
      envelope: envelope as unknown as Record<string, unknown>,
      externalSources,
    });

    const manifest = {
      context_type: "coach",
      logical_model_class: logicalModelClass,
      context_contract_version: input.context.contractVersion,
      product_knowledge_version: input.context.productKnowledgeVersion,
      intervention_key: input.context.intervention.key,
      module_key: input.context.module.key,
      context_hash: input.provenanceHash,
      denied_tool_count: toolCallRecords.filter(
        (record) => record.status === "denied",
      ).length,
      web_search_enabled: webSearchEnabled,
      web_search_used: webSearchUsed,
      web_search_invocation_count: webSearchUsed
        ? (response.webSearch?.invocationCount ?? 0)
        : 0,
      external_source_count: externalSources.length,
    };

    const { data: assistantMessageId, error: finishError } =
      await input.supabase.rpc("finish_ai_run", {
        target_ai_run_id: runId,
        target_assistant_content: envelope.message,
        target_structured_payload: structuredPayload,
        target_manifest_version: input.context.contractVersion,
        target_manifest_json: manifest,
        target_manifest_hash: hashJson(manifest),
        target_provider_request_id: providerRequestId ?? null,
        target_tool_calls: toolCallRecords,
        target_source_references: [],
        target_proposals: [],
        target_input_tokens: totalUsage.inputTokens,
        target_output_tokens: totalUsage.outputTokens,
        target_cached_input_tokens: totalUsage.cachedInputTokens,
        target_reasoning_tokens: totalUsage.reasoningTokens,
        target_tool_call_count: toolCallRecords.length,
        target_duration_ms: Date.now() - startedAt,
      });

    if (finishError || !assistantMessageId) {
      throw finishError ?? new Error("Failed to finish LeanAI run");
    }

    return {
      runId,
      assistantMessageId,
      envelope,
      model,
      logicalModelClass,
      externalSources,
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
        error instanceof AiProviderError
          ? error.message
          : error instanceof Error
            ? error.message
            : "LeanAI encountered an error.",
    });
    throw error;
  }
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
