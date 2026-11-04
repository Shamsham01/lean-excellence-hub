import "server-only";

import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
} from "@/platform/ai/providers/errors";

/** Reserve time for Postgres finalisation after the last provider call. */
export const AI_TURN_FINALIZE_BUFFER_MS = 2_500;

/** Minimum timeout passed to a single provider call. */
export const AI_TURN_MIN_PROVIDER_TIMEOUT_MS = 1_000;

export const AI_TURN_WALL_CLOCK_DEFAULT_MS = 50_000;

export const AI_TURN_WALL_CLOCK_USER_MESSAGE =
  "Lean AI took too long to finish this turn. Nothing was saved to your case. Your message is still here — try a shorter question or retry in a moment.";

export type AiRunDeadline = {
  readonly wallClockMs: number;
  readonly startedAt: number;
  remainingMs(): number;
  assertWithinBudget(provider: string, model: string): void;
  providerTimeoutMs(
    configuredPerCallMs: number,
    provider: string,
    model: string,
  ): number;
};

export function resolveAiTurnWallClockMs(
  configured: number | undefined,
): number {
  const value = configured ?? AI_TURN_WALL_CLOCK_DEFAULT_MS;
  return Math.max(
    AI_TURN_MIN_PROVIDER_TIMEOUT_MS + AI_TURN_FINALIZE_BUFFER_MS,
    value,
  );
}

export function createAiRunDeadline(wallClockMs: number): AiRunDeadline {
  const startedAt = Date.now();
  const deadlineAt = startedAt + wallClockMs;

  return {
    wallClockMs,
    startedAt,
    remainingMs() {
      return Math.max(0, deadlineAt - Date.now());
    },
    assertWithinBudget(provider: string, model: string) {
      if (Date.now() >= deadlineAt - AI_TURN_FINALIZE_BUFFER_MS) {
        throw turnWallClockExceededError(provider, model);
      }
    },
    providerTimeoutMs(
      configuredPerCallMs: number,
      provider: string,
      model: string,
    ) {
      const remaining = deadlineAt - Date.now() - AI_TURN_FINALIZE_BUFFER_MS;
      if (remaining <= 0) {
        throw turnWallClockExceededError(provider, model);
      }
      return Math.max(
        AI_TURN_MIN_PROVIDER_TIMEOUT_MS,
        Math.min(configuredPerCallMs, remaining),
      );
    },
  };
}

export function turnWallClockExceededError(
  provider: string,
  model: string,
): AiProviderError {
  return new AiProviderError(
    AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT,
    AI_TURN_WALL_CLOCK_USER_MESSAGE,
    { provider, model },
  );
}
