import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { loadActionCreateContext } from "@/app/(platform)/platform/actions/actions";
import { createProblemSolvingAction } from "@/app/(platform)/platform/problem-solving/actions";
import { linkActionToCiProject } from "@/app/(platform)/platform/projects/linking-actions";
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
vi.mock("@/app/(platform)/platform/projects/linking-actions", () => ({
  linkActionToCiProject: vi.fn(),
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

it("retries linking a Draft project and immediately shows the created countermeasure action", async () => {
  vi.mocked(loadActionCreateContext).mockResolvedValueOnce({
    labels: [],
    assignablePeople: [],
    canManageLabels: true,
    canAssign: true,
    currentMembershipId: null,
    projectPicker: {
      requiresSiteSelection: false,
      projects: [
        {
          id: "draft-project",
          project_number: "PRJ-1",
          title: "Draft project",
          status: "draft",
          unit_id: "site-1",
        },
      ],
    },
  });
  vi.mocked(createProblemSolvingAction).mockResolvedValueOnce({
    id: "action-3",
  });
  vi.mocked(linkActionToCiProject)
    .mockResolvedValueOnce({ error: "Please retry." })
    .mockResolvedValueOnce({});

  render(
    <CountermeasuresPanel
      caseId="case-1"
      siteUnitId="site-1"
      detail={detail}
      defaultAssigneeMembershipId="member-1"
      canContribute
      canManage
    />,
  );
  fireEvent.click(screen.getByTestId("link-countermeasure-action-cm-1"));
  const expectedResult = screen.getByLabelText("Expected result");
  expect(expectedResult).toHaveAttribute("maxlength", "2000");
  fireEvent.change(expectedResult, {
    target: { value: " Defects fall below 2% " },
  });
  fireEvent.change(screen.getByLabelText("Due date"), {
    target: { value: "2026-12-01" },
  });
  fireEvent.click(
    await screen.findByRole("combobox", { name: "CI project (optional)" }),
  );
  fireEvent.click(screen.getByRole("option", { name: /PRJ-1/ }));
  const submit = screen.getByTestId("pps-action-create-submit");
  const form = submit.closest("form")!;
  fireEvent.submit(form);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Action created\. Please retry\..*submit again/,
  );
  expect(expectedResult).toBeDisabled();
  expect(submit).toHaveTextContent("Finish setup");
  fireEvent.submit(form);

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(createProblemSolvingAction).toHaveBeenCalledTimes(1);
  expect(linkActionToCiProject).toHaveBeenCalledTimes(2);
  expect(linkActionToCiProject).toHaveBeenNthCalledWith(
    1,
    "action-3",
    "draft-project",
  );
  expect(linkActionToCiProject).toHaveBeenNthCalledWith(
    2,
    "action-3",
    "draft-project",
  );
  expect(loadActionCreateContext).toHaveBeenCalledWith({
    siteUnitId: "site-1",
  });
  expect(screen.getByTestId("link-countermeasure-action-cm-1")).toBeDisabled();
  expect(
    screen.getByTestId("countermeasure-linked-action-cm-1"),
  ).toHaveAttribute("href", "/platform/actions/action-3");
  expect(
    screen.getAllByText("Expected result: Defects fall below 2%"),
  ).toHaveLength(2);
});
