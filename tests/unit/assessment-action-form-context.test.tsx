import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMaturityAction } from "@/app/(platform)/platform/maturity/actions";
import { AssessmentActionForm } from "@/components/maturity/assessment-action-form";

vi.mock("@/app/(platform)/platform/maturity/actions", () => ({
  createMaturityAction: vi.fn(),
}));

const createAction = vi.mocked(createMaturityAction);

describe("AssessmentActionForm context", () => {
  beforeEach(() => {
    createAction.mockReset();
    createAction.mockResolvedValue({ actionId: "action-99" });
  });

  it("submits the visible criterion rather than a page-level first criterion", async () => {
    render(
      <AssessmentActionForm
        assessmentId="assess-1"
        pillarId="pillar-ops"
        criterionId="criterion-kpi"
        questions={[
          { id: "question-kpi", prompt: "How are losses controlled?" },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Create action"), {
      target: { value: "Stabilise KPI board" },
    });
    fireEvent.change(screen.getByLabelText("Related question"), {
      target: { value: "question-kpi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create action" }));

    await waitFor(() => {
      expect(createAction).toHaveBeenCalledTimes(1);
    });

    const formData = createAction.mock.calls[0]?.[0] as FormData;
    expect(formData.get("assessmentId")).toBe("assess-1");
    expect(formData.get("pillarId")).toBe("pillar-ops");
    expect(formData.get("criterionId")).toBe("criterion-kpi");
    expect(formData.get("questionId")).toBe("question-kpi");
    expect(formData.get("title")).toBe("Stabilise KPI board");
    expect(screen.getByTestId("action-created")).toHaveTextContent(
      "Open action",
    );
  });
});
