import { describe, expect, it } from "vitest";

import {
  canTransitionProblemSolvingStatus,
  isProblemSolvingCaseEditable,
  portfolioFilterStatuses,
  priorityLabel,
  problemSolvingStatusLabel,
  severityLabel,
} from "@/lib/problem-solving/status";

describe("problem solving status helpers", () => {
  it("labels known lifecycle statuses", () => {
    expect(problemSolvingStatusLabel("draft")).toBe("Draft");
    expect(problemSolvingStatusLabel("active")).toBe("Active");
    expect(problemSolvingStatusLabel("closed")).toBe("Closed");
    expect(problemSolvingStatusLabel("cancelled")).toBe("Cancelled");
  });

  it("restricts draft-only editing", () => {
    expect(isProblemSolvingCaseEditable("draft")).toBe(true);
    expect(isProblemSolvingCaseEditable("active")).toBe(false);
  });

  it("allows expected lifecycle transitions", () => {
    expect(canTransitionProblemSolvingStatus("draft", "active")).toBe(true);
    expect(canTransitionProblemSolvingStatus("active", "closed")).toBe(true);
    expect(canTransitionProblemSolvingStatus("closed", "active")).toBe(false);
  });

  it("exposes portfolio filter statuses", () => {
    expect(portfolioFilterStatuses()).toEqual([
      "draft",
      "active",
      "closed",
      "cancelled",
    ]);
  });

  it("labels severity and priority values", () => {
    expect(severityLabel("major")).toBe("Major");
    expect(priorityLabel("high")).toBe("High");
  });
});
