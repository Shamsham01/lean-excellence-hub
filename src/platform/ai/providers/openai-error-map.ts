import OpenAI from "openai";

import { applyReasoningCompatibility } from "@/platform/ai/model-compatibility";
import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
  logAiProviderDiagnostics,
  redactProviderText,
  type AiProviderDiagnostics,
  type AiProviderErrorCode,
} from "@/platform/ai/providers/errors";
import type { CreateResponseInput } from "@/platform/ai/types";

const RETIRED_MODEL = /^(?:ft-)?gpt-4\.1-nano(?:-|$)/;

const SAFE_ERROR_PARAMS = new Set([
  "model",
  "reasoning.effort",
  "reasoning_effort",
  "text.format",
  "max_output_tokens",
]);

export function isRetiredOpenAiModel(model: string): boolean {
  return RETIRED_MODEL.test(model.trim());
}

export function modelUnavailableUserMessage(model: string): string {
  return `LeanAI is configured with ${model}, which the provider has retired or does not offer. Update the server model settings to a supported model such as gpt-6-luna, gpt-6.1-terra, or gpt-6.1-sol, then redeploy. LeanAI did not switch to another model.`;
}

function diagnosticsFor(
  model: string,
  extras: Partial<AiProviderDiagnostics> = {},
): AiProviderDiagnostics {
  return { provider: "openai", model, ...extras };
}

function throwMapped(
  code: AiProviderErrorCode,
  message: string,
  diagnostics: AiProviderDiagnostics,
): never {
  logAiProviderDiagnostics(diagnostics);
  throw new AiProviderError(code, message, diagnostics);
}

export function guardOpenAiResponsesRequest(
  input: CreateResponseInput,
): CreateResponseInput {
  const model = input.model.trim();
  if (isRetiredOpenAiModel(model)) {
    throwMapped(
      AI_PROVIDER_ERROR_CODES.RESPONSE_MODEL_UNAVAILABLE,
      modelUnavailableUserMessage(model),
      diagnosticsFor(model, { errorCode: "model_not_found" }),
    );
  }

  if (!input.reasoningEffort) {
    return { ...input, model };
  }

  const compatible = applyReasoningCompatibility(model, input.reasoningEffort);
  return {
    ...input,
    model,
    reasoningEffort: compatible.effort,
  };
}

function providerErrorBody(error: InstanceType<typeof OpenAI.APIError>): {
  code?: string;
  param?: string;
  message?: string;
} {
  const body = error.error;
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  const result: { code?: string; param?: string; message?: string } = {};
  if (typeof record.code === "string") result.code = record.code;
  if (typeof record.param === "string") result.param = record.param;
  if (typeof record.message === "string") result.message = record.message;
  return result;
}

function safeParam(param: string | null | undefined): string | undefined {
  if (!param || !SAFE_ERROR_PARAMS.has(param)) return undefined;
  return param;
}

export function mapOpenAiSdkError(
  error: unknown,
  context: {
    model: string;
    reasoningEffort?: string;
    maxOutputTokens?: number;
  },
): AiProviderError {
  if (error instanceof AiProviderError) return error;

  const model = context.model;
  const base: AiProviderDiagnostics = diagnosticsFor(model, {
    ...(context.reasoningEffort
      ? { reasoningEffort: context.reasoningEffort }
      : {}),
    ...(context.maxOutputTokens !== undefined
      ? { configuredMaxOutputTokens: context.maxOutputTokens }
      : {}),
  });

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return mapped(
      AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT,
      "LeanAI timed out before the provider finished. Please retry with a narrower request.",
      base,
    );
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return mapped(
      AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY,
      "LeanAI's provider is temporarily unavailable. Please retry.",
      base,
    );
  }

  if (error instanceof OpenAI.APIError) {
    const body = providerErrorBody(error);
    const param = safeParam(error.param ?? body.param);
    const providerMessage = redactProviderText(
      body.message ?? error.message ?? "",
    );
    const diagnosed: AiProviderDiagnostics = {
      ...base,
      ...(error.status !== undefined ? { httpStatus: error.status } : {}),
      ...(error.requestID ? { requestId: error.requestID } : {}),
      ...((error.code ?? body.code)
        ? { errorCode: error.code ?? body.code }
        : {}),
      ...(param ? { providerErrorParam: param } : {}),
      ...(providerMessage ? { providerMessage } : {}),
    };
    const text = `${body.message ?? ""} ${error.message ?? ""}`.toLowerCase();
    const paramText = (error.param ?? body.param ?? "").toLowerCase();

    if (error.status === 404) {
      return mapped(
        AI_PROVIDER_ERROR_CODES.RESPONSE_MODEL_UNAVAILABLE,
        modelUnavailableUserMessage(model),
        diagnosed,
      );
    }

    if (error.status === 403) {
      return mapped(
        AI_PROVIDER_ERROR_CODES.RESPONSE_MODEL_ACCESS_DENIED,
        `The OpenAI API project cannot use ${model}. Enable that model for the project, or choose another supported model in the server settings. LeanAI did not switch models.`,
        diagnosed,
      );
    }

    if (error.status === 401) {
      return mapped(
        AI_PROVIDER_ERROR_CODES.RESPONSE_API_ERROR,
        "LeanAI could not authenticate to the model provider. An administrator needs to check the server credential. No model was substituted.",
        diagnosed,
      );
    }

    if (error.status === 429) {
      return mapped(
        AI_PROVIDER_ERROR_CODES.RESPONSE_RATE_LIMITED,
        "LeanAI is temporarily rate-limited by the provider. Please retry shortly.",
        diagnosed,
      );
    }

    if (error.status !== undefined && error.status >= 500) {
      return mapped(
        AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY,
        "LeanAI's provider is temporarily unavailable. Please retry.",
        diagnosed,
      );
    }

    if (error.status === 400) {
      const reasoningRejected =
        paramText.includes("reasoning") || text.includes("reasoning");
      const structuredRejected =
        paramText.includes("text.format") ||
        paramText.includes("response_format") ||
        text.includes("json_schema") ||
        text.includes("structured") ||
        text.includes("response_format");

      if (reasoningRejected) {
        return mapped(
          AI_PROVIDER_ERROR_CODES.RESPONSE_UNSUPPORTED_PARAMETER,
          `The reasoning effort is not supported by ${model}. GPT-6.1 Sol accepts low or higher, not none. Update AI_MODEL_REASONING or leave it unset. LeanAI did not switch models.`,
          diagnosed,
        );
      }

      if (structuredRejected) {
        return mapped(
          AI_PROVIDER_ERROR_CODES.RESPONSE_UNSUPPORTED_PARAMETER,
          `The configured model rejected LeanAI's strict structured response. The JSON contract was not relaxed. Confirm that ${model} can use structured outputs on this API project.`,
          diagnosed,
        );
      }

      return mapped(
        AI_PROVIDER_ERROR_CODES.RESPONSE_UNSUPPORTED_PARAMETER,
        "LeanAI's provider rejected the request configuration. Check the model id and reasoning settings. No model was substituted.",
        diagnosed,
      );
    }

    return mapped(
      AI_PROVIDER_ERROR_CODES.RESPONSE_API_ERROR,
      "LeanAI encountered a provider error. Please retry or contact an administrator.",
      diagnosed,
    );
  }

  if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
    return mapped(
      AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT,
      "LeanAI timed out before the provider finished. Please retry with a narrower request.",
      base,
    );
  }

  return mapped(
    AI_PROVIDER_ERROR_CODES.RESPONSE_API_ERROR,
    "LeanAI encountered a provider error. Please retry or contact an administrator.",
    base,
  );
}

function mapped(
  code: AiProviderErrorCode,
  message: string,
  diagnostics: AiProviderDiagnostics,
): AiProviderError {
  logAiProviderDiagnostics(diagnostics);
  return new AiProviderError(code, message, diagnostics);
}
