import { describe, expect, it } from "vitest";

import {
  caseAuditEventLabel,
  parseCaseAuditActivity,
} from "@/lib/problem-solving/case-audit-activity";

describe("case audit activity", () => {
  it("labels known audit actions", () => {
    expect(caseAuditEventLabel("problem_solving.fishbone_cause_promoted")).toBe(
      "Fishbone cause promoted",
    );
  });

  it("parses audit activity rows", () => {
    const rows = parseCaseAuditActivity([
      {
        id: "a1",
        event_action: "problem_solving.problem_statement_updated",
        event_outcome: "succeeded",
        actor_membership_id: "m1",
        metadata: { excerpt: "New statement" },
        created_at: "2026-01-01T10:00:00Z",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.event_action).toBe(
      "problem_solving.problem_statement_updated",
    );
  });
});