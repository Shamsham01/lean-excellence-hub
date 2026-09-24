import { describe, expect, it } from "vitest";

import {
  deriveReviewSlaState,
  reviewSlaLabel,
} from "@/lib/suggestions/review-sla";
import {
  pipelineStatuses,
  suggestionStatusAllowsAuthorEvidenceUpload,
  suggestionStatusLabel,
} from "@/lib/suggestions/status";

describe("suggestion review SLA", () => {
  it("marks overdue when past review target", () => {
    const submitted = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-20T10:00:00Z");
    expect(deriveReviewSlaState(submitted.toISOString(), 7, false, now)).toBe(
      "overdue",
    );
  });

  it("returns decided when final decision exists", () => {
    expect(deriveReviewSlaState("2026-01-01T10:00:00Z", 7, true)).toBe(
      "decided",
    );
  });

  it("labels SLA states", () => {
    expect(reviewSlaLabel("overdue")).toBe("Overdue");
  });
});

describe("suggestion status presentation", () => {
  it("formats status labels", () => {
    expect(suggestionStatusLabel("under_review")).toBe("Under Review");
  });

  it("returns pipeline statuses", () => {
    expect(pipelineStatuses()).toContain("implemented");
  });

  it("allows author evidence upload only on draft", () => {
    expect(suggestionStatusAllowsAuthorEvidenceUpload("draft")).toBe(true);
    expect(suggestionStatusAllowsAuthorEvidenceUpload("submitted")).toBe(false);
    expect(suggestionStatusAllowsAuthorEvidenceUpload("under_review")).toBe(
      false,
    );
    expect(suggestionStatusAllowsAuthorEvidenceUpload("parked")).toBe(false);
    expect(suggestionStatusAllowsAuthorEvidenceUpload("accepted")).toBe(false);
    expect(suggestionStatusAllowsAuthorEvidenceUpload("implementing")).toBe(
      false,
    );
    expect(suggestionStatusAllowsAuthorEvidenceUpload("implemented")).toBe(
      false,
    );
    expect(suggestionStatusAllowsAuthorEvidenceUpload("rejected")).toBe(false);
    expect(suggestionStatusAllowsAuthorEvidenceUpload("withdrawn")).toBe(false);
  });
});
