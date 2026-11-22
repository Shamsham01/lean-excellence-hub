import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANSWER_SAVE_ERROR_MESSAGE,
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

  it("keeps failed-save draft and error status after a same-walk answers refresh", async () => {
    saveAnswer.mockResolvedValue({ error: "network down" });

    const initial = {
      q1: { text_value: "server-copy", is_not_applicable: false },
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
      result.current.changeText("q1", "draft-after-failure");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEXT_SAVE_DEBOUNCE_MS);
    });
    await flushMicrotasks();

    expect(result.current.getStatus("q1")).toBe("error");
    expect(result.current.getError("q1")).toBe(ANSWER_SAVE_ERROR_MESSAGE);
    expect(result.current.getAnswer("q1").text_value).toBe(
      "draft-after-failure",
    );

    rerender({
      answers: {
        q1: {
          text_value: "draft-after-failure",
          is_not_applicable: false,
        },
      },
    });

    expect(result.current.getAnswer("q1").text_value).toBe(
      "draft-after-failure",
    );
    expect(result.current.getStatus("q1")).toBe("error");
    expect(result.current.getError("q1")).toBe(ANSWER_SAVE_ERROR_MESSAGE);

    let flushOk = true;
    await act(async () => {
      flushOk = await result.current.flushQuestion("q1");
    });
    expect(flushOk).toBe(false);
  }, 15_000);

  it("resolves q2 to saved after save completes despite a stale q2 snapshot", async () => {
    let releaseSave: (value: { ok: true }) => void = () => undefined;
    const saveDeferred = new Promise<{ ok: true }>((resolve) => {
      releaseSave = resolve;
    });
    saveAnswer.mockImplementation(() => saveDeferred);

    type AnswersProps = Record<
      string,
      { text_value: string | null; is_not_applicable: boolean }
    >;

    const initial: AnswersProps = {
      q1: { text_value: "First prompt notes.", is_not_applicable: false },
      q2: { text_value: null, is_not_applicable: false },
    };

    const { result, rerender } = renderHook(
      ({ answers }: { answers: AnswersProps }) =>
        useWalkAnswerState({
          walkId: "walk-a",
          answers,
          canEdit: true,
          saveAnswer,
        }),
      { initialProps: { answers: initial } },
    );

    act(() => {
      result.current.changeText("q2", "Second prompt notes.");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEXT_SAVE_DEBOUNCE_MS);
    });
    await flushMicrotasks();

    expect(result.current.getStatus("q2")).toBe("saving");

    rerender({
      answers: {
        q1: { text_value: "First prompt notes.", is_not_applicable: false },
        q2: { text_value: null, is_not_applicable: false },
      },
    });

    expect(result.current.getAnswer("q2").text_value).toBe(
      "Second prompt notes.",
    );
    expect(result.current.getStatus("q2")).toBe("saving");

    await act(async () => {
      releaseSave({ ok: true });
      await saveDeferred;
      await flushMicrotasks();
    });

    expect(result.current.getStatus("q2")).toBe("saved");
    expect(result.current.getAnswer("q2").text_value).toBe(
      "Second prompt notes.",
    );

    rerender({
      answers: {
        q1: { text_value: "First prompt notes.", is_not_applicable: false },
        q2: {
          text_value: "Second prompt notes.",
          is_not_applicable: false,
        },
      },
    });

    expect(result.current.getStatus("q2")).toBe("saved");
    expect(result.current.getAnswer("q2").text_value).toBe(
      "Second prompt notes.",
    );
  }, 15_000);

  it("rehydrates saved status after navigation remount when server answers are current", () => {
    vi.useRealTimers();
    saveAnswer.mockResolvedValue({ ok: true });

    const persisted = {
      q1: { text_value: "First prompt notes.", is_not_applicable: false },
      q2: {
        text_value: "Second prompt notes.",
        is_not_applicable: false,
      },
    };

    const { unmount } = renderHook(() =>
      useWalkAnswerState({
        walkId: "walk-a",
        answers: {
          q1: persisted.q1,
          q2: { text_value: null, is_not_applicable: false },
        },
        canEdit: true,
        saveAnswer,
      }),
    );

    unmount();

    const { result } = renderHook(() =>
      useWalkAnswerState({
        walkId: "walk-a",
        answers: persisted,
        canEdit: true,
        saveAnswer,
      }),
    );

    expect(result.current.getAnswer("q2").text_value).toBe(
      "Second prompt notes.",
    );
    expect(result.current.getStatus("q2")).toBe("saved");
  });
});
