import type { ProblemSolvingHypothesisTest } from "@/lib/problem-solving/types";

export const HYPOTHESIS_VERIFICATION_METHODS = [
  "Direct observation",
  "Measurement / data",
  "Reproduce / trial (on-off)",
  "Comparison (good vs bad)",
  "Record / document review",
  "Interview",
] as const;

export type HypothesisVerificationMethod =
  (typeof HYPOTHESIS_VERIFICATION_METHODS)[number];

export const HYPOTHESIS_INTERVIEW_METHOD: HypothesisVerificationMethod =
  "Interview";

function completedTests(
  tests: ProblemSolvingHypothesisTest[],
): ProblemSolvingHypothesisTest[] {
  return tests.filter(
    (test) => test.completed_date != null && test.conclusion != null,
  );
}

/** Newest-first ordering: completed_date (date-only) then created_at tie-break. */
export function compareCompletedTestsNewestFirst(
  a: ProblemSolvingHypothesisTest,
  b: ProblemSolvingHypothesisTest,
): number {
  const dateA = a.completed_date ?? "";
  const dateB = b.completed_date ?? "";
  if (dateA !== dateB) {
    return dateB.localeCompare(dateA);
  }
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function isCompletedTestNewerThan(
  candidate: ProblemSolvingHypothesisTest,
  reference: ProblemSolvingHypothesisTest,
): boolean {
  return compareCompletedTestsNewestFirst(reference, candidate) > 0;
}

function sortCompletedNewestFirst(
  tests: ProblemSolvingHypothesisTest[],
): ProblemSolvingHypothesisTest[] {
  return [...completedTests(tests)].sort(compareCompletedTestsNewestFirst);
}

export function hasSupportingCompletedTest(
  tests: ProblemSolvingHypothesisTest[],
): boolean {
  return completedTests(tests).some((test) => test.conclusion === "supports");
}

export function interviewOnlySupports(
  tests: ProblemSolvingHypothesisTest[],
): boolean {
  const supporting = completedTests(tests).filter(
    (test) => test.conclusion === "supports",
  );
  if (supporting.length === 0) {
    return false;
  }
  return supporting.every(
    (test) => (test.method ?? "").trim() === HYPOTHESIS_INTERVIEW_METHOD,
  );
}

export function latestCompletedRefutesWithoutNewerSupport(
  tests: ProblemSolvingHypothesisTest[],
): boolean {
  const newest = sortCompletedNewestFirst(tests)[0];
  if (!newest || newest.conclusion !== "refutes") {
    return false;
  }
  return !completedTests(tests).some(
    (test) =>
      test.conclusion === "supports" && isCompletedTestNewerThan(test, newest),
  );
}

export type VerifyEligibility =
  { allowed: true } | { allowed: false; reason: string };

export function evaluateVerifyEligibility(input: {
  tests: ProblemSolvingHypothesisTest[];
  evidenceLinkCount: number;
  status: string;
}): VerifyEligibility {
  if (!["testing", "supported"].includes(input.status)) {
    return { allowed: false, reason: "Hypothesis is not ready to verify." };
  }

  if (interviewOnlySupports(input.tests)) {
    return {
      allowed: false,
      reason: "Confirm with observation, data or a trial",
    };
  }

  if (latestCompletedRefutesWithoutNewerSupport(input.tests)) {
    return {
      allowed: false,
      reason:
        "The latest completed test refutes this hypothesis. Record a newer supporting test before verifying.",
    };
  }

  const hasSupports = hasSupportingCompletedTest(input.tests);
  const hasEvidence = input.evidenceLinkCount > 0;

  if (!hasSupports && !hasEvidence) {
    return {
      allowed: false,
      reason:
        "Complete a test that supports this cause, or link evidence on the hypothesis, before verifying.",
    };
  }

  return { allowed: true };
}

export function hypothesisTestMethodLabel(method: string | null): string {
  if (!method?.trim()) return "Method not recorded";
  return method.trim();
}
