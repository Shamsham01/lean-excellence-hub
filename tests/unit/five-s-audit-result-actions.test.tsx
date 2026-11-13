import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiveSAuditResult } from "@/components/five-s/audit-result";

vi.mock("@/lib/attachments/download-evidence", () => ({
  createEvidenceObjectUrl: vi.fn().mockResolvedValue("blob:preview"),
  downloadEvidenceObject: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

const QUESTION_ID = "q-safety";

describe("FiveSAuditResult linked actions", () => {
  it("renders action metadata and photos under the linked question", () => {
    render(
      <FiveSAuditResult
        sections={[
          {
            id: "section-1",
            title: "Sort",
            questions: [
              {
                id: QUESTION_ID,
                prompt: "Are walkways clear?",
                question_type: "yes_no",
                help_text: null,
              },
            ],
          },
        ]}
        answers={{
          [QUESTION_ID]: { text_value: "no" },
        }}
        evidence={[]}
        linkedActions={[
          {
            id: "action-9",
            questionId: QUESTION_ID,
            title: "Clear aisle obstruction",
            status: "open",
            dueAt: null,
            assigneeDisplayName: "Alex Operator",
            evidence: [
              {
                id: "att-1",
                filename: "aisle.jpg",
                mime_type: "image/jpeg",
                byte_size: 1200,
                storage_object_path: "org/evidence/att-1",
              },
            ],
          },
        ]}
      />,
    );

    expect(
      screen.getByTestId(`five-s-result-actions-${QUESTION_ID}`),
    ).toBeVisible();
    expect(
      screen.getByTestId("five-s-result-action-action-9"),
    ).toHaveTextContent("Clear aisle obstruction");
    expect(screen.getByText("Assignee: Alex Operator")).toBeVisible();
    expect(screen.getByText("aisle.jpg")).toBeVisible();
  });
});
