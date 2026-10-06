import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildMaturityBuilderStoredPayload,
  parseMaturityBuilderEnvelope,
  wrapMaturityBuilderContext,
  type MaturityBuilderContext,
  type MaturityBuilderFocus,
  type MaturityBuilderIntent,
  type MaturityBuilderProposalStatus,
} from "@/modules/maturity/ai-builder";
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
import { AiProviderError } from "@/platform/ai/providers/errors";
import {
  MATURITY_FRAMEWORK_BUILDER_FORMAT_NAME,
  MATURITY_FRAMEWORK_BUILDER_JSON_SCHEMA,
  MATURITY_FRAMEWORK_BUILDER_PROMPT_KEY,
  MATURITY_FRAMEWORK_BUILDER_PROMPT_VERSION,
  buildMaturityFrameworkBuilderSystemPrompt,
  hashMaturityFrameworkBuilderPrompt,
} from "@/platform/ai/prompts/maturity-framework-builder";
import { resolveAIProvider } from "@/platform/ai/registry";

const BUILDER_MAX_OUTPUT_TOKENS = 6000;

export const MATURITY_BUILDER_INVALID_RESPONSE_MESSAGE =
  "LeanAI's reply could not be used, so nothing changed. Try again or rephrase your request.";

export type RunMaturityBuilderTurnInput = {
  supabase: SupabaseClient;
  sessionId: string;
  /** Visible request text stored in the session transcript. */
  userRequest: string;
  intent: MaturityBuilderIntent;
  focus: MaturityBuilderFocus | null;
  idempotencyKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  context: MaturityBuilderContext;
};

export type RunMaturityBuilderTurnResult = {
  runId: string;
  assistantMessageId: string;
  responseStatus: "ok" | "invalid_response";
  proposalStatus: MaturityBuilderProposalStatus;
  issues: string[];
};

/**
 * One builder turn through the shared Coach session/run/usage path. The model
 * only returns a proposal envelope; no tools are offered and no framework
 * records are written here.
 */
export async function runMaturityBuilderTurn(
  input: RunMaturityBuilderTurnInput,
): Promise<RunMaturityBuilderTurnResult> {
  if (!isApplicationAiProviderAvailable()) {
    throw new Error("LeanAI is not available.");
  }

  const logicalModelClass = selectCoachTaskModelClass("framework_builder");
  assertModelClassNotEscalated(logicalModelClass, "standard");

  const env = getAiEnvironment();
  const provider = resolveAIProvider();
  const model = resolveLogicalModelId(logicalModelClass, env);
  const maxOutputTokens = Math.min(
    env.AI_MAX_OUTPUT_TOKENS ?? AI_DEFAULTS.maxOutputTokens,
    BUILDER_MAX_OUTPUT_TOKENS,
  );
  const timeoutMs = env.AI_RUN_TIMEOUT_MS ?? AI_DEFAULTS.runTimeoutMs;
  const systemPrompt = buildMaturityFrameworkBuilderSystemPrompt();
  const promptHash = hashMaturityFrameworkBuilderPrompt(systemPrompt);
  const contextHash = hashJson(input.context);

  // The transcript keeps a compact marker; the bounded context only goes to the provider.
  const storedUserMessage = `[Maturity framework builder · context ${contextHash.slice(0, 12)}]\n\nUser request:\n${input.userRequest}`;
  const providerUserMessage = `${wrapMaturityBuilderContext(input.context)}\n\nUser request:\n${input.userRequest}`;

  const { data: runId, error: startError } = await input.supabase.rpc(
    "start_ai_run",
    {
      target_ai_session_id: input.sessionId,
      target_user_message: storedUserMessage,
      target_idempotency_key: input.idempotencyKey,
      target_provider: provider.name,
      target_model: model,
      target_prompt_key: MATURITY_FRAMEWORK_BUILDER_PROMPT_KEY,
      target_prompt_version: MATURITY_FRAMEWORK_BUILDER_PROMPT_VERSION,
      target_prompt_hash: promptHash,
    },
  );
  if (startError || !runId) {
    throw startError ?? new Error("Failed to start LeanAI run");
  }

  const startedAt = Date.now();
  try {
    const response = await provider.createResponse({
      model,
      systemPrompt,
      messages: [
        ...input.conversationHistory,
        { role: "user", content: providerUserMessage },
      ],
      tools: [],
      maxOutputTokens,
      timeoutMs,
      expectsStructuredOutput: true,
      structuredOutputFormat: {
        name: MATURITY_FRAMEWORK_BUILDER_FORMAT_NAME,
        schema: MATURITY_FRAMEWORK_BUILDER_JSON_SCHEMA as unknown as Record<
          string,
          unknown
        >,
      },
    });

    const toolCallRecords = response.toolCalls.map((toolCall, index) => ({
      sequence_number: index + 1,
      tool_name: toolCall.name,
      arguments_json: toolCall.arguments,
      arguments_hash: hashJson(toolCall.arguments),
      status: "denied",
      denial_reason: "maturity_builder_has_no_tools",
      result_metadata_json: {},
      duration_ms: 0,
    }));

    const parsed =
      toolCallRecords.length > 0
        ? {
            ok: false as const,
            issues: [
              "LeanAI requested a tool, which the builder does not allow.",
            ],
          }
        : parseMaturityBuilderEnvelope(response.parsedJson ?? null);

    const payload = parsed.ok
      ? buildMaturityBuilderStoredPayload({
          responseStatus: "ok",
          phase: parsed.envelope.phase,
          intent: input.intent,
          focus: input.focus,
          understanding: parsed.envelope.understanding,
          questions: parsed.envelope.questions,
          changeSummary: parsed.envelope.changeSummary,
          proposalStatus: parsed.envelope.proposal.status,
          proposal:
            parsed.envelope.proposal.status === "valid"
              ? parsed.envelope.proposal.proposal
              : null,
          proposalIssues:
            parsed.envelope.proposal.status === "invalid"
              ? parsed.envelope.proposal.issues
              : [],
        })
      : buildMaturityBuilderStoredPayload({
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
      : MATURITY_BUILDER_INVALID_RESPONSE_MESSAGE;

    const manifest = {
      context_type: "coach",
      module_key: "maturity",
      intervention_key: "maturity_framework_builder",
      logical_model_class: logicalModelClass,
      context_contract_version: input.context.contract,
      context_hash: contextHash,
      intent: input.intent,
      retry: input.context.request.retry,
      focus_kind: input.focus?.kind ?? null,
      response_status: payload.response_status,
      proposal_status: payload.proposal_status,
      had_current_proposal: input.context.current_proposal !== null,
      denied_tool_count: toolCallRecords.length,
      context_counts: {
        site_names: input.context.organisation.site_names.length,
        other_unit_names: input.context.organisation.other_unit_names.length,
        job_functions: input.context.organisation.job_functions.length,
        existing_framework_names:
          input.context.organisation.existing_framework_names.length,
      },
    };

    const { data: assistantMessageId, error: finishError } =
      await input.supabase.rpc("finish_ai_run", {
        target_ai_run_id: runId,
        target_assistant_content: assistantContent,
        target_structured_payload: payload,
        target_manifest_version: input.context.contract,
        target_manifest_json: manifest,
        target_manifest_hash: hashJson(manifest),
        target_provider_request_id: response.responseId ?? null,
        target_tool_calls: toolCallRecords,
        target_source_references: [],
        target_proposals: [],
        target_input_tokens: response.usage.inputTokens,
        target_output_tokens: response.usage.outputTokens,
        target_cached_input_tokens: response.usage.cachedInputTokens,
        target_reasoning_tokens: response.usage.reasoningTokens,
        target_tool_call_count: toolCallRecords.length,
        target_duration_ms: Date.now() - startedAt,
      });
    if (finishError || !assistantMessageId) {
      throw finishError ?? new Error("Failed to finish LeanAI run");
    }

    return {
      runId: String(runId),
      assistantMessageId: String(assistantMessageId),
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
        error instanceof AiProviderError || error instanceof Error
          ? error.message
          : "LeanAI encountered an error.",
    });
    throw error;
  }
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
