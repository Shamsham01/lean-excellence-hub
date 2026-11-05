import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AI_DEFAULTS,
  getAiEnvironment,
  isApplicationAiProviderAvailable,
} from "@/platform/ai/config";
import {
  prepareWorkflowModelCall,
  reasoningManifestFields,
} from "@/platform/ai/model-compatibility";
import { problemSolvingModelId } from "@/platform/ai/model-routing";
import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
  aiRunFailureCategory,
} from "@/platform/ai/providers/errors";
import {
  PROMPT_KEY,
  PROMPT_VERSION,
  buildSystemPrompt,
  hashPrompt,
} from "@/platform/ai/prompts/problem-solving-facilitator";
import {
  reconcileCompletedAiRunTurn,
  readExistingAiRun,
} from "@/platform/ai/ai-run-reconciliation";
import { failAiRunBestEffort } from "@/platform/ai/fail-ai-run-best-effort";
import {
  AI_TURN_IN_PROGRESS_MESSAGE,
  AI_TURN_UNCERTAIN_COMPLETION_MESSAGE,
  AI_STALE_RUN_AFTER_MS,
  AI_TURN_FINALIZE_BUFFER_MS,
  createAiRunDeadline,
  resolveAiTurnWallClockMs,
  runWithinAiTurnBudget,
} from "@/platform/ai/run-deadline";
import { recordAiRunProviderDispatch } from "@/platform/ai/record-ai-run-provider-dispatch";
import { shouldRetryProviderOnce } from "@/platform/ai/provider-turn-retry";
import {
  recoverStaleAiRunsForProblemSolvingCase,
  recoverStaleAiRunsForSession,
} from "@/platform/ai/stale-ai-run-recovery";
import { resolveAIProvider } from "@/platform/ai/registry";
import {
  createSourceAllowlist,
  filterAllowedSourceRefs,
  toDbSourceRef,
} from "@/platform/ai/source-allowlist";
import { sanitizeEnvelopeProposals } from "@/platform/ai/proposals/contracts";
import { executeProblemSolvingTool } from "@/platform/ai/tools/problem-solving-executors";
import { ProblemSolvingProposalBuffer } from "@/platform/ai/tools/proposal-tool-buffer";
import {
  PROBLEM_SOLVING_TOOLS,
  buildOpenAiTools,
  type ProblemSolvingToolName,
} from "@/platform/ai/tools/problem-solving-schemas";
import { reconcileProblemSolvingAiTurnByIdempotencyKey } from "@/platform/ai/problem-solving-turn-reconcile";
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

async function problemSolvingSessionCaseId(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("ai_sessions")
    .select("problem_solving_case_id, context_type")
    .eq("id", sessionId)
    .maybeSingle();
  const caseId = data?.problem_solving_case_id;
  if (
    error ||
    data?.context_type !== "problem_solving" ||
    typeof caseId !== "string" ||
    caseId.length === 0
  ) {
    throw new Error("Lean AI session is not authorised for this case.");
  }
  return caseId;
}

function isProblemSolvingTool(name: string): name is ProblemSolvingToolName {
  return (PROBLEM_SOLVING_TOOLS as readonly string[]).includes(name);
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
  const model = problemSolvingModelId(env);
  const prepared = prepareWorkflowModelCall({
    workflow:
      input.mode === "challenge"
        ? "problem_solving_challenge"
        : "problem_solving",
    model,
    environment: env,
  });
  const maxToolCalls = env.AI_MAX_TOOL_CALLS ?? AI_DEFAULTS.maxToolCalls;
  const configuredPerCallTimeoutMs =
    env.AI_RUN_TIMEOUT_MS ?? AI_DEFAULTS.runTimeoutMs;
  const wallClockMs = resolveAiTurnWallClockMs(
    env.AI_TURN_WALL_CLOCK_MS ?? AI_DEFAULTS.turnWallClockMs,
  );
  const deadline = createAiRunDeadline(wallClockMs);
  const expectsStructuredOutput = provider.name === "openai";

  const systemPrompt = buildSystemPrompt(input.mode, input.stageKey);
  const promptHash = hashPrompt(systemPrompt);
  const sessionCaseId = await problemSolvingSessionCaseId(
    input.supabase,
    input.sessionId,
  );
  if (sessionCaseId !== input.caseId) {
    throw new Error("Lean AI session is not authorised for this case.");
  }

  await recoverStaleAiRunsForProblemSolvingCase(
    input.supabase,
    input.caseId,
    AI_STALE_RUN_AFTER_MS,
  );
  await recoverStaleAiRunsForSession(
    input.supabase,
    input.sessionId,
    AI_STALE_RUN_AFTER_MS,
  );

  const started = await startProblemSolvingRun(input, {
    provider: provider.name,
    model,
    promptHash,
  });
  let runId = started.runId;
  let startError = started.error;
  if (startError && isUniqueRunningRun(startError)) {
    await recoverStaleAiRunsForSession(
      input.supabase,
      input.sessionId,
      AI_STALE_RUN_AFTER_MS,
    );
    const retried = await startProblemSolvingRun(input, {
      provider: provider.name,
      model,
      promptHash,
    });
    runId = retried.runId;
    startError = retried.error;
    if (startError && isUniqueRunningRun(startError)) {
      throw new AiProviderError(
        AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY,
        AI_TURN_IN_PROGRESS_MESSAGE,
        { provider: provider.name, model },
      );
    }
  }

  if (startError || !runId) {
    throw startError ?? new Error("Failed to start AI run");
  }

  const { data: claim, error: claimError } = await input.supabase.rpc(
    "claim_ai_run_execution",
    { target_ai_run_id: runId },
  );
  if (claimError) {
    throw claimError;
  }
  if (claim === "completed") {
    const reconciled = await reconcileCompletedAiRunTurn(input.supabase, runId);
    if (!reconciled) {
      throw new Error(
        "Lean AI finished this request, but the reply could not be reloaded. Send the same message again.",
      );
    }
    return reconciled;
  }
  if (claim === "in_progress") {
    throw new AiProviderError(
      AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY,
      AI_TURN_IN_PROGRESS_MESSAGE,
      { provider: provider.name, model },
    );
  }
  if (claim === "failed" || claim === "timed_out" || claim === "denied") {
    throw new AiProviderError(
      AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY,
      "That Lean AI attempt did not finish. Your message is still here. Send it again to start a fresh request.",
      { provider: provider.name, model },
    );
  }
  if (claim !== "claimed") {
    throw new Error("Lean AI could not start this request.");
  }

  const allowlist = createSourceAllowlist();
  addCaseToAllowlist(allowlist, input.caseId);
  const proposalBuffer = new ProblemSolvingProposalBuffer();

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
      deadline.assertWithinBudget(provider.name, model);
      const response = await invokeProblemSolvingProviderResponse({
        supabase: input.supabase,
        runId,
        deadline,
        provider,
        model,
        configuredPerCallTimeoutMs,
        prepared,
        expectsStructuredOutput,
        systemPrompt,
        messages,
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
        const toolName = toolCall.name;
        if (!isProblemSolvingTool(toolName)) {
          toolCallRecords.push({
            sequence_number: toolCallRecords.length + 1,
            tool_name: toolName,
            arguments_json: toolCall.arguments,
            arguments_hash: hashJson(toolCall.arguments),
            status: "denied",
            denial_reason: "unknown_tool",
            result_metadata_json: {},
            duration_ms: 0,
          });
          continue;
        }

        deadline.assertWithinBudget(provider.name, model);
        const started = Date.now();
        const result = await runWithinAiTurnBudget(
          deadline,
          provider.name,
          model,
          () =>
            executeProblemSolvingTool(
              {
                supabase: input.supabase,
                caseId: input.caseId,
                allowlist,
                proposalBuffer,
              },
              toolName,
              toolCall.arguments,
            ),
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

    const toolProposals = proposalBuffer.drain().map((item) => ({
      proposal_type: item.proposal_type,
      payload: item.payload,
      explanation: item.explanation,
    }));
    envelope.proposals = sanitizeEnvelopeProposals([
      ...envelope.proposals,
      ...toolProposals,
    ]);

    const sourceRefsDb = envelope.source_refs.map((item) =>
      toDbSourceRef(item.ref),
    );
    const proposalsDb = envelope.proposals.map((proposal) => ({
      proposal_type: proposal.proposal_type,
      payload_json: proposal.payload,
      human_explanation: proposal.explanation,
      display_permission_key: displayPermissionFor(proposal.proposal_type),
    }));

    deadline.assertWithinBudget(provider.name, model);

    const manifest = {
      case_id: input.caseId,
      mode: input.mode,
      stage_key: input.stageKey ?? null,
      allowlist_size: allowlist.size,
      wall_clock_ms: wallClockMs,
      elapsed_ms: Date.now() - startedAt,
      tool_iterations: toolCallRecords.length,
      ...reasoningManifestFields(prepared),
    };

    const finishedEnvelope = envelope;
    const finishResult = await runWithinAiTurnBudget(
      deadline,
      provider.name,
      model,
      async () =>
        input.supabase.rpc("finish_ai_run", {
          target_ai_run_id: runId,
          target_assistant_content: finishedEnvelope.message,
          target_structured_payload: finishedEnvelope,
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
        }),
    );
    const { data: assistantMessageId, error: finishError } = finishResult;

    if (finishError || !assistantMessageId) {
      throw finishError ?? new Error("Failed to finish AI run");
    }

    return {
      runId,
      assistantMessageId,
      envelope,
    };
  } catch (error) {
    console.warn(
      "[lean-ai:problem-solving-turn]",
      JSON.stringify({
        ai_run_id: runId,
        ai_session_id: input.sessionId,
        mode: input.mode,
        prompt_version: PROMPT_VERSION,
        model,
        elapsed_ms: Date.now() - startedAt,
        tool_calls: totalToolCalls,
        error_category: aiRunFailureCategory(error),
      }),
    );
    const completed = await reconcileCompletedAiRunTurn(input.supabase, runId);
    if (completed) {
      return completed;
    }
    await failAiRunBestEffort(input.supabase, runId, error);
    const completedAfterCleanup = await reconcileCompletedAiRunTurn(
      input.supabase,
      runId,
    );
    if (completedAfterCleanup) {
      return completedAfterCleanup;
    }
    await recoverStaleAiRunsForSession(
      input.supabase,
      input.sessionId,
      wallClockMs + AI_TURN_FINALIZE_BUFFER_MS + 2_000,
    );
    const completedAfterStale = await reconcileCompletedAiRunTurn(
      input.supabase,
      runId,
    );
    if (completedAfterStale) {
      return completedAfterStale;
    }
    const reconciledByKey = await reconcileProblemSolvingAiTurnByIdempotencyKey(
      input.supabase,
      {
        caseId: input.caseId,
        sessionId: input.sessionId,
        idempotencyKey: input.idempotencyKey,
      },
    );
    if (reconciledByKey.state === "completed") {
      return {
        runId: reconciledByKey.runId,
        assistantMessageId: reconciledByKey.assistantMessageId,
        envelope: reconciledByKey.envelope,
      };
    }
    const snapshot = await readExistingAiRun(input.supabase, runId);
    if (
      !snapshot ||
      snapshot.status === "running" ||
      snapshot.status === "unknown"
    ) {
      throw new AiProviderError(
        AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT,
        AI_TURN_UNCERTAIN_COMPLETION_MESSAGE,
        { provider: provider.name, model },
      );
    }
    if (snapshot.status === "failed" || snapshot.status === "timed_out") {
      if (
        error instanceof AiProviderError &&
        error.code === AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT
      ) {
        throw error;
      }
      throw new AiProviderError(
        AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY,
        reconciledByKey.state === "failed"
          ? reconciledByKey.message
          : "That Lean AI attempt did not finish. Your message is still here. Send it again to start a fresh request.",
        { provider: provider.name, model },
      );
    }
    throw error;
  }
}

async function invokeProblemSolvingProviderResponse(input: {
  supabase: RunAiTurnInput["supabase"];
  runId: string;
  deadline: ReturnType<typeof createAiRunDeadline>;
  provider: ReturnType<typeof resolveAIProvider>;
  model: string;
  configuredPerCallTimeoutMs: number;
  prepared: ReturnType<typeof prepareWorkflowModelCall>;
  expectsStructuredOutput: boolean;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const callProvider = () =>
    input.provider.createResponse({
      model: input.model,
      systemPrompt: input.systemPrompt,
      messages: input.messages,
      tools: buildOpenAiTools(),
      maxOutputTokens: input.prepared.maxOutputTokens,
      timeoutMs: input.deadline.providerTimeoutMs(
        input.configuredPerCallTimeoutMs,
        input.provider.name,
        input.model,
      ),
      maxRetries: 0,
      reasoningEffort: input.prepared.reasoningEffort,
      ...(input.expectsStructuredOutput
        ? { expectsStructuredOutput: true }
        : {}),
    });

  await recordAiRunProviderDispatch(input.supabase, input.runId);

  try {
    return await runWithinAiTurnBudget(
      input.deadline,
      input.provider.name,
      input.model,
      callProvider,
    );
  } catch (error) {
    if (!shouldRetryProviderOnce(error, input.deadline)) {
      throw error;
    }
    input.deadline.assertWithinBudget(input.provider.name, input.model);
    return runWithinAiTurnBudget(
      input.deadline,
      input.provider.name,
      input.model,
      callProvider,
    );
  }
}

function isUniqueRunningRun(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function startProblemSolvingRun(
  input: RunAiTurnInput,
  identity: { provider: string; model: string; promptHash: string },
): Promise<{ runId: string | null; error: unknown }> {
  const { data, error } = await input.supabase.rpc("start_ai_run", {
    target_ai_session_id: input.sessionId,
    target_user_message: input.userMessage,
    target_idempotency_key: input.idempotencyKey,
    target_provider: identity.provider,
    target_model: identity.model,
    target_prompt_key: PROMPT_KEY,
    target_prompt_version: PROMPT_VERSION,
    target_prompt_hash: identity.promptHash,
  });
  return { runId: typeof data === "string" ? data : null, error };
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
