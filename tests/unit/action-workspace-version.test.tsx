import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ActionDetail } from "@/lib/actions/types";

const { save, transition, assign } = vi.hoisted(() => ({
  save: vi.fn(),
  transition: vi.fn(),
  assign: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(platform)/platform/actions/actions", () => ({
  updateActionFields: save,
  transitionActionStatus: transition,
  completeAction: vi.fn(),
  reopenAction: vi.fn(),
  setActionAssignee: assign,
}));
vi.mock("@/components/actions/action-planner-labels-field", () => ({
  ActionPlannerLabelsField: () => null,
}));
vi.mock("@/components/actions/action-planner-checklist", () => ({
  ActionPlannerChecklist: () => null,
}));
vi.mock("@/components/actions/action-planner-attachments", () => ({
  ActionPlannerAttachments: () => null,
}));
vi.mock("@/components/actions/action-planner-comments", () => ({
  ActionPlannerComments: () => null,
}));
import { ActionWorkspace } from "@/components/actions/action-workspace";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("uses the refreshed version when starting after a field save", async () => {
  save.mockResolvedValue({ ok: true });
  transition.mockResolvedValue({ ok: true });
  const detail: ActionDetail = {
    id: "a",
    action_number: "A-1",
    title: "Old",
    description: "Adjust the seal guide.",
    expected_result: "Seal defects fall below 2%.",
    status: "open",
    priority: "medium",
    due_at: null,
    completed_at: null,
    verified_at: null,
    unit_id: "line",
    unit_name: "Line",
    site_unit_id: "site",
    source_resource_id: null,
    source: null,
    created_by_membership_id: "m",
    created_by_display_name: "Sam",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    version: 1,
    assignees: [],
    status_history: [],
    permissions: {
      can_update: true,
      can_assign: false,
      can_complete: false,
      can_start: true,
      can_reopen: false,
      can_cancel: false,
    },
  };
  const props = {
    detail,
    comments: [],
    evidence: [],
    assignablePeople: [],
    canUploadEvidence: false,
  };
  const view = render(<ActionWorkspace {...props} />);
  expect(
    screen.getByRole("heading", { name: "Expected result" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Seal defects fall below 2%.")).toBeInTheDocument();
  fireEvent.change(screen.getByTestId("action-title-input"), {
    target: { value: "New" },
  });
  fireEvent.submit(screen.getByTestId("action-edit-form"));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 1 }),
    ),
  );
  await waitFor(() =>
    expect(screen.getByTestId("action-start-button")).not.toBeDisabled(),
  );
  view.rerender(
    <ActionWorkspace
      {...props}
      detail={{ ...detail, title: "New", version: 2 }}
    />,
  );
  fireEvent.click(screen.getByTestId("action-start-button"));
  await waitFor(() =>
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 2 }),
    ),
  );
  const historyTab = screen.getByRole("tab", { name: "History" });
  fireEvent.mouseDown(historyTab);
  fireEvent.click(historyTab);
  expect(screen.getByTestId("action-history")).toHaveTextContent(/In progress/);
});

it("keeps local v3 through stale and equal refreshes, then adopts server v4", async () => {
  assign.mockResolvedValue({ ok: true });
  transition.mockResolvedValue({ ok: true });
  const detail: ActionDetail = {
    id: "a",
    action_number: "A-1",
    title: "Old",
    description: null,
    status: "open",
    priority: "medium",
    due_at: null,
    completed_at: null,
    verified_at: null,
    unit_id: "line",
    unit_name: "Line",
    site_unit_id: "site",
    source_resource_id: null,
    source: null,
    created_by_membership_id: "m",
    created_by_display_name: "Sam",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    version: 1,
    assignees: [],
    status_history: [],
    permissions: {
      can_update: true,
      can_assign: true,
      can_complete: false,
      can_start: true,
      can_reopen: false,
      can_cancel: true,
    },
  };
  const props = {
    detail,
    comments: [],
    evidence: [],
    assignablePeople: [
      {
        membership_id: "m2",
        display_name: "Alex",
        avatar_url: null,
      },
    ],
    canUploadEvidence: false,
  };
  const view = render(<ActionWorkspace {...props} />);
  fireEvent.change(screen.getByTestId("action-assignee-input"), {
    target: { value: "m2" },
  });
  fireEvent.submit(screen.getByTestId("action-assign-form"));
  await waitFor(() =>
    expect(assign).toHaveBeenCalledWith({
      actionId: "a",
      membershipId: "m2",
    }),
  );
  view.rerender(
    <ActionWorkspace
      {...props}
      detail={{ ...detail, status_history: [...detail.status_history] }}
    />,
  );
  fireEvent.click(screen.getByTestId("action-start-button"));
  await waitFor(() =>
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 2 }),
    ),
  );
  await waitFor(() =>
    expect(screen.getByTestId("action-status")).toHaveTextContent(
      "In progress",
    ),
  );
  fireEvent.change(screen.getByTestId("action-title-input"), {
    target: { value: "Unsaved title" },
  });

  const historyTab = screen.getByRole("tab", { name: "History" });
  fireEvent.mouseDown(historyTab);
  fireEvent.click(historyTab);
  for (const version of [2, 3]) {
    view.rerender(
      <ActionWorkspace {...props} detail={{ ...detail, version }} />,
    );
    expect(screen.getByTestId("action-status")).toHaveTextContent(
      "In progress",
    );
    expect(screen.queryByTestId("action-start-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("action-history")).toHaveTextContent(
      /Open → In progress/,
    );
  }

  const overviewTab = screen.getByRole("tab", { name: "Overview" });
  fireEvent.mouseDown(overviewTab);
  fireEvent.click(overviewTab);
  expect(screen.getByTestId("action-title-input")).toHaveValue("Unsaved title");

  transition.mockResolvedValueOnce({ error: "Refresh required" });
  fireEvent.click(screen.getByTestId("action-cancel-button"));
  expect(transition).toHaveBeenLastCalledWith({
    actionId: "a",
    toStatus: "cancelled",
    expectedVersion: 3,
  });
  await screen.findByRole("alert");

  view.rerender(
    <ActionWorkspace
      {...props}
      detail={{
        ...detail,
        version: 4,
        status: "open",
        title: "Server title",
        description: "Server description",
        status_history: [
          {
            id: "server-entry",
            from_status: "in_progress",
            to_status: "open",
            reason: null,
            created_at: detail.created_at,
            actor_membership_id: "m",
            actor_display_name: "Sam",
          },
        ],
      }}
    />,
  );
  expect(screen.getByTestId("action-status")).toHaveTextContent("Open");
  expect(screen.getByTestId("action-title-input")).toHaveValue("Unsaved title");
  expect(screen.getByTestId("action-description-input")).toHaveValue(
    "Server description",
  );

  fireEvent.mouseDown(historyTab);
  fireEvent.click(historyTab);
  expect(screen.getByTestId("action-history")).toHaveTextContent(
    /In progress → Open/,
  );

  fireEvent.click(screen.getByTestId("action-start-button"));
  expect(transition).toHaveBeenLastCalledWith({
    actionId: "a",
    toStatus: "in_progress",
    expectedVersion: 4,
  });
  await waitFor(() =>
    expect(screen.getByTestId("action-status")).toHaveTextContent(
      "In progress",
    ),
  );
});
