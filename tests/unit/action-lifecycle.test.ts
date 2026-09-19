import { describe, expect, it } from "vitest";

import { mapActionMutationError } from "@/lib/actions/errors";
import {
  actionPriorityLabel,
  actionStatusLabel,
  allowedActionTransitions,
  dateInputToDueAt,
  formatActionReference,
  isActionEditable,
  toDateInputValue,
} from "@/lib/actions/status";

describe("action status helpers", () => {
  it("labels statuses and priorities in product language", () => {
    expect(actionStatusLabel("in_progress")).toBe("In progress");
    expect(actionPriorityLabel("urgent")).toBe("Urgent");
  });

  it("uses the action number as the human-readable reference", () => {
    expect(formatActionReference("ACT-2026-0001", "Fix labels")).toBe(
      "ACT-2026-0001",
    );
    expect(formatActionReference(null, "Fix labels")).toBe("Fix labels");
  });

  it("allows the intended lifecycle and reopen only from closed states", () => {
    expect(allowedActionTransitions("open")).toEqual([
      "in_progress",
      "completed",
      "cancelled",
    ]);
    expect(allowedActionTransitions("completed")).toEqual(["open"]);
    expect(allowedActionTransitions("verified")).toEqual([]);
    expect(isActionEditable("open")).toBe(true);
    expect(isActionEditable("completed")).toBe(false);
  });

  it("round-trips due dates without exposing a raw timestamp in the input", () => {
    expect(toDateInputValue("2026-09-19T12:00:00.000Z")).toBe("2026-09-19");
    expect(dateInputToDueAt("2026-09-19")).toBe("2026-09-19T12:00:00.000Z");
    expect(dateInputToDueAt("")).toBeNull();
  });
});

describe("action mutation errors", () => {
  it("maps closed-server transition failures to a visible product message", () => {
    expect(
      mapActionMutationError({
        code: "55000",
        message: "action transition is not allowed",
      }),
    ).toBe("That status change is not allowed from the current state.");
  });

  it("does not leak raw SQLSTATE or UUID details", () => {
    expect(
      mapActionMutationError({
        code: "42501",
        message: "42501 uuid 11111111-1111-4111-8111-111111111111",
      }),
    ).toBe("You do not have permission to change this action.");
  });
});
