import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ActionDetail } from "@/lib/actions/types";

const { save, transition } = vi.hoisted(() => ({
  save: vi.fn(),
  transition: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(platform)/platform/actions/actions", () => ({
  updateActionFields: save,
  transitionActionStatus: transition,
  completeAction: vi.fn(),
  reopenAction: vi.fn(),
  setActionAssignee: vi.fn(),
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
});
