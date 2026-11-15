import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionCreateDialog } from "@/components/actions/action-create-form";
import {
  buildActionListQuery,
  parseActionListFilters,
} from "@/lib/actions/action-filters";
import {
  createFiveSPlannerAction,
  loadActionCreateContext,
} from "@/app/(platform)/platform/actions/actions";

vi.mock("@/app/(platform)/platform/actions/actions", () => ({
  loadActionCreateContext: vi.fn(),
  createPlannerAction: vi.fn(),
  createFiveSPlannerAction: vi.fn(),
}));

const createFiveSAction = vi.mocked(createFiveSPlannerAction);

const linkContext = {
  auditId: "audit-1",
  sectionId: "section-sort",
  questionId: "question-visibility",
  defaultTitle: "How visible are the expected workplace standards?",
};

describe("5S audit raise action", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(loadActionCreateContext).mockResolvedValue({
      labels: [],
      assignablePeople: [
        {
          membership_id: "member-1",
          display_name: "Audit lead",
          avatar_url: null,
        },
      ],
      canManageLabels: false,
      canAssign: true,
      currentMembershipId: "member-1",
    });
    createFiveSAction.mockReset();
    createFiveSAction.mockResolvedValue({ ok: true, id: "action-42" });
  });

  it("prefills the title and links the audit and question on create", async () => {
    render(
      <ActionCreateDialog
        open
        onOpenChange={vi.fn()}
        fiveSLinkContext={linkContext}
        onCreated={vi.fn()}
      />,
    );

    const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
    expect(titleInput.value).toBe(linkContext.defaultTitle);

    await waitFor(() => {
      expect(screen.getByTestId("action-create-assignee")).toHaveValue(
        "member-1",
      );
    });

    fireEvent.change(screen.getByTestId("action-create-due"), {
      target: { value: "2026-12-01" },
    });
    fireEvent.change(screen.getByTestId("action-create-assignee"), {
      target: { value: "member-1" },
    });

    fireEvent.click(screen.getByTestId("actions-create-submit"));

    await waitFor(() => {
      expect(createFiveSAction).toHaveBeenCalledTimes(1);
    });

    expect(createFiveSAction).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: "audit-1",
        sectionId: "section-sort",
        questionId: "question-visibility",
        title: linkContext.defaultTitle,
        description: "",
        dueAt: new Date("2026-12-01T12:00:00").toISOString(),
        assigneeMembershipId: "member-1",
        idempotencyKey: expect.any(String),
        labelIds: [],
        checklistTitles: [],
      }),
    );
  });

  it("blocks submit without assignee and due date from audit", async () => {
    vi.mocked(loadActionCreateContext).mockResolvedValueOnce({
      labels: [],
      assignablePeople: [],
      canManageLabels: false,
      canAssign: true,
      currentMembershipId: null,
    });

    render(
      <ActionCreateDialog
        open
        onOpenChange={vi.fn()}
        fiveSLinkContext={linkContext}
        onCreated={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("action-create-assignee")).toBeDisabled(),
    );

    fireEvent.submit(screen.getByTestId("actions-create-form"));

    await waitFor(() => {
      expect(screen.getByText("Assignee is required.")).toBeInTheDocument();
    });
    expect(createFiveSAction).not.toHaveBeenCalled();
  });
});

describe("5S audit action filters", () => {
  it("parses audit id from search params and builds shareable query strings", () => {
    expect(
      parseActionListFilters({
        source: "five_s_audit",
        audit: "audit-77",
      }),
    ).toEqual({
      source: "five_s_audit",
      status: null,
      assignee: null,
      unit: null,
      assessment: null,
      pillar: null,
      criterion: null,
      audit: "audit-77",
    });

    expect(
      buildActionListQuery({
        source: "five_s_audit",
        status: null,
        assignee: null,
        unit: null,
        assessment: null,
        pillar: null,
        criterion: null,
        audit: "audit-77",
      }),
    ).toBe("source=five_s_audit&audit=audit-77");
  });
});
