import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { createProblemSolvingAction } from "@/app/(platform)/platform/problem-solving/actions";
import { CountermeasuresPanel } from "@/components/problem-solving/countermeasures-panel";
import type {
  ProblemSolvingCaseDetail,
  ProblemSolvingCountermeasure,
} from "@/lib/problem-solving/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(platform)/platform/problem-solving/actions", () => ({
  createProblemSolvingAction: vi.fn(),
}));
vi.mock("@/app/(platform)/platform/actions/actions", () => ({
  loadActionCreateContext: vi.fn().mockResolvedValue({
    assignablePeople: [{ membership_id: "member-1", display_name: "Sam" }],
  }),
}));

const countermeasure = {
  id: "cm-1",
  title: "Adjust the seal guide",
  status: "selected",
  description: null,
  cause_links: [
    {
      id: "link-1",
      hypothesis_id: "cause-1",
      hypothesis_statement: "Seal guide misalignment",
    },
  ],
} as ProblemSolvingCountermeasure;

const second = {
  ...countermeasure,
  id: "cm-2",
  title: "Check guide alignment",
};
const detail = {
  countermeasures: [countermeasure, second],
  actions: [],
  hypotheses: [],
} as unknown as ProblemSolvingCaseDetail;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("shows an existing linked action and disables Raise action for the same cause", () => {
  render(
    <CountermeasuresPanel
      caseId="case-1"
      detail={{
        ...detail,
        actions: [
          {
            id: "action-1",
            title: "Adjust the seal guide",
            expected_result: "Defects fall below 2%",
            countermeasure_id: "cm-1",
            status: "open",
          } as ProblemSolvingCaseDetail["actions"][number],
        ],
      }}
      canContribute
      canManage
    />,
  );

  for (const id of ["cm-1", "cm-2"]) {
    expect(
      screen.getByTestId(`link-countermeasure-action-${id}`),
    ).toBeDisabled();
    expect(
      screen.getByTestId(`countermeasure-linked-action-${id}`),
    ).toHaveAttribute("href", "/platform/actions/action-1");
  }
});

it("saves the expected result separately and prevents a second action while pending or awaiting refresh", async () => {
  let finish!: (result: { id: string }) => void;
  vi.mocked(createProblemSolvingAction).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(
    <CountermeasuresPanel
      caseId="case-1"
      detail={detail}
      defaultAssigneeMembershipId="member-1"
      canContribute
      canManage
    />,
  );
  fireEvent.click(screen.getByTestId("link-countermeasure-action-cm-1"));
  fireEvent.change(
    within(screen.getByRole("dialog")).getByLabelText("Description"),
    {
      target: { value: "Center the guide" },
    },
  );
  fireEvent.change(screen.getByLabelText("Expected result"), {
    target: { value: " Defects fall below 2% " },
  });
  fireEvent.change(screen.getByLabelText("Due date"), {
    target: { value: "2026-12-01" },
  });

  const submit = screen.getByTestId("pps-action-create-submit");
  const form = submit.closest("form")!;
  fireEvent.submit(form);
  expect(submit).toBeDisabled();
  fireEvent.submit(form);
  expect(createProblemSolvingAction).toHaveBeenCalledTimes(1);
  expect(createProblemSolvingAction).toHaveBeenCalledWith(
    expect.objectContaining({
      countermeasureId: "cm-1",
      description: "Center the guide",
      expectedResult: "Defects fall below 2%",
    }),
  );

  finish({ id: "action-2" });
  await waitFor(() =>
    expect(
      screen.getByTestId("link-countermeasure-action-cm-2"),
    ).toBeDisabled(),
  );
  expect(
    screen.getByTestId("countermeasure-linked-action-cm-1"),
  ).toHaveAttribute("href", "/platform/actions/action-2");
});
