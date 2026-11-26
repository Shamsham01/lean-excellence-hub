import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ActionPlannerBoard } from "@/components/actions/action-planner-board";
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

function Harness({ initial = action }: { initial?: ActionPlannerListItem }) {
  const { actions, pendingIds, error, onTransition } = usePlannerTransitions([
    initial,
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

it("rolls back a failed reopen and keeps the completed version", async () => {
  let resolve!: (response: Response) => void;
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<Harness initial={{ ...action, status: "completed", version: 4 }} />);
  const checkbox = screen.getByRole("checkbox");
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();
  expect(checkbox).toBeDisabled();
  resolve(Response.json({ error: "Unable to reopen." }, { status: 400 }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to reopen.");
  expect(checkbox).toBeChecked();
  expect(checkbox).not.toBeDisabled();
  fireEvent.click(checkbox);
  expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toMatchObject({
    expectedVersion: 4,
    toStatus: "open",
  });
});

function BoardHarness() {
  const { actions, pendingIds, error, onTransition } = usePlannerTransitions([
    action,
  ]);
  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      <ActionPlannerBoard
        actions={actions}
        onOpen={() => {}}
        onTransition={onTransition}
        pendingIds={pendingIds}
      />
    </>
  );
}

it("moves a board card before the server replies and restores it on error", async () => {
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
  render(<BoardHarness />);
  const open = screen.getByTestId("actions-board-column-open");
  const completed = screen.getByTestId("actions-board-column-completed");
  fireEvent.dragStart(within(open).getByTestId("action-planner-card-a"));
  fireEvent.drop(completed);
  expect(within(completed).getByTestId("action-planner-card-a")).toHaveAttribute(
    "draggable",
    "false",
  );
  resolve(Response.json({ error: "Unable to complete." }, { status: 400 }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to complete.",
  );
  expect(within(open).getByTestId("action-planner-card-a")).toHaveAttribute(
    "draggable",
    "true",
  );
});
