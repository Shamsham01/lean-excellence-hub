import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findAuthorisedSimilarRecords = vi.fn();

vi.mock("@/app/(platform)/platform/similarity/related-record-actions", () => ({
  findAuthorisedSimilarRecords: (...args: unknown[]) =>
    findAuthorisedSimilarRecords(...args),
}));

import { RelatedRecordsPanel } from "@/components/improvement/related-records-panel";

describe("RelatedRecordsPanel", () => {
  beforeEach(() => {
    findAuthorisedSimilarRecords.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an authorised suggestion match and still allows a new record", async () => {
    findAuthorisedSimilarRecords.mockResolvedValue({
      matches: [
        {
          recordId: "11111111-1111-4111-8111-111111111111",
          recordType: "improvement_suggestion",
          title: "Packaging sealer jaw improvement",
          status: "submitted",
          href: "/platform/suggestions/11111111-1111-4111-8111-111111111111",
          excerpt: "Night shift rejects increased.",
          applicability: "Not a duplicate.",
          contentTrust: "untrusted_record",
        },
      ],
    });

    render(
      <RelatedRecordsPanel
        recordType="improvement_suggestion"
        queryText="packaging sealer jaw improvement"
      />,
    );

    fireEvent.click(screen.getByTestId("find-related-records"));
    await Promise.resolve();

    expect(
      await screen.findByText("Packaging sealer jaw improvement"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("continue-with-new-record")).toHaveTextContent(
      /new suggestion/i,
    );
    expect(findAuthorisedSimilarRecords).toHaveBeenCalledWith({
      recordType: "improvement_suggestion",
      query: "packaging sealer jaw improvement",
    });
  });

  it("does not search when the query is empty", () => {
    render(
      <RelatedRecordsPanel recordType="action" queryText="" />,
    );
    fireEvent.click(screen.getByTestId("find-related-records"));
    expect(findAuthorisedSimilarRecords).not.toHaveBeenCalled();
  });
});
