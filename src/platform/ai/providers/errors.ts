export const AI_PROVIDER_ERROR_CODES = {
  RESPONSE_INCOMPLETE_MAX_OUTPUT: "AI_RESPONSE_INCOMPLETE_MAX_OUTPUT",
  RESPONSE_PARSE_ERROR: "AI_RESPONSE_PARSE_ERROR",
  RESPONSE_NORMALIZATION_ERROR: "AI_RESPONSE_NORMALIZATION_ERROR",
  RESPONSE_CONTRACT_ERROR: "AI_RESPONSE_CONTRACT_ERROR",
  RESPONSE_API_ERROR: "AI_RESPONSE_API_ERROR",
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

export function logAiProviderDiagnostics(diagnostics: AiProviderDiagnostics) {
  console.warn("[lean-ai:provider]", JSON.stringify(diagnostics));
}
