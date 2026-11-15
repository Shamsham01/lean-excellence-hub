import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createHypothesisTestMock } = vi.hoisted(() => ({
  createHypothesisTestMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/problem-solving/actions", () => ({
  updateHypothesisStatus: vi.fn(),
  createHypothesisTest: createHypothesisTestMock,
  completeHypothesisTest: vi.fn(),
  deleteHypothesisTest: vi.fn(),
  verifyCauseHypothesis: vi.fn(),
  rejectCauseHypothesis: vi.fn(),
}));

import { HypothesisVerificationCard } from "@/components/problem-solving/guided/hypothesis-verification-card";

const hypothesis = {
  id: "hyp-1",
  statement: "Seal misalignment",
  category: "Machine",
  status: "testing",
  rationale: null,
  verification_rationale: null,
  verified_by_membership_id: null,
  verified_at: null,
  rejection_rationale: null,
  rejected_by_membership_id: null,
  rejected_at: null,
  parent_hypothesis_id: null,
  created_by_membership_id: "m1",
  created_at: "2026-01-01T00:00:00Z",
  evidence_links: [],
};

describe("client mutation keys on retry", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("reuses the same mutation key when create test fails then retries", async () => {
    createHypothesisTestMock
      .mockResolvedValueOnce({ error: "network timeout" })
      .mockResolvedValueOnce({ ok: true });

    render(
      <HypothesisVerificationCard
        caseId="case-1"
        hypothesis={hypothesis}
        tests={[]}
        canContribute
        canManage
        canVerifyCause
        canEditCaseDefinition
        membershipNameById={{ m1: "Sam" }}
      />,
    );

    const question = screen.getByTestId(
      `hypothesis-test-question-${hypothesis.id}`,
    );
    const method = screen.getByTestId(
      `hypothesis-test-method-${hypothesis.id}`,
    );
    fireEvent.change(question, {
      target: { value: "Does heat enlarge the gap?" },
    });
    fireEvent.change(method, { target: { value: "Measurement / data" } });

    const submit = () =>
      fireEvent.click(
        screen.getByTestId(`create-hypothesis-test-${hypothesis.id}`),
      );

    submit();
    await waitFor(() =>
      expect(createHypothesisTestMock).toHaveBeenCalledTimes(1),
    );

    submit();
    await waitFor(() =>
      expect(createHypothesisTestMock).toHaveBeenCalledTimes(2),
    );

    const firstKey = createHypothesisTestMock.mock.calls[0]![0].mutationKey;
    const secondKey = createHypothesisTestMock.mock.calls[1]![0].mutationKey;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });
});
