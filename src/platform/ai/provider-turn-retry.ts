import "server-only";

import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
} from "@/platform/ai/providers/errors";
import type { AiRunDeadline } from "@/platform/ai/run-deadline";
import {
  AI_TURN_FINALIZE_BUFFER_MS,
  AI_TURN_MIN_PROVIDER_TIMEOUT_MS,
} from "@/platform/ai/run-deadline";

/** Minimum remaining budget before a single fast 5xx retry is attempted. */
export const AI_PROVIDER_RETRY_MIN_REMAINING_MS = 8_000;

export function shouldRetryProviderOnce(
  error: unknown,
  deadline: AiRunDeadline,
): boolean {
  if (!(error instanceof AiProviderError)) {
    return false;
  }
  if (error.code !== AI_PROVIDER_ERROR_CODES.RESPONSE_TEMPORARY) {
    return false;
  }
  const httpStatus = error.diagnostics.httpStatus;
  if (httpStatus === undefined || httpStatus < 500 || httpStatus >= 600) {
    return false;
  }
  const remaining =
    deadline.remainingMs() -
    AI_TURN_FINALIZE_BUFFER_MS -
    AI_TURN_MIN_PROVIDER_TIMEOUT_MS;
  return remaining >= AI_PROVIDER_RETRY_MIN_REMAINING_MS;
}
