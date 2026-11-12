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
      assignablePeople: [],
      canManageLabels: false,
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

    fireEvent.click(screen.getByTestId("actions-create-submit"));

    await waitFor(() => {
      expect(createFiveSAction).toHaveBeenCalledTimes(1);
    });

    expect(createFiveSAction).toHaveBeenCalledWith({
      auditId: "audit-1",
      sectionId: "section-sort",
      questionId: "question-visibility",
      title: linkContext.defaultTitle,
      description: "",
      dueAt: null,
      assigneeMembershipId: null,
      labelIds: [],
      checklistTitles: [],
    });
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
