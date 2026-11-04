import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AI_TURN_WALL_CLOCK_USER_MESSAGE,
  createAiRunDeadline,
  resolveAiTurnWallClockMs,
  runWithinAiTurnBudget,
  turnWallClockExceededError,
} from "@/platform/ai/run-deadline";
import { AI_PROVIDER_ERROR_CODES } from "@/platform/ai/providers/errors";

describe("ai run wall-clock deadline", () => {
  it("caps each provider call by remaining wall-clock budget", () => {
    vi.useFakeTimers();
    const deadline = createAiRunDeadline(10_000);
    expect(deadline.providerTimeoutMs(45_000, "openai", "gpt-test")).toBe(
      7_500,
    );
    vi.advanceTimersByTime(6_000);
    expect(deadline.providerTimeoutMs(45_000, "openai", "gpt-test")).toBe(
      1_500,
    );
    vi.useRealTimers();
  });

  it("throws a typed timeout when the budget is exhausted", () => {
    vi.useFakeTimers();
    const deadline = createAiRunDeadline(10_000);
    vi.advanceTimersByTime(2_000);
    expect(() =>
      deadline.assertWithinBudget("openai", "gpt-test"),
    ).not.toThrow();
    vi.advanceTimersByTime(8_500);
    expect(() => deadline.assertWithinBudget("openai", "gpt-test")).toThrow(
      AI_TURN_WALL_CLOCK_USER_MESSAGE,
    );
    vi.useRealTimers();
  });

  it("uses a production-safe default wall clock", () => {
    expect(resolveAiTurnWallClockMs(undefined)).toBe(45_000);
    expect(resolveAiTurnWallClockMs(55_000)).toBe(55_000);
  });

  it("aborts slow work that exceeds the remaining budget", async () => {
    vi.useFakeTimers();
    const deadline = createAiRunDeadline(2_000);
    const work = runWithinAiTurnBudget(
      deadline,
      "openai",
      "gpt-test",
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("late"), 3_000);
        }),
    );
    const expectation = expect(work).rejects.toThrow(
      AI_TURN_WALL_CLOCK_USER_MESSAGE,
    );
    await vi.advanceTimersByTimeAsync(3_000);
    await expectation;
    vi.useRealTimers();
  });

  it("maps wall-clock exhaustion to provider timeout category", () => {
    const error = turnWallClockExceededError("openai", "gpt-test");
    expect(error.code).toBe(AI_PROVIDER_ERROR_CODES.RESPONSE_TIMEOUT);
    expect(error.message).toBe(AI_TURN_WALL_CLOCK_USER_MESSAGE);
  });
});
