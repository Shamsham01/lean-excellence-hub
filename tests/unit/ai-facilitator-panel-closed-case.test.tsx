import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/problem-solving/ai/actions", () => ({
  createProblemSolvingAiSession: vi.fn(),
  sendProblemSolvingAiMessage: vi.fn(),
  reconcileProblemSolvingAiTurn: vi.fn(),
}));

vi.mock("@/lib/problem-solving/problem-solving-ai-turn-client", () => ({
  invokeProblemSolvingTurnAction: vi.fn(),
}));

describe("AiFacilitatorPanel on closed cases", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("disables the composer when the case is closed or cancelled", async () => {
    const { AiFacilitatorPanel } =
      await import("@/components/problem-solving/ai/ai-facilitator-panel");

    render(
      <AiFacilitatorPanel
        caseId="case-closed"
        caseTitle="Seal defects"
        caseStatus="closed"
        canUseAi
        caseDraftingEnabled={false}
        providerAvailable
        pendingProposals={[]}
        onPendingProposalsChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/closed or cancelled.*Lean AI is not available/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("lean-ai-input")).toBeDisabled();
    expect(screen.getByTestId("lean-ai-send")).toBeDisabled();
  });
});
