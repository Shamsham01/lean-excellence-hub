export class TerminalProjectionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TerminalProjectionError";
    this.code = code;
  }
}

export class RetryableProjectionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RetryableProjectionError";
    this.code = code;
  }
}

const TERMINAL_RPC_PATTERNS = [
  "organisation mismatch",
  "does not exist",
  "delivery_key already exists with different immutable identity",
  "invalid_payload",
  "tenant_mismatch",
];

export function classifyWorkerRpcError(error: {
  code?: string;
  message: string;
}): "terminal" | "retryable" {
  const normalizedMessage = error.message.toLowerCase();

  if (error.code === "23503" || error.code === "23514" || error.code === "23505") {
    return "terminal";
  }

  if (
    TERMINAL_RPC_PATTERNS.some((pattern) =>
      normalizedMessage.includes(pattern),
    )
  ) {
    return "terminal";
  }

  return "retryable";
}
