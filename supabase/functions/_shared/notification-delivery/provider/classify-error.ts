import { OperationalEmailProviderError } from "./types.ts";

function readStatusCode(error: unknown): number | undefined {
  if (error instanceof OperationalEmailProviderError) {
    return error.statusCode;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return undefined;
}

function readErrorName(error: unknown): string | undefined {
  if (error instanceof OperationalEmailProviderError) {
    return error.providerErrorName;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }

  return undefined;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "unknown_provider_error";
}

export function classifyProviderError(error: unknown): {
  retryable: boolean;
  code: string;
} {
  if (error instanceof OperationalEmailProviderError) {
    return {
      retryable: error.retryable,
      code: error.code,
    };
  }

  const errorName = readErrorName(error);
  const statusCode = readStatusCode(error);
  const message = readMessage(error).toLowerCase();

  if (errorName === "invalid_idempotent_request") {
    return {
      retryable: false,
      code: "provider_idempotency_conflict",
    };
  }

  if (errorName === "concurrent_idempotent_requests") {
    return {
      retryable: true,
      code: "provider_idempotency_in_flight",
    };
  }

  if (message.includes("idempotency") && message.includes("different")) {
    return {
      retryable: false,
      code: "provider_idempotency_conflict",
    };
  }

  if (statusCode === 409) {
    return {
      retryable: true,
      code: "provider_idempotency_in_flight",
    };
  }

  if (statusCode === 429) {
    return {
      retryable: true,
      code: "provider_rate_limited",
    };
  }

  if (statusCode !== undefined && statusCode >= 500) {
    return {
      retryable: true,
      code: "provider_server_error",
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      retryable: false,
      code: "provider_auth_configuration",
    };
  }

  if (statusCode === 422 || statusCode === 400) {
    return {
      retryable: false,
      code: "provider_invalid_request",
    };
  }

  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("econnreset")
  ) {
    return {
      retryable: true,
      code: "provider_network_error",
    };
  }

  return {
    retryable: true,
    code: "provider_unknown_retryable",
  };
}
