export const AI_PROVIDER_ERROR_CODES = {
  RESPONSE_INCOMPLETE_MAX_OUTPUT: "AI_RESPONSE_INCOMPLETE_MAX_OUTPUT",
  RESPONSE_PARSE_ERROR: "AI_RESPONSE_PARSE_ERROR",
  RESPONSE_NORMALIZATION_ERROR: "AI_RESPONSE_NORMALIZATION_ERROR",
  RESPONSE_CONTRACT_ERROR: "AI_RESPONSE_CONTRACT_ERROR",
  RESPONSE_API_ERROR: "AI_RESPONSE_API_ERROR",
  RESPONSE_MODEL_UNAVAILABLE: "AI_RESPONSE_MODEL_UNAVAILABLE",
  RESPONSE_MODEL_ACCESS_DENIED: "AI_RESPONSE_MODEL_ACCESS_DENIED",
  RESPONSE_UNSUPPORTED_PARAMETER: "AI_RESPONSE_UNSUPPORTED_PARAMETER",
  RESPONSE_RATE_LIMITED: "AI_RESPONSE_RATE_LIMITED",
  RESPONSE_TIMEOUT: "AI_RESPONSE_TIMEOUT",
  RESPONSE_TEMPORARY: "AI_RESPONSE_TEMPORARY",
} as const;

export type AiProviderErrorCode =
  (typeof AI_PROVIDER_ERROR_CODES)[keyof typeof AI_PROVIDER_ERROR_CODES];

export type AiProviderDiagnostics = {
  provider: string;
  model: string;
  responseId?: string;
  responseStatus?: string;
  incompleteReason?: string;
  outputTokens?: number;
  reasoningTokens?: number;
  configuredMaxOutputTokens?: number;
  errorCode?: string;
  httpStatus?: number;
  requestId?: string;
  providerErrorParam?: string;
  providerMessage?: string;
  reasoningEffort?: string;
};

export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode;
  readonly diagnostics: AiProviderDiagnostics;

  constructor(
    code: AiProviderErrorCode,
    message: string,
    diagnostics: AiProviderDiagnostics,
  ) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

export const INCOMPLETE_MAX_OUTPUT_USER_MESSAGE =
  "Lean AI could not complete the structured response within the configured output limit. Please retry with a narrower request or contact an administrator.";

export const STRUCTURED_CONTRACT_USER_MESSAGE =
  "Lean AI received an invalid structured response from the provider. Please retry or contact an administrator.";

export function redactProviderText(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 240);
}

export function logAiProviderDiagnostics(diagnostics: AiProviderDiagnostics) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(diagnostics)) {
    if (value === undefined) continue;
    safe[key] = typeof value === "string" ? redactProviderText(value) : value;
  }
  console.warn("[lean-ai:provider]", JSON.stringify(safe));
}

export function aiRunFailureCategory(error: unknown): string {
  if (error instanceof AiProviderError) {
    switch (error.code) {
      case AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT:
        return "timeout";
      case AI_PROVIDER_ERROR_CODES.RESPONSE_MODEL_UNAVAILABLE:
        return "model_unavailable";
      case AI_PROVIDER_ERROR_CODES.RESPONSE_MODEL_ACCESS_DENIED:
        return "model_access_denied";
      case AI_PROVIDER_ERROR_CODES.RESPONSE_UNSUPPORTED_PARAMETER:
        return "unsupported_request";
      case AI_PROVIDER_ERROR_CODES.RESPONSE_RATE_LIMITED:
        return "rate_limited";
      case AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY:
        return "provider_unavailable";
      default:
        return "provider_error";
    }
  }

  if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
    return "timeout";
  }

  return "provider_error";
}
