import { describe, expect, it } from "vitest";

import { hasUsableFiveSAuditAnswer } from "@/modules/5s/audit-answer-usability";

describe("hasUsableFiveSAuditAnswer", () => {
  it("accepts yes/no, numeric, text and not applicable answers", () => {
    expect(
      hasUsableFiveSAuditAnswer(
        { question_type: "yes_no", allows_not_applicable: false },
        { text_value: "yes" },
      ),
    ).toBe(true);
    expect(
      hasUsableFiveSAuditAnswer(
        { question_type: "score", allows_not_applicable: true },
        { is_not_applicable: true },
      ),
    ).toBe(true);
    expect(
      hasUsableFiveSAuditAnswer(
        { question_type: "number", allows_not_applicable: false },
        { number_value: 4 },
      ),
    ).toBe(true);
    expect(
      hasUsableFiveSAuditAnswer(
        { question_type: "text", allows_not_applicable: false },
        { text_value: " Notes " },
      ),
    ).toBe(true);
    expect(
      hasUsableFiveSAuditAnswer(
        { question_type: "yes_no", allows_not_applicable: false },
        { text_value: "" },
      ),
    ).toBe(false);
  });
});
