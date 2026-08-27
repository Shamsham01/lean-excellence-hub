import type {
  AIProvider,
  CreateResponseInput,
  CreateResponseResult,
  FacilitatorEnvelope,
} from "@/platform/ai/types";

export class FakeAIProvider implements AIProvider {
  readonly name = "fake";

  async healthCheck() {
    return { ok: true, provider: this.name };
  }

  async createResponse(
    input: CreateResponseInput,
  ): Promise<CreateResponseResult> {
    const lastUser =
      input.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

    if (
      lastUser.includes("IGNORE PREVIOUS INSTRUCTIONS") &&
      lastUser.includes("delete")
    ) {
      return {
        outputText: "I cannot perform unauthorized operations.",
        toolCalls: [
          {
            id: "fake-malicious",
            name: "get_hypotheses",
            arguments: {},
          },
        ],
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          cachedInputTokens: 0,
          reasoningTokens: 0,
        },
      };
    }

    if (lastUser.toLowerCase().includes("assumption")) {
      return {
        outputText:
          "The operator-rushing assumption is recorded separately from measured defect facts.",
        structuredOutput: {
          message:
            "The operator-rushing assumption is recorded separately from measured defect facts.",
          observations: [
            {
              text: "Measured defect rate is recorded as a measured fact.",
              support_level: "well_supported",
            },
            {
              text: "Operator rushing is recorded as an assumption, not verified fact.",
              support_level: "insufficient_evidence",
            },
          ],
          questions: [
            "What evidence supports or refutes the rushing assumption?",
          ],
          warnings: [],
          source_refs: [],
          proposals: [],
        },
        toolCalls: [
          {
            id: "fake-tool-1",
            name: "get_current_condition",
            arguments: {},
          },
        ],
        usage: {
          inputTokens: 50,
          outputTokens: 120,
          cachedInputTokens: 0,
          reasoningTokens: 0,
        },
      };
    }

    if (lastUser.toLowerCase().includes("propose hypothesis")) {
      return this.envelopeResponse(
        "A technical hypothesis remains unverified until tested.",
        {
          proposal_type: "hypothesis",
          payload: {
            statement:
              "Thermal expansion during hot-running shifts seal alignment.",
            category: "technical",
            rationale:
              "Defect rate rises after sustained hot runs in similar cases.",
          },
          explanation:
            "This is a testable technical hypothesis, not a verified root cause.",
        },
      );
    }

    if (lastUser.toLowerCase().includes("propose containment")) {
      return this.envelopeResponse(
        "Containment should isolate suspect product while testing continues.",
        {
          proposal_type: "containment",
          payload: {
            description:
              "Quarantine output from the last three hot-running batches.",
            rationale:
              "Prevents suspect product reaching customers while testing proceeds.",
          },
          explanation:
            "Short-term containment until hot-running hypothesis is tested.",
        },
      );
    }

    if (lastUser.toLowerCase().includes("propose invalid condition")) {
      return this.envelopeResponse(
        "This draft used an invalid current-condition category and was not offered for acceptance.",
        {
          proposal_type: "current_condition_item",
          payload: {
            category: "performance",
            statement:
              "Hot-running defect rate is 2.4x the cold-start baseline.",
          },
          explanation:
            "Invalid category should be filtered before persistence.",
        },
      );
    }

    if (lastUser.toLowerCase().includes("propose condition")) {
      return this.envelopeResponse(
        "A measured current-condition gap should be recorded explicitly.",
        {
          proposal_type: "current_condition_item",
          payload: {
            category: "measured_fact",
            statement:
              "Hot-running defect rate is 2.4x the cold-start baseline.",
          },
          explanation: "Records the measured gap separately from assumptions.",
        },
      );
    }

    if (lastUser.toLowerCase().includes("hypothesis test")) {
      return this.envelopeResponse(
        "Consider a controlled test under hot-running conditions.",
        {
          proposal_type: "hypothesis_test",
          payload: {
            hypothesis_id: "00000000-0000-4000-8000-000000000001",
            test_question:
              "Does defect rate increase under sustained hot-running conditions?",
            expected_result:
              "Higher ppm during hot runs than cold start baseline.",
            method: "Compare ppm across three consecutive hot runs.",
          },
          explanation:
            "A hot-running test would distinguish thermal drift from operator pacing.",
        },
      );
    }

    return {
      outputText:
        "I reviewed the authorised case context. What would you like to explore next?",
      structuredOutput: {
        message:
          "I reviewed the authorised case context. What would you like to explore next?",
        observations: [],
        questions: ["Which gap should we examine first?"],
        warnings: [],
        source_refs: [],
        proposals: [],
      },
      toolCalls: [
        {
          id: "fake-tool-overview",
          name: "get_problem_solving_case_overview",
          arguments: {},
        },
      ],
      usage: {
        inputTokens: 30,
        outputTokens: 60,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
    };
  }

  private envelopeResponse(
    message: string,
    proposal: FacilitatorEnvelope["proposals"][number],
  ): CreateResponseResult {
    return {
      outputText: message,
      structuredOutput: {
        message,
        observations: [],
        questions: [],
        warnings: [],
        source_refs: [],
        proposals: [proposal],
      },
      toolCalls: [],
      usage: {
        inputTokens: 40,
        outputTokens: 80,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
    };
  }
}
