import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ActionTaskListRow } from "@/components/actions/action-task-list-row";
import type { ActionPlannerListItem } from "@/lib/actions/planner-types";
import { usePlannerTransitions } from "@/lib/actions/use-planner-transitions";

const action: ActionPlannerListItem = {
  id: "a",
  action_number: "A-1",
  title: "Fix seal",
  status: "open",
  priority: "normal",
  created_at: "2026-01-01",
  due_at: null,
  version: 1,
  assignee_display_name: null,
  assignee_membership_id: null,
  assignee_avatar_url: null,
  source: null,
  permissions: {
    can_update: true,
    can_assign: false,
    can_complete: true,
    can_start: true,
    can_reopen: true,
    can_cancel: true,
  },
  labels: [],
  checklist_done: 0,
  checklist_total: 0,
  comment_count: 0,
  card_cover_mime_type: null,
  card_cover_storage_path: null,
};

function Harness() {
  const { actions, pendingIds, error, onTransition } = usePlannerTransitions([
    action,
  ]);
  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      <ActionTaskListRow
        action={actions[0]!}
        onOpen={() => {}}
        onTransition={onTransition}
        pending={pendingIds.has(action.id)}
      />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("checks immediately, disables until confirmed and reopens using the new version", async () => {
  let resolve!: (response: Response) => void;
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  render(<Harness />);
  const checkbox = screen.getByRole("checkbox");
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  expect(checkbox).toBeDisabled();
  resolve(Response.json({ ok: true }));
  await waitFor(() => expect(checkbox).not.toBeDisabled());
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();
  await waitFor(() => expect(checkbox).not.toBeDisabled());
  expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toMatchObject({
    expectedVersion: 2,
    toStatus: "open",
  });
});

it("rolls back an optimistic check and shows the server error", async () => {
  let resolve!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    ),
  );
  render(<Harness />);
  const checkbox = screen.getByRole("checkbox");
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  expect(checkbox).toBeDisabled();
  resolve(Response.json({ error: "Action changed." }, { status: 409 }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Action changed.");
  expect(checkbox).not.toBeChecked();
  expect(checkbox).not.toBeDisabled();
});
