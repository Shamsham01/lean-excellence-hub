import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  invokeProblemSolvingTurnAction: vi.fn(),
  shouldRetainProblemSolvingTurnKey: () => false,
}));

describe("StageAutoDraftTrigger on closed cases", () => {
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

    const button = screen.getByTestId("pps-stage-auto-draft-button");
    expect(button).toBeDisabled();
    expect(screen.getByText(/closed or cancelled/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(draftMock).not.toHaveBeenCalled();
    });
  });
});
