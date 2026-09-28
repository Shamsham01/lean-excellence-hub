import { describe, expect, it } from "vitest";

import {
  assessmentActionsHref,
  buildActionListQuery,
  parseActionListFilters,
} from "@/lib/actions/action-filters";
import {
  canEditMaturityAssessment,
  formalLifecycleIndex,
} from "@/modules/maturity/formal-lifecycle";

describe("action list filters", () => {
  it("parses source, status, and assessment context from search params", () => {
    expect(
      parseActionListFilters({
        source: "maturity_assessment",
        status: "open",
        assessment: "assess-1",
        pillar: "pillar-1",
        criterion: "crit-1",
      }),
    ).toEqual({
      source: "maturity_assessment",
      status: "open",
      assignee: null,
      unit: null,
      assessment: "assess-1",
      pillar: "pillar-1",
      criterion: "crit-1",
    });
  });

  it("ignores unknown source values", () => {
    expect(parseActionListFilters({ source: "not-a-module" }).source).toBe(
      "all",
    );
  });

  it("builds shareable query strings and assessment deep links", () => {
    expect(
      buildActionListQuery({
        source: "maturity_assessment",
        status: null,
        assignee: null,
        unit: null,
        assessment: "assess-1",
        pillar: null,
        criterion: null,
      }),
    ).toBe("source=maturity_assessment&assessment=assess-1");
    expect(assessmentActionsHref("assess-1")).toBe(
      "/platform/actions?source=maturity_assessment&assessment=assess-1",
    );
  });
});

describe("formal maturity edit gate", () => {
  it("allows capture editing in progress and reviewer editing during assessor review", () => {
    expect(
      canEditMaturityAssessment({ status: "in_progress", canReview: false }),
    ).toBe(true);
    expect(
      canEditMaturityAssessment({
        status: "assessor_review",
        canReview: true,
      }),
    ).toBe(true);
    expect(
      canEditMaturityAssessment({
        status: "assessor_review",
        canReview: false,
      }),
    ).toBe(false);
    expect(
      canEditMaturityAssessment({ status: "published", canReview: true }),
    ).toBe(false);
  });

  it("maps lifecycle statuses in official order", () => {
    expect(formalLifecycleIndex("submitted")).toBe(1);
    expect(formalLifecycleIndex("assessor_review")).toBe(2);
    expect(formalLifecycleIndex("published")).toBe(4);
  });
});
