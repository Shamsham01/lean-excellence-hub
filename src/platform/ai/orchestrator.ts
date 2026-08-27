import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AI_DEFAULTS,
  getAiEnvironment,
  isApplicationAiProviderAvailable,
} from "@/platform/ai/config";
import { AiProviderError } from "@/platform/ai/providers/errors";
import {
  PROMPT_KEY,
  PROMPT_VERSION,
  buildSystemPrompt,
  hashPrompt,
} from "@/platform/ai/prompts/problem-solving-facilitator";
import { resolveAIProvider } from "@/platform/ai/registry";
import {
  createSourceAllowlist,
  filterAllowedSourceRefs,
  toDbSourceRef,
} from "@/platform/ai/source-allowlist";
import { sanitizeEnvelopeProposals } from "@/platform/ai/proposals/contracts";
import { executeProblemSolvingTool } from "@/platform/ai/tools/problem-solving-executors";
import {
  PROBLEM_SOLVING_READ_TOOLS,
  buildOpenAiTools,
  type ProblemSolvingToolName,
} from "@/platform/ai/tools/problem-solving-schemas";
import type {
  AiSessionMode,
  FacilitatorEnvelope,
  TypedSourceRef,
} from "@/platform/ai/types";

export type RunAiTurnInput = {
  supabase: SupabaseClient;
  sessionId: string;
  caseId: string;
  mode: AiSessionMode;
  stageKey?: string | null;
  userMessage: string;
  idempotencyKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
};

export type RunAiTurnResult = {
  runId: string;
  assistantMessageId: string;
  envelope: FacilitatorEnvelope;
};

function isProblemSolvingTool(name: string): name is ProblemSolvingToolName {
  return (PROBLEM_SOLVING_READ_TOOLS as readonly string[]).includes(name);
}

export async function runAiTurn(
  input: RunAiTurnInput,
): Promise<RunAiTurnResult> {
  if (!isApplicationAiProviderAvailable()) {
    throw new Error(
      "Lean AI is not available. Check organisation settings and provider configuration.",
    );
  }

  const env = getAiEnvironment();
  const provider = resolveAIProvider();
  const model = env.AI_MODEL_DEFAULT ?? AI_DEFAULTS.model;
  const maxOutputTokens =
    env.AI_MAX_OUTPUT_TOKENS ?? AI_DEFAULTS.maxOutputTokens;
  const maxToolCalls = env.AI_MAX_TOOL_CALLS ?? AI_DEFAULTS.maxToolCalls;
  const timeoutMs = env.AI_RUN_TIMEOUT_MS ?? AI_DEFAULTS.runTimeoutMs;
  const reasoningEffort = env.AI_MODEL_REASONING;
  const expectsStructuredOutput = provider.name === "openai";

  const systemPrompt = buildSystemPrompt(input.mode, input.stageKey);
  const promptHash = hashPrompt(systemPrompt);

  const { data: runId, error: startError } = await input.supabase.rpc(
    "start_ai_run",
    {
      target_ai_session_id: input.sessionId,
      target_user_message: input.userMessage,
      target_idempotency_key: input.idempotencyKey,
      target_provider: provider.name,
      target_model: model,
      target_prompt_key: PROMPT_KEY,
      target_prompt_version: PROMPT_VERSION,
      target_prompt_hash: promptHash,
    },
  );

  if (startError || !runId) {
    throw startError ?? new Error("Failed to start AI run");
  }

  const allowlist = createSourceAllowlist();
  addCaseToAllowlist(allowlist, input.caseId);

  const messages = [
    ...input.conversationHistory,
    { role: "user" as const, content: input.userMessage },
  ];

  const toolCallRecords: Array<Record<string, unknown>> = [];
  let totalToolCalls = 0;
  const totalUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
  };
  let providerRequestId: string | undefined;
  let envelope: FacilitatorEnvelope | undefined;
  let outputText = "";
  const startedAt = Date.now();

  try {
    for (let iteration = 0; iteration <= maxToolCalls; iteration += 1) {
      const response = await provider.createResponse({
        model,
        systemPrompt,
        messages,
        tools: buildOpenAiTools(),
        maxOutputTokens,
        timeoutMs,
        ...(reasoningEffort ? { reasoningEffort } : {}),
        ...(expectsStructuredOutput ? { expectsStructuredOutput: true } : {}),
      });

      providerRequestId = response.responseId ?? providerRequestId;
      totalUsage.inputTokens += response.usage.inputTokens;
      totalUsage.outputTokens += response.usage.outputTokens;
      totalUsage.cachedInputTokens += response.usage.cachedInputTokens;
      totalUsage.reasoningTokens += response.usage.reasoningTokens;

      if (response.toolCalls.length === 0) {
        if (expectsStructuredOutput) {
          if (!response.structuredOutput) {
            throw new Error(
              "Lean AI received an invalid structured response from the provider. Please retry or contact an administrator.",
            );
          }
          envelope = response.structuredOutput;
        } else {
          envelope =
            response.structuredOutput ?? fallbackEnvelope(response.outputText);
        }
        break;
      }

      const toolResults: string[] = [];
      for (const toolCall of response.toolCalls) {
        if (totalToolCalls >= maxToolCalls) break;
        if (!isProblemSolvingTool(toolCall.name)) {
          toolCallRecords.push({
            sequence_number: toolCallRecords.length + 1,
            tool_name: toolCall.name,
            arguments_json: toolCall.arguments,
            arguments_hash: hashJson(toolCall.arguments),
            status: "denied",
            denial_reason: "unknown_tool",
            result_metadata_json: {},
            duration_ms: 0,
          });
          continue;
        }

        const started = Date.now();
        const result = await executeProblemSolvingTool(
          {
            supabase: input.supabase,
            caseId: input.caseId,
            allowlist,
          },
          toolCall.name,
          toolCall.arguments,
        );
        for (const ref of result.sourceRefsAdded) {
          addRefToAllowlist(allowlist, ref);
        }

        toolCallRecords.push({
          sequence_number: toolCallRecords.length + 1,
          tool_name: toolCall.name,
          arguments_json: toolCall.arguments,
          arguments_hash: hashJson(toolCall.arguments),
          status: result.status,
          denial_reason: result.denialReason,
          result_metadata_json: result.resultMetadata,
          duration_ms: Date.now() - started,
        });

        toolResults.push(
          JSON.stringify({
            tool: toolCall.name,
            status: result.status,
            result: result.resultMetadata,
          }),
        );
        totalToolCalls += 1;
      }

      messages.push({
        role: "user",
        content: `Authorised tool results:\n${toolResults.join("\n")}`,
      });

      if (totalToolCalls >= maxToolCalls) {
        outputText =
          "I reached the tool limit for this turn. Please ask a narrower follow-up.";
        envelope = fallbackEnvelope(outputText);
        break;
      }
    }

    if (!envelope) {
      outputText = "Lean AI could not complete this turn.";
      envelope = fallbackEnvelope(outputText);
    }

    envelope.source_refs = filterAllowedSourceRefs(
      allowlist,
      envelope.source_refs,
    );

    envelope.proposals = sanitizeEnvelopeProposals(envelope.proposals);

    const sourceRefsDb = envelope.source_refs.map((item) =>
      toDbSourceRef(item.ref),
    );
    const proposalsDb = envelope.proposals.map((proposal) => ({
      proposal_type: proposal.proposal_type,
      payload_json: proposal.payload,
      human_explanation: proposal.explanation,
      display_permission_key: displayPermissionFor(proposal.proposal_type),
    }));

    const manifest = {
      case_id: input.caseId,
      mode: input.mode,
      stage_key: input.stageKey ?? null,
      allowlist_size: allowlist.size,
    };

    const { data: assistantMessageId, error: finishError } =
      await input.supabase.rpc("finish_ai_run", {
        target_ai_run_id: runId,
        target_assistant_content: envelope.message,
        target_structured_payload: envelope,
        target_manifest_version: "v1",
        target_manifest_json: manifest,
        target_manifest_hash: hashJson(manifest),
        target_provider_request_id: providerRequestId ?? null,
        target_tool_calls: toolCallRecords,
        target_source_references: sourceRefsDb,
        target_proposals: proposalsDb,
        target_input_tokens: totalUsage.inputTokens,
        target_output_tokens: totalUsage.outputTokens,
        target_cached_input_tokens: totalUsage.cachedInputTokens,
        target_reasoning_tokens: totalUsage.reasoningTokens,
        target_tool_call_count: totalToolCalls,
        target_duration_ms: Date.now() - startedAt,
      });

    if (finishError || !assistantMessageId) {
      throw finishError ?? new Error("Failed to finish AI run");
    }

    return {
      runId,
      assistantMessageId,
      envelope,
    };
  } catch (error) {
    await input.supabase.rpc("fail_ai_run", {
      target_ai_run_id: runId,
      target_error_category:
        error instanceof Error && error.message.includes("timeout")
          ? "timeout"
          : "provider_error",
      target_final_output:
        error instanceof AiProviderError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Lean AI encountered an error.",
    });
    throw error;
  }
}

function fallbackEnvelope(message: string): FacilitatorEnvelope {
  return {
    message,
    observations: [],
    questions: [],
    warnings: [],
    source_refs: [],
    proposals: [],
  };
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function addCaseToAllowlist(allowlist: Set<string>, caseId: string) {
  allowlist.add(`problem_solving_case_id:${caseId}`);
}

function addRefToAllowlist(allowlist: Set<string>, ref: TypedSourceRef) {
  for (const [key, value] of Object.entries(ref)) {
    if (value) allowlist.add(`${key}:${value}`);
  }
}

function displayPermissionFor(proposalType: string): string {
  switch (proposalType) {
    case "current_condition_item":
    case "session_question":
    case "session_summary":
      return "problem_solving.contribute";
    default:
      return "problem_solving.manage";
  }
}
