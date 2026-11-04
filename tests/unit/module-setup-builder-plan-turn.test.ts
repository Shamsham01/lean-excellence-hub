import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { planModuleSetupBuilderTurn } from "@/modules/module-setup/ai-builder/execute";
import type { ModuleSetupBuilderConversationState } from "@/modules/module-setup/ai-builder/types";
import { skillsSetupBuilderModule } from "@/modules/skills/ai-builder/module";

const baseConversation = (
  turns: ModuleSetupBuilderConversationState<unknown>["turns"],
): ModuleSetupBuilderConversationState<unknown> => ({
  sessionId: "session",
  turns,
  understanding: null,
  pendingQuestions: [],
  currentProposal: null,
  lastTurnInvalid: false,
  userTurnCount: turns.filter((turn) => turn.role === "user").length,
  latestMessageAt: "2026-11-04T12:00:00.000Z",
});

describe("planModuleSetupBuilderTurn retry semantics", () => {
  it("replays the failed request when retry uses the same message text", () => {
    const conversation = baseConversation([
      {
        id: "u1",
        role: "user",
        text: "SKILLS_ERROR_TEST",
        createdAt: "2026-11-04T12:00:00.000Z",
      },
      {
        id: "a1",
        role: "assistant",
        message: "Invalid proposal",
        createdAt: "2026-11-04T12:00:01.000Z",
        responseStatus: "ok",
        phase: "proposal",
        intent: "propose",
        focus: null,
        questions: [],
        changeSummary: [],
        proposalStatus: "invalid",
        proposalIssues: ["bad"],
        proposalRevision: null,
      },
    ]);

    const planned = planModuleSetupBuilderTurn(
      "retry",
      "SKILLS_ERROR_TEST",
      null,
      conversation,
      skillsSetupBuilderModule,
    );
    expect(planned).toMatchObject({
      intent: "propose",
      userRequest: "SKILLS_ERROR_TEST",
      retry: true,
    });
  });

  it("uses newly typed information as an answer instead of replaying retry", () => {
    const conversation = baseConversation([
      {
        id: "u1",
        role: "user",
        text: "Initial bakery description",
        createdAt: "2026-11-04T12:00:00.000Z",
      },
      {
        id: "a1",
        role: "assistant",
        message: "Question",
        createdAt: "2026-11-04T12:00:01.000Z",
        responseStatus: "ok",
        phase: "discovery",
        intent: "propose",
        focus: null,
        questions: [{ question: "Which line?", suggestedAnswers: ["Oven"] }],
        changeSummary: [],
        proposalStatus: "none",
        proposalIssues: [],
        proposalRevision: null,
      },
    ]);

    const planned = planModuleSetupBuilderTurn(
      "retry",
      "We run a deck oven and packing hall.",
      null,
      conversation,
      skillsSetupBuilderModule,
    );
    expect(planned).toMatchObject({
      intent: "answer",
      userRequest: "We run a deck oven and packing hall.",
      retry: false,
    });
  });

  it("blocks meaningless retry while discovery questions are waiting", () => {
    const conversation = baseConversation([
      {
        id: "u1",
        role: "user",
        text: "Describe bakery",
        createdAt: "2026-11-04T12:00:00.000Z",
      },
      {
        id: "a1",
        role: "assistant",
        message: "Need detail",
        createdAt: "2026-11-04T12:00:01.000Z",
        responseStatus: "ok",
        phase: "discovery",
        intent: "propose",
        focus: null,
        questions: [{ question: "Which line?", suggestedAnswers: ["Oven"] }],
        changeSummary: [],
        proposalStatus: "none",
        proposalIssues: [],
        proposalRevision: null,
      },
    ]);

    const planned = planModuleSetupBuilderTurn(
      "retry",
      "",
      null,
      conversation,
      skillsSetupBuilderModule,
    );
    expect(planned).toEqual({
      error:
        "LeanAI is waiting for your answers. Reply below or choose Generate draft proposal.",
    });
  });
});
