import "server-only";

import { AI_TURN_WALL_CLOCK_USER_MESSAGE } from "@/platform/ai/ai-turn-messages";
import {
  AI_PROVIDER_ERROR_CODES,
  AiProviderError,
} from "@/platform/ai/providers/errors";

export {
  AI_TURN_IN_PROGRESS_MESSAGE,
  AI_TURN_UNCERTAIN_COMPLETION_MESSAGE,
  AI_TURN_WALL_CLOCK_USER_MESSAGE,
} from "@/platform/ai/ai-turn-messages";

/** Reserve time for Postgres finalisation after the last provider call. */
export const AI_TURN_FINALIZE_BUFFER_MS = 2_500;

/** Minimum timeout passed to a single provider call. */
export const AI_TURN_MIN_PROVIDER_TIMEOUT_MS = 1_000;

/**
 * One provider attempt plus finalisation must finish inside Netlify's
 * synchronous function limit. That limit is 60 seconds and is not configurable.
 * The OpenAI SDK retries connection timeouts by default, so a 45s timeout can
 * start a second attempt and be killed at 60s before `fail_ai_run` runs.
 */
export const AI_TURN_WALL_CLOCK_DEFAULT_MS = 45_000;

/** Netlify synchronous execution limit. Not configurable. */
export const AI_SYNC_HOST_LIMIT_MS = 60_000;

/**
 * Wait past the host limit before another request treats a `running` row as
 * abandoned. A live turn is still inside the 60s limit until then.
 */
export const AI_STALE_RUN_GRACE_MS = 5_000;

export const AI_STALE_RUN_AFTER_MS =
  AI_SYNC_HOST_LIMIT_MS + AI_STALE_RUN_GRACE_MS;

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

/** Race work against remaining turn budget (provider, tools, finalisation). */
export async function runWithinAiTurnBudget<T>(
  deadline: AiRunDeadline,
  provider: string,
  model: string,
  work: () => Promise<T>,
): Promise<T> {
  deadline.assertWithinBudget(provider, model);
  const remainingMs = deadline.remainingMs() - AI_TURN_FINALIZE_BUFFER_MS;
  if (remainingMs <= 0) {
    throw turnWallClockExceededError(provider, model);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(turnWallClockExceededError(provider, model)),
      remainingMs,
    );
  });

  const workPromise = work();
  void workPromise.catch(() => undefined);

  try {
    return await Promise.race([workPromise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
