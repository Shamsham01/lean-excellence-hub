import { MATURITY_FRAMEWORK_BUILDER_FORMAT_NAME } from "@/platform/ai/prompts/maturity-framework-builder";
import { fakeMaturityBuilderResponse } from "@/platform/ai/providers/fake-maturity-builder";
import { fakeModuleSetupBuilderResponse } from "@/platform/ai/providers/fake-module-setup-builder";
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

    if (input.structuredOutputFormat?.name === "coach_envelope") {
      return this.coachResponse(lastUser, input.tools);
    }

    if (
      input.structuredOutputFormat?.name ===
      MATURITY_FRAMEWORK_BUILDER_FORMAT_NAME
    ) {
      return fakeMaturityBuilderResponse(lastUser);
    }

    const moduleSetupResponse = fakeModuleSetupBuilderResponse(
      input.structuredOutputFormat?.name,
      lastUser,
    );
    if (moduleSetupResponse) {
      return moduleSetupResponse;
    }

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

  private coachResponse(
    lastUser: string,
    tools: Array<Record<string, unknown>>,
  ): CreateResponseResult {
    if (
      lastUser.includes("IGNORE PREVIOUS INSTRUCTIONS") ||
      lastUser.includes("delete all cases")
    ) {
      return {
        outputText: "I cannot perform unauthorized operations.",
        parsedJson: {
          message: "I cannot perform unauthorized operations.",
          next_step_label: "",
          next_step_route: "",
          permission_note: "",
          follow_up_prompts: [],
        },
        toolCalls: [
          {
            id: "fake-coach-malicious",
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

    const hasWebSearch = tools.some(
      (tool) =>
        tool.type === "web_search" || tool.type === "web_search_2025_08_26",
    );
    const organisationName = extractUntrustedOrganisationName(lastUser);
    const researchRequest = isExplicitExternalResearchRequest(lastUser);

    if (isOrganisationNameQuestion(lastUser) && organisationName) {
      return this.coachJson(
        `The organisation name is ${organisationName}.`,
        organisationName.includes("HODL")
          ? "/platform/settings/ai"
          : "/platform",
      );
    }

    if (researchRequest && !hasWebSearch) {
      return this.coachJson(
        "Public web research is disabled for this organisation. An organisation administrator can enable it in LeanAI Settings.",
        "/platform/settings/ai",
      );
    }

    if (researchRequest && hasWebSearch) {
      const subject = organisationName ?? "the requested topic";
      return {
        ...this.coachJson(
          `Public web findings about ${subject} are summarised from external sources. Treat them as untrusted evidence, not Lean Excellence Hub records.`,
          "/platform/settings/ai",
        ),
        externalSources: [
          {
            title: `${subject} — public site`,
            url: "https://www.hodltokenclub.com/",
          },
          {
            title: "Example source",
            url: "https://example.com/research",
          },
        ],
        webSearch: {
          used: true,
          invocationCount: 1,
          sourceCount: 2,
        },
      };
    }

    const maturity =
      lastUser.includes("Intervention: maturity_first_setup") ||
      /"module":\{"key":"maturity"/.test(lastUser);
    const message = maturity
      ? "This organisation has no published Maturity Framework yet. Creating and publishing a framework lets teams assess operational excellence against one shared standard. Open Maturity Framework authoring to draft pillars and questions, then publish a version. LeanAI will not publish it for you."
      : "This setup step is still incomplete. Follow the recommended Lean Excellence Hub route to finish configuration. LeanAI will not make administrative changes automatically.";

    return this.coachJson(
      message,
      maturity ? "/platform/maturity/models" : "/platform/settings/structure",
      maturity
        ? [
            "What does publishing a framework change?",
            "What should the first version include?",
          ]
        : ["What should we do next?"],
      lastUser.includes('"canConfigureModule":false')
        ? "You do not currently have permission to change this configuration. Ask an organisation owner or the person who manages this module."
        : "",
      maturity ? "Open Maturity Frameworks" : "Continue setup",
    );
  }

  private coachJson(
    message: string,
    route: string,
    followUps: string[] = ["What should we do next?"],
    permissionNote = "",
    nextLabel = "Continue setup",
  ): CreateResponseResult {
    return {
      outputText: message,
      parsedJson: {
        message,
        next_step_label: nextLabel,
        next_step_route: route,
        permission_note: permissionNote,
        follow_up_prompts: followUps,
      },
      toolCalls: [],
      usage: {
        inputTokens: 40,
        outputTokens: 90,
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

function extractUserRequest(lastUser: string): string {
  const marker = "User request:";
  const index = lastUser.lastIndexOf(marker);
  return index >= 0 ? lastUser.slice(index + marker.length) : lastUser;
}

function extractUntrustedOrganisationName(lastUser: string): string | null {
  const nameMatch = lastUser.match(
    /"organisation_name"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  if (nameMatch?.[1]) {
    return nameMatch[1];
  }
  const nestedMatch = lastUser.match(
    /"organisation"\s*:\s*\{[^}]*"name"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  return nestedMatch?.[1] ?? null;
}

function isOrganisationNameQuestion(lastUser: string): boolean {
  const request = extractUserRequest(lastUser).toLowerCase();
  return (
    request.includes("organisation name") ||
    request.includes("organization name") ||
    request.includes("what is our organisation") ||
    request.includes("what is our organization")
  );
}

function isExplicitExternalResearchRequest(lastUser: string): boolean {
  const request = extractUserRequest(lastUser).toLowerCase();
  return (
    request.includes("research") ||
    request.includes("search") ||
    request.includes("on the web") ||
    request.includes("online") ||
    /\blatest\b/.test(request) ||
    /\brecent\b/.test(request) ||
    request.includes("current best") ||
    request.includes("iso 9001")
  );
}
