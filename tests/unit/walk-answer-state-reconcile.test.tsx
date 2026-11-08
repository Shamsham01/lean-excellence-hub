import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TEXT_SAVE_DEBOUNCE_MS,
  useWalkAnswerState,
} from "@/components/gemba/walk-answer-state";

const saveAnswer = vi.fn();

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useWalkAnswerState same-walk answers reconciliation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveAnswer.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a typed draft when a stale server snapshot arrives before the save settles", async () => {
    let releaseSave: (value: { ok: true }) => void = () => undefined;
    const saveDeferred = new Promise<{ ok: true }>((resolve) => {
      releaseSave = resolve;
    });
    saveAnswer.mockImplementation(() => saveDeferred);

    const initial = {
      q1: { text_value: "confirmed", is_not_applicable: false },
    };

    const { result, rerender } = renderHook(
      ({ answers }) =>
        useWalkAnswerState({
          walkId: "walk-a",
          answers,
          canEdit: true,
          saveAnswer,
        }),
      { initialProps: { answers: initial } },
    );

    act(() => {
      result.current.changeText("q1", "draft-while-saving");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEXT_SAVE_DEBOUNCE_MS);
    });
    await flushMicrotasks();

    expect(result.current.getStatus("q1")).toBe("saving");

    const staleSnapshot = {
      q1: { text_value: "confirmed", is_not_applicable: false },
      q2: { text_value: null, is_not_applicable: false },
    };

    rerender({ answers: staleSnapshot });

    expect(result.current.getAnswer("q1").text_value).toBe(
      "draft-while-saving",
    );

    await act(async () => {
      releaseSave({ ok: true });
      await saveDeferred;
      await flushMicrotasks();
    });

    expect(result.current.getStatus("q1")).toBe("saved");
    expect(saveAnswer).toHaveBeenCalledWith("walk-a", "q1", {
      textValue: "draft-while-saving",
    });

    let flushOk = false;
    await act(async () => {
      flushOk = await result.current.flushQuestion("q1");
    });
    expect(flushOk).toBe(true);
  }, 15_000);

  it("rehydrates idle questions from a same-walk snapshot without touching other runtimes", async () => {
    saveAnswer.mockResolvedValue({ ok: true });

    const initial = {
      q1: { text_value: "alpha", is_not_applicable: false },
      q2: { text_value: "bravo", is_not_applicable: false },
    };

    const { result, rerender } = renderHook(
      ({ answers }) =>
        useWalkAnswerState({
          walkId: "walk-a",
          answers,
          canEdit: true,
          saveAnswer,
        }),
      { initialProps: { answers: initial } },
    );

    act(() => {
      result.current.changeText("q1", "edited-alpha");
    });

    const serverRefresh = {
      q1: { text_value: "alpha", is_not_applicable: false },
      q2: { text_value: "bravo-server", is_not_applicable: false },
    };

    rerender({ answers: serverRefresh });

    expect(result.current.getAnswer("q1").text_value).toBe("edited-alpha");
    expect(result.current.getAnswer("q2").text_value).toBe("bravo-server");
  });
});
