import { describe, expect, it } from "vitest";

import {
  evaluateVerifyEligibility,
  interviewOnlySupports,
  latestCompletedRefutesWithoutNewerSupport,
} from "@/lib/problem-solving/hypothesis-verification-rules";
import type { ProblemSolvingHypothesisTest } from "@/lib/problem-solving/types";

function testRow(
  partial: Partial<ProblemSolvingHypothesisTest> &
    Pick<ProblemSolvingHypothesisTest, "id">,
): ProblemSolvingHypothesisTest {
  return {
    hypothesis_id: "h1",
    test_question: "Q",
    expected_result: "E",
    method: "Direct observation",
    status: "active",
    conclusion: null,
    actual_result: null,
    completed_date: null,
    created_by_membership_id: "m1",
    created_at: "2026-01-01T10:00:00Z",
    ...partial,
  };
}

describe("hypothesis verification rules", () => {
  it("blocks verify when every supporting test used Interview only", () => {
    const tests = [
      testRow({
        id: "t1",
        conclusion: "supports",
        method: "Interview",
        completed_date: "2026-01-02",
      }),
    ];
    expect(interviewOnlySupports(tests)).toBe(true);
    const result = evaluateVerifyEligibility({
      tests,
      evidenceLinkCount: 0,
      status: "supported",
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("Confirm with observation, data or a trial");
    }
  });

  it("allows verify when a non-interview support exists", () => {
    const tests = [
      testRow({
        id: "t1",
        conclusion: "supports",
        method: "Interview",
        completed_date: "2026-01-02",
      }),
      testRow({
        id: "t2",
        conclusion: "supports",
        method: "Measurement / data",
        completed_date: "2026-01-03",
      }),
    ];
    expect(interviewOnlySupports(tests)).toBe(false);
    expect(
      evaluateVerifyEligibility({
        tests,
        evidenceLinkCount: 0,
        status: "supported",
      }).allowed,
    ).toBe(true);
  });

  it("blocks verify when latest completed test refutes without newer support", () => {
    const tests = [
      testRow({
        id: "t1",
        conclusion: "supports",
        completed_date: "2026-01-02",
      }),
      testRow({
        id: "t2",
        conclusion: "refutes",
        completed_date: "2026-01-05",
      }),
    ];
    expect(latestCompletedRefutesWithoutNewerSupport(tests)).toBe(true);
    expect(
      evaluateVerifyEligibility({
        tests,
        evidenceLinkCount: 0,
        status: "testing",
      }).allowed,
    ).toBe(false);
  });

  it("allows verify when a support is newer than the latest refute", () => {
    const tests = [
      testRow({
        id: "t1",
        conclusion: "refutes",
        completed_date: "2026-01-05",
      }),
      testRow({
        id: "t2",
        conclusion: "supports",
        completed_date: "2026-01-06",
      }),
    ];
    expect(latestCompletedRefutesWithoutNewerSupport(tests)).toBe(false);
    expect(
      evaluateVerifyEligibility({
        tests,
        evidenceLinkCount: 0,
        status: "supported",
      }).allowed,
    ).toBe(true);
  });

  it("blocks verify when refute completes later the same day as support", () => {
    const sameDay = "2026-03-10";
    const tests = [
      testRow({
        id: "t1",
        conclusion: "supports",
        completed_date: sameDay,
        created_at: "2026-03-10T09:00:00Z",
      }),
      testRow({
        id: "t2",
        conclusion: "refutes",
        completed_date: sameDay,
        created_at: "2026-03-10T15:00:00Z",
      }),
    ];
    expect(latestCompletedRefutesWithoutNewerSupport(tests)).toBe(true);
  });

  it("allows verify when support completes later the same day as refute", () => {
    const sameDay = "2026-03-10";
    const tests = [
      testRow({
        id: "t1",
        conclusion: "refutes",
        completed_date: sameDay,
        created_at: "2026-03-10T09:00:00Z",
      }),
      testRow({
        id: "t2",
        conclusion: "supports",
        completed_date: sameDay,
        created_at: "2026-03-10T15:00:00Z",
      }),
    ];
    expect(latestCompletedRefutesWithoutNewerSupport(tests)).toBe(false);
    expect(
      evaluateVerifyEligibility({
        tests,
        evidenceLinkCount: 0,
        status: "supported",
      }).allowed,
    ).toBe(true);
  });

  it("allows verify with linked evidence and no supporting test", () => {
    const tests = [
      testRow({
        id: "t1",
        conclusion: "inconclusive",
        completed_date: "2026-01-02",
      }),
    ];
    expect(
      evaluateVerifyEligibility({
        tests,
        evidenceLinkCount: 1,
        status: "testing",
      }).allowed,
    ).toBe(true);
  });
});
