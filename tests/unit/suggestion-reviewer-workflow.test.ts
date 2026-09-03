import { describe, expect, it } from "vitest";

import {
  deriveParkedPresentation,
  formatParkedDate,
} from "@/lib/suggestions/parked-labels";
import { mapSuggestionReviewActionError } from "@/lib/suggestions/review-action-errors";
import {
  buildSuggestionReviewQueueSearchParams,
  parseSuggestionReviewQueueSearchParams,
  suggestionReviewQueueHref,
} from "@/lib/suggestions/review-queue-query";
import {
  formatPortfolioReviewerLabel,
  formatReviewerAssignmentLabel,
} from "@/lib/suggestions/reviewer-labels";

describe("review queue query helpers", () => {
  it("defaults queue to mine", () => {
    expect(parseSuggestionReviewQueueSearchParams({})).toEqual({
      queue: "mine",
      suggestionId: null,
      page: 1,
    });
  });

  it("normalizes invalid queue values to mine", () => {
    expect(parseSuggestionReviewQueueSearchParams({ queue: "all" }).queue).toBe(
      "mine",
    );
  });

  it("builds review queue URLs with durable state", () => {
    expect(
      suggestionReviewQueueHref({
        queue: "unassigned",
        suggestionId: "11111111-1111-4111-8111-111111111111",
        page: 2,
      }),
    ).toBe(
      "/platform/suggestions/review?queue=unassigned&suggestionId=11111111-1111-4111-8111-111111111111&page=2",
    );
  });

  it("omits default queue and page from generated params", () => {
    expect(
      buildSuggestionReviewQueueSearchParams({
        queue: "mine",
        page: 1,
      }).toString(),
    ).toBe("");
  });
});

describe("reviewer assignment labels", () => {
  it("formats self assignment kinds", () => {
    expect(
      formatReviewerAssignmentLabel({
        assignmentKind: "claimed",
        displayName: "Apex Manager",
        isActiveReviewer: true,
        isSelf: true,
      }),
    ).toBe("Claimed by you");
  });

  it("hides unassigned state from ordinary readers", () => {
    expect(
      formatPortfolioReviewerLabel({
        active_reviewer_display_name: null,
        active_reviewer_assignment_kind: null,
        is_active_reviewer: false,
        can_review: false,
        can_manage_review: false,
      }),
    ).toBeNull();
  });

  it("shows unassigned for workflow-capable readers", () => {
    expect(
      formatPortfolioReviewerLabel({
        active_reviewer_display_name: null,
        active_reviewer_assignment_kind: null,
        is_active_reviewer: false,
        can_review: true,
        can_manage_review: false,
      }),
    ).toBe("Unassigned");
  });
});

describe("parked presentation", () => {
  it("shows current parked state only when status is parked", () => {
    expect(
      deriveParkedPresentation({
        status: "parked",
        parkedAt: "2026-09-02T12:00:00.000Z",
        parkedRationale: "Need more evidence",
      }),
    ).toEqual({
      showCurrentParked: true,
      showHistoricalParked: false,
    });
  });

  it("shows historical parked context after resume", () => {
    expect(
      deriveParkedPresentation({
        status: "under_review",
        parkedAt: "2026-09-02T12:00:00.000Z",
        parkedRationale: "Need more evidence",
      }),
    ).toEqual({
      showCurrentParked: false,
      showHistoricalParked: true,
    });
  });

  it("formats parked dates safely", () => {
    expect(formatParkedDate("2026-09-02T12:00:00.000Z")).toMatch(/2 Sept 2026/);
  });
});

describe("review action error mapping", () => {
  it("maps stale state conflicts", () => {
    expect(
      mapSuggestionReviewActionError({
        code: "55000",
        message: "suggestion already has an active reviewer",
      }),
    ).toBe(
      "This suggestion changed since you opened it. Refreshing the latest state.",
    );
  });

  it("maps permission failures", () => {
    expect(
      mapSuggestionReviewActionError({
        code: "42501",
        message: "review start is not authorised",
      }),
    ).toBe("You no longer have permission to perform this review action.");
  });
});
