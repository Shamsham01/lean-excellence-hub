import { describe, expect, it } from "vitest";

import { deriveModuleSetupBuilderConversation } from "@/modules/module-setup/ai-builder/conversation";
import {
  MODULE_SETUP_MAX_DISCOVERY_QUESTIONS,
  normalizeModuleSetupDiscoveryQuestions,
} from "@/modules/module-setup/ai-builder/discovery-questions";
import { revalidateStoredSkillsProposal } from "@/modules/skills/ai-builder/proposal";
import { parseSkillsBuilderEnvelope } from "@/modules/skills/ai-builder/proposal";

describe("module setup discovery questions", () => {
  it("normalises provider output to three questions at most", () => {
    const normalised = normalizeModuleSetupDiscoveryQuestions([
      { question: "One", suggestedAnswers: ["A"] },
      { question: "Two", suggestedAnswers: ["B"] },
      { question: "Three", suggestedAnswers: ["C"] },
      { question: "Four", suggestedAnswers: ["D"] },
    ]);
    expect(normalised).toHaveLength(MODULE_SETUP_MAX_DISCOVERY_QUESTIONS);
    expect(normalised.map((item) => item.question)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("reads historical assistant payloads that stored four questions", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const messageId = "22222222-2222-4222-8222-222222222222";
    const detail = {
      session: {
        id: sessionId,
        context_type: "coach",
        module_key: "skills",
        intervention_key: "setup_builder",
        problem_solving_case_id: null,
        status: "active",
      },
      messages: [
        {
          id: messageId,
          role: "assistant",
          content: "Need a little more detail.",
          created_at: "2026-11-04T12:00:00.000Z",
          structured_payload: {
            kind: "skills_setup_builder",
            version: 1,
            response_status: "ok",
            phase: "discovery",
            intent: "propose",
            focus: null,
            understanding: { operation: "Bakery" },
            questions: [
              { question: "Q1", suggestedAnswers: ["A"] },
              { question: "Q2", suggestedAnswers: ["B"] },
              { question: "Q3", suggestedAnswers: ["C"] },
              { question: "Q4", suggestedAnswers: ["D"] },
            ],
            change_summary: [],
            proposal_status: "none",
            proposal: null,
            proposal_issues: [],
          },
        },
      ],
    };

    const state = deriveModuleSetupBuilderConversation(
      detail,
      {
        sessionId,
        conversationStartedAt: null,
        moduleKey: "skills",
        interventionKey: "setup_builder",
        payloadKind: "skills_setup_builder",
      },
      revalidateStoredSkillsProposal,
      () => ({ sections: 0, items: 0 }),
    );

    expect(state?.pendingQuestions).toHaveLength(3);
    expect(state?.turns).toHaveLength(1);
    expect(state?.turns[0]?.role).toBe("assistant");
  });

  it("parses Skills envelopes with more than three discovery questions", () => {
    const parsed = parseSkillsBuilderEnvelope({
      message: "Need more detail.",
      phase: "discovery",
      understanding: {
        operation: "Bakery",
        scale: null,
        roles: null,
        evidence: null,
        applicability: null,
      },
      questions: [
        { question: "Q1", suggested_answers: ["A"] },
        { question: "Q2", suggested_answers: ["B"] },
        { question: "Q3", suggested_answers: ["C"] },
        { question: "Q4", suggested_answers: ["D"] },
      ],
      change_summary: [],
      proposal: null,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.questions).toHaveLength(3);
      expect(parsed.envelope.proposalStatus).toBe("none");
    }
  });
});
