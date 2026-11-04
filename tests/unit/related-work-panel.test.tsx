import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findAuthorisedProblemSolvingHistory = vi.fn();

vi.mock(
  "@/app/(platform)/platform/problem-solving/related-history-actions",
  () => ({
    findAuthorisedProblemSolvingHistory: (...args: unknown[]) =>
      findAuthorisedProblemSolvingHistory(...args),
    linkAuthorisedProblemSolvingCase: vi.fn(),
  }),
);

import { RelatedWorkPanel } from "@/components/problem-solving/related-work-panel";

describe("RelatedWorkPanel", () => {
  beforeEach(() => {
    findAuthorisedProblemSolvingHistory.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an authorised match and still allows a new record", async () => {
    findAuthorisedProblemSolvingHistory.mockResolvedValue({
      matches: [
        {
          caseId: "11111111-1111-4111-8111-111111111111",
          recordType: "problem_solving_case",
          title: "Bodmin sealer jaw wear",
          status: "closed",
          closureOutcome: "resolved_verified_cause",
          href: "/platform/problem-solving/11111111-1111-4111-8111-111111111111",
          problemStatementExcerpt: "Rejects rose.",
          verifiedCauseSnippets: ["Worn jaw"],
          evidenceClass: "historical_verified_outcome",
          applicability: "Not proof for this problem.",
          contentTrust: "untrusted_record",
        },
      ],
      consultation: {
        summary: "1 accessible closed case matches this description.",
        points: [
          {
            text: "Bodmin sealer jaw wear was verified on that case only.",
            sourceClass: "historical_verified_outcome",
            href: "/platform/problem-solving/11111111-1111-4111-8111-111111111111",
          },
        ],
        questions: ["What would disprove operator error?"],
        canContinue: true,
        blocked: false,
      },
    });

    render(
      <RelatedWorkPanel mode="draft" queryText="packaging sealer jaw wear" />,
    );

    fireEvent.click(screen.getByTestId("find-related-work"));

    expect(
      await screen.findByText("Bodmin sealer jaw wear"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("continue-with-new-record")).toHaveTextContent(
      /new record/i,
    );
    expect(
      screen.getAllByRole("link", { name: "View related work" })[0],
    ).toHaveAttribute(
      "href",
      "/platform/problem-solving/11111111-1111-4111-8111-111111111111",
    );
    expect(findAuthorisedProblemSolvingHistory).toHaveBeenCalledWith({
      mode: "draft",
      query: "packaging sealer jaw wear",
    });
  });

  it("answers a product question without searching", async () => {
    render(<RelatedWorkPanel mode="draft" queryText="" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "What is the difference between containment and a countermeasure?",
      }),
    );
    expect(
      await screen.findByTestId("problem-solving-guidance"),
    ).toHaveTextContent(/Containment protects/i);
    expect(findAuthorisedProblemSolvingHistory).not.toHaveBeenCalled();
  });
});
