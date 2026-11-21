import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const draftMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/problem-solving/ai/actions", () => ({
  draftProblemSolvingStage: (...args: unknown[]) => draftMock(...args),
  reconcileProblemSolvingStageDraft: vi.fn(),
}));

vi.mock("@/lib/problem-solving/problem-solving-ai-turn-client", () => ({
  invokeProblemSolvingTurnAction: ({ invoke }: { invoke: () => unknown }) =>
    invoke(),
  shouldRetainProblemSolvingTurnKey: () => false,
}));

describe("StageAutoDraftTrigger", () => {
  afterEach(() => {
    cleanup();
    draftMock.mockReset();
    window.sessionStorage.clear();
  });

  it("does not auto-run or enable manual draft when the case is closed", async () => {
    const { StageAutoDraftTrigger } =
      await import("@/components/problem-solving/guided/stage-auto-draft-trigger");

    render(
      <StageAutoDraftTrigger
        caseId="case-closed"
        stageKey="ROOT_CAUSE_ANALYSIS"
        autoDraftPrompt="Draft RCA"
        canUseAi
        providerAvailable
        hasProblemData
        caseStatus="closed"
      />,
    );

    expect(
      screen.queryByTestId("pps-stage-auto-draft"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("pps-stage-auto-draft-button"),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(draftMock).not.toHaveBeenCalled();
    });
  });

  it("tries auto-drafting once per case and stage even when the first attempt fails", async () => {
    const { StageAutoDraftTrigger } =
      await import("@/components/problem-solving/guided/stage-auto-draft-trigger");
    draftMock.mockResolvedValue({ error: "Timed out" });
    const stage = (
      <StageAutoDraftTrigger
        caseId="case-1"
        stageKey="ROOT_CAUSE_ANALYSIS"
        autoDraftPrompt="Draft RCA"
        canUseAi
        providerAvailable
        hasProblemData
      />
    );
    const first = render(stage);
    expect(await screen.findByRole("alert")).toHaveTextContent("Timed out");
    first.unmount();

    render(stage);
    const button = screen.getByTestId("pps-stage-auto-draft-button");
    expect(button).toHaveTextContent("Draft this stage");
    expect(draftMock).toHaveBeenCalledTimes(1);

    draftMock.mockResolvedValue({ data: { pendingProposalCount: 3 } });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(draftMock).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByTestId("pps-stage-auto-draft-status"),
    ).not.toBeInTheDocument();
  });
});
