import type {
  AIProvider,
  CreateResponseInput,
  CreateResponseResult,
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

    if (lastUser.toLowerCase().includes("hypothesis test")) {
      return {
        outputText: "Consider a controlled test under hot-running conditions.",
        structuredOutput: {
          message: "Consider a controlled test under hot-running conditions.",
          observations: [],
          questions: [],
          warnings: [],
          source_refs: [],
          proposals: [
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
          ],
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
}
