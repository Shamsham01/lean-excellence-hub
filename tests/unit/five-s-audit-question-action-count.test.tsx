import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiveSAuditWorkspace } from "@/components/five-s/audit-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/5s/actions", () => ({
  saveFiveSAuditAnswer: vi.fn().mockResolvedValue({ ok: true }),
  completeFiveSAudit: vi.fn(),
  initiateFiveSEvidenceUpload: vi.fn(),
  confirmFiveSEvidenceUpload: vi.fn(),
  linkFiveSEvidence: vi.fn(),
}));

vi.mock("@/components/actions/action-create-form", () => ({
  ActionCreateDialog: ({
    open,
    onActionPersisted,
  }: {
    open: boolean;
    onActionPersisted?: (id: string) => void;
  }) =>
    open ? (
      <button
        type="button"
        data-testid="mock-five-s-action-created"
        onClick={() => onActionPersisted?.("action-new")}
      >
        Mock create
      </button>
    ) : null,
}));

vi.mock("@/components/actions/action-detail-sheet", () => ({
  ActionDetailSheet: () => null,
}));

const QUESTION_A = "q-actions-a";
const QUESTION_B = "q-actions-b";

afterEach(() => {
  cleanup();
});

describe("FiveSAuditWorkspace question action counts", () => {
  it("shows the correct per-question count when navigating and after creating an action", async () => {
    render(
      <FiveSAuditWorkspace
        auditId="audit-1"
        status="in_progress"
        sections={[
          {
            id: "sort",
            title: "Sort",
            questions: [
              {
                id: QUESTION_A,
                prompt: "First question",
                question_type: "yes_no",
                is_required: true,
                allows_not_applicable: false,
                help_text: null,
              },
              {
                id: QUESTION_B,
                prompt: "Second question",
                question_type: "yes_no",
                is_required: true,
                allows_not_applicable: false,
                help_text: null,
              },
            ],
          },
        ]}
        answers={{}}
        evidence={[]}
        canEdit
        actionCountsByQuestion={{ [QUESTION_A]: 2, [QUESTION_B]: 0 }}
      />,
    );

    expect(
      screen.getByTestId("five-s-question-action-count"),
    ).toHaveTextContent("2 actions");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Second question" }),
      ).toBeVisible();
    });
    expect(
      screen.queryByTestId("five-s-question-action-count"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "First question" }),
      ).toBeVisible();
    });
    expect(
      screen.getByTestId("five-s-question-action-count"),
    ).toHaveTextContent("2 actions");

    fireEvent.click(screen.getByTestId("five-s-raise-action"));
    fireEvent.click(screen.getByTestId("mock-five-s-action-created"));
    expect(
      screen.getByTestId("five-s-question-action-count"),
    ).toHaveTextContent("3 actions");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Second question" }),
      ).toBeVisible();
    });
    expect(
      screen.queryByTestId("five-s-question-action-count"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => {
      expect(
        screen.getByTestId("five-s-question-action-count"),
      ).toHaveTextContent("3 actions");
    });
  });
});
