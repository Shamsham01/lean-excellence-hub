import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
  INCOMPLETE_MAX_OUTPUT_USER_MESSAGE,
  STRUCTURED_CONTRACT_USER_MESSAGE,
  logAiProviderDiagnostics,
  type AiProviderDiagnostics,
} from "@/platform/ai/providers/errors";
import {
  normalizeTransportEnvelope,
  type OpenAiFacilitatorEnvelopeTransport,
} from "@/platform/ai/providers/openai-transport";
import type {
  CreateResponseResult,
  FacilitatorEnvelope,
  ProviderToolCallRequest,
} from "@/platform/ai/types";

export type OpenAiResponseSnapshot = {
  id: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  error?: { code?: string; message?: string } | null;
  output_text?: string | null;
  output?: Array<{
    type: string;
    call_id?: string | null;
    id?: string | null;
    name?: string;
    arguments?: string;
  }> | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
  } | null;
};

export type ParseOpenAiResponseContext = {
  provider: string;
  model: string;
  maxOutputTokens: number;
};

function baseDiagnostics(
  response: OpenAiResponseSnapshot,
  context: ParseOpenAiResponseContext,
): AiProviderDiagnostics {
  const diagnostics: AiProviderDiagnostics = {
    provider: context.provider,
    model: context.model,
    responseId: response.id,
    configuredMaxOutputTokens: context.maxOutputTokens,
  };

  if (response.status) {
    diagnostics.responseStatus = response.status;
  }
  if (response.usage?.output_tokens !== undefined) {
    diagnostics.outputTokens = response.usage.output_tokens;
  }
  if (response.usage?.output_tokens_details?.reasoning_tokens !== undefined) {
    diagnostics.reasoningTokens =
      response.usage.output_tokens_details.reasoning_tokens;
  }

  return diagnostics;
}

function withDiagnostics(
  diagnostics: AiProviderDiagnostics,
  extras: Partial<AiProviderDiagnostics>,
): AiProviderDiagnostics {
  return { ...diagnostics, ...extras };
}

function throwProviderError(
  code: (typeof AI_PROVIDER_ERROR_CODES)[keyof typeof AI_PROVIDER_ERROR_CODES],
  message: string,
  diagnostics: AiProviderDiagnostics,
): never {
  logAiProviderDiagnostics(diagnostics);
  throw new AiProviderError(code, message, diagnostics);
}

export function extractToolCalls(
  output: OpenAiResponseSnapshot["output"],
): ProviderToolCallRequest[] {
  const toolCalls: ProviderToolCallRequest[] = [];

  for (const item of output ?? []) {
    if (item.type !== "function_call") continue;

    toolCalls.push({
      id: item.call_id ?? item.id ?? `call-${toolCalls.length}`,
      name: item.name ?? "unknown_tool",
      arguments: JSON.parse(item.arguments || "{}") as Record<string, unknown>,
    });
  }

  return toolCalls;
}

export function parseStructuredOpenAiResponse(
  response: OpenAiResponseSnapshot,
  context: ParseOpenAiResponseContext,
): Pick<
  CreateResponseResult,
  "responseId" | "outputText" | "structuredOutput" | "toolCalls" | "usage"
> {
  const diagnostics = baseDiagnostics(response, context);

  if (response.error) {
    throwProviderError(
      AI_PROVIDER_ERROR_CODES.RESPONSE_API_ERROR,
      response.error.message ??
        "Lean AI encountered a provider error. Please retry.",
      response.error.code
        ? withDiagnostics(diagnostics, { errorCode: response.error.code })
        : diagnostics,
    );
  }

  if (response.status === "incomplete") {
    const incompleteReason = response.incomplete_details?.reason;
    const isMaxOutput =
      incompleteReason === "max_output_tokens" ||
      incompleteReason === "max_tokens";

    throwProviderError(
      isMaxOutput
        ? AI_PROVIDER_ERROR_CODES.RESPONSE_INCOMPLETE_MAX_OUTPUT
        : AI_PROVIDER_ERROR_CODES.RESPONSE_CONTRACT_ERROR,
      isMaxOutput
        ? INCOMPLETE_MAX_OUTPUT_USER_MESSAGE
        : STRUCTURED_CONTRACT_USER_MESSAGE,
      incompleteReason
        ? withDiagnostics(diagnostics, { incompleteReason })
        : diagnostics,
    );
  }

  const toolCalls = extractToolCalls(response.output);
  const usage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
    reasoningTokens:
      response.usage?.output_tokens_details?.reasoning_tokens ?? 0,
  };

  if (toolCalls.length > 0) {
    return {
      responseId: response.id,
      outputText: response.output_text ?? "",
      toolCalls,
      usage,
    };
  }

  const rawOutput = response.output_text?.trim();
  if (!rawOutput) {
    throwProviderError(
      AI_PROVIDER_ERROR_CODES.RESPONSE_CONTRACT_ERROR,
      STRUCTURED_CONTRACT_USER_MESSAGE,
      diagnostics,
    );
  }

  let transport: OpenAiFacilitatorEnvelopeTransport;
  try {
    transport = JSON.parse(rawOutput) as OpenAiFacilitatorEnvelopeTransport;
  } catch {
    throwProviderError(
      AI_PROVIDER_ERROR_CODES.RESPONSE_PARSE_ERROR,
      STRUCTURED_CONTRACT_USER_MESSAGE,
      diagnostics,
    );
  }

  let structuredOutput: FacilitatorEnvelope;
  try {
    structuredOutput = normalizeTransportEnvelope(transport);
  } catch {
    throwProviderError(
      AI_PROVIDER_ERROR_CODES.RESPONSE_NORMALIZATION_ERROR,
      STRUCTURED_CONTRACT_USER_MESSAGE,
      diagnostics,
    );
  }

  const outputText = structuredOutput.message?.trim();
  if (!outputText) {
    throwProviderError(
      AI_PROVIDER_ERROR_CODES.RESPONSE_CONTRACT_ERROR,
      STRUCTURED_CONTRACT_USER_MESSAGE,
      diagnostics,
    );
  }

  return {
    responseId: response.id,
    outputText,
    structuredOutput,
    toolCalls: [],
    usage,
  };
}
