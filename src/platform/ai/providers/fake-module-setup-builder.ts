import {
  contextMarkers,
  extractModuleSetupBuilderContext,
  type ModuleSetupBuilderContext,
} from "@/modules/module-setup/ai-builder/context";
import { FIVE_S_BUILDER_CONTEXT_CONTRACT } from "@/modules/5s/ai-builder/types";
import { GEMBA_BUILDER_CONTEXT_CONTRACT } from "@/modules/gemba/ai-builder/types";
import { FIVE_S_SETUP_BUILDER_FORMAT_NAME } from "@/platform/ai/prompts/five-s-setup-builder";
import { GEMBA_SETUP_BUILDER_FORMAT_NAME } from "@/platform/ai/prompts/gemba-setup-builder";
import type { CreateResponseResult } from "@/platform/ai/types";

const USAGE = {
  inputTokens: 180,
  outputTokens: 320,
  cachedInputTokens: 0,
  reasoningTokens: 0,
};

export function fakeModuleSetupBuilderResponse(
  formatName: string | undefined,
  lastUser: string,
): CreateResponseResult | null {
  if (
    formatName !== FIVE_S_SETUP_BUILDER_FORMAT_NAME &&
    formatName !== GEMBA_SETUP_BUILDER_FORMAT_NAME
  ) {
    return null;
  }

  const contract =
    formatName === FIVE_S_SETUP_BUILDER_FORMAT_NAME
      ? FIVE_S_BUILDER_CONTEXT_CONTRACT
      : GEMBA_BUILDER_CONTEXT_CONTRACT;
  const markers = contextMarkers(contract);
  const context = extractModuleSetupBuilderContext(
    lastUser,
    markers.start,
    markers.end,
  );
  const request = extractRequest(lastUser);

  if (request.includes("BROKEN_ENVELOPE_TEST")) {
    return {
      outputText: "Unstructured reply",
      parsedJson: { message: "Unstructured reply", phase: "proposal" },
      toolCalls: [],
      usage: USAGE,
    };
  }

  if (request.includes("TOOL_REQUEST_TEST")) {
    return {
      outputText: "",
      toolCalls: [
        { id: "fake-setup-tool", name: "publish_configuration", arguments: {} },
      ],
      usage: USAGE,
    };
  }

  const envelope =
    formatName === FIVE_S_SETUP_BUILDER_FORMAT_NAME
      ? fiveSEnvelope(context, request)
      : gembaEnvelope(context, request);

  return {
    outputText: envelope.message,
    parsedJson: envelope,
    toolCalls: [],
    usage: USAGE,
  };
}

function extractRequest(lastUser: string): string {
  const marker = "User request:\n";
  const index = lastUser.lastIndexOf(marker);
  return (index >= 0 ? lastUser.slice(index + marker.length) : lastUser).trim();
}

function emptyFiveSUnderstanding() {
  return {
    environment: null,
    purpose: null,
    audit_style: null,
    depth: null,
    evidence: null,
    scoring: null,
    terminology: null,
  };
}

function emptyGembaUnderstanding() {
  return {
    purpose: null,
    environment: null,
    focus: null,
    audience: null,
    depth: null,
    terminology: null,
  };
}

function fiveSEnvelope(
  context: ModuleSetupBuilderContext | null,
  request: string,
) {
  const intent = context?.request.intent ?? "answer";
  const current = context?.current_proposal as
    | {
        name: string;
        description: string;
        thresholdPercent: number;
        categories: Array<{
          name: string;
          description: string | null;
          questions: Array<{
            prompt: string;
            questionType: string;
            guidance: string | null;
          }>;
        }>;
      }
    | null
    | undefined;

  if (request.includes("MALFORMED_PROPOSAL_TEST")) {
    return {
      message: "Here is a proposal that cannot be saved.",
      phase: "proposal",
      understanding: emptyFiveSUnderstanding(),
      questions: [],
      change_summary: [],
      proposal: {
        name: "Incomplete standard",
        description: "Missing questions.",
        threshold_percent: 80,
        categories: [{ name: "Sort", description: null, questions: [] }],
      },
    };
  }

  const shouldPropose =
    intent === "propose" || intent === "refine" || /propos/i.test(request);

  if (!shouldPropose) {
    return {
      message:
        "I can draft a 5S standard in your own terms. What should it help the team notice?",
      phase: "discovery",
      understanding: {
        ...emptyFiveSUnderstanding(),
        purpose: request.slice(0, 180) || null,
      },
      questions: [
        {
          question: "What kind of workplace is this standard for?",
          suggested_answers: ["Packing", "Warehouse", "Production line"],
        },
      ],
      change_summary: [],
      proposal: null,
    };
  }

  const base = current
    ? {
        name: current.name,
        description: current.description,
        threshold_percent: current.thresholdPercent,
        categories: current.categories.map((category) => ({
          name: category.name,
          description: category.description,
          questions: category.questions.map((question) => ({
            prompt: question.prompt,
            question_type: question.questionType,
            guidance: question.guidance,
          })),
        })),
      }
    : {
        name: "Packing 5S Standard",
        description:
          "A short workplace standard for noticing whether the packing area is sorted, ordered and sustained.",
        threshold_percent: 80,
        categories: [
          {
            name: "Sort",
            description: "Keep only what today's work needs.",
            questions: [
              {
                prompt: "Are unused items removed from the packing area?",
                question_type: "yes_no",
                guidance: null,
              },
              {
                prompt: "What is still here that the team does not need today?",
                question_type: "short_text",
                guidance: null,
              },
            ],
          },
          {
            name: "Sustain",
            description: "The condition stays in place.",
            questions: [
              {
                prompt:
                  "How reliably is the area reset without a special audit?",
                question_type: "score",
                guidance: null,
              },
              {
                prompt: "What would help this standard stay in place?",
                question_type: "short_text",
                guidance: null,
              },
            ],
          },
        ],
      };

  const changeSummary: string[] = [];
  if (intent === "refine" && base.categories[0]) {
    base.categories[0] = {
      ...base.categories[0],
      name: "Sort and separate",
    };
    changeSummary.push("Renamed the first category to Sort and separate.");
  }

  return {
    message:
      "Here is a draft 5S standard for you to review. Nothing is saved yet.",
    phase: "proposal",
    understanding: {
      ...emptyFiveSUnderstanding(),
      environment: "Packing",
      purpose: "See whether the workplace matches the team's own standard.",
      scoring: "Yes/no and a simple score.",
    },
    questions: [],
    change_summary: changeSummary,
    proposal: base,
  };
}

function gembaEnvelope(
  context: ModuleSetupBuilderContext | null,
  request: string,
) {
  const intent = context?.request.intent ?? "answer";
  const current = context?.current_proposal as
    | {
        name: string;
        description: string;
        sections: Array<{
          name: string;
          description: string | null;
          prompts: Array<{ prompt: string; guidance: string | null }>;
        }>;
      }
    | null
    | undefined;

  if (request.includes("MALFORMED_PROPOSAL_TEST")) {
    return {
      message: "Here is a proposal that cannot be saved.",
      phase: "proposal",
      understanding: emptyGembaUnderstanding(),
      questions: [],
      change_summary: [],
      proposal: {
        name: "Incomplete walk",
        description: "Missing prompts.",
        sections: [{ name: "Safety", description: null, prompts: [] }],
      },
    };
  }

  const shouldPropose =
    intent === "propose" || intent === "refine" || /propos/i.test(request);

  if (!shouldPropose) {
    return {
      message:
        "I can draft observation prompts for your walks. What do you want people to notice?",
      phase: "discovery",
      understanding: {
        ...emptyGembaUnderstanding(),
        purpose: request.slice(0, 180) || null,
      },
      questions: [
        {
          question: "Who is the walk mainly for?",
          suggested_answers: ["Team leaders", "The team", "Both"],
        },
      ],
      change_summary: [],
      proposal: null,
    };
  }

  const base = current
    ? {
        name: current.name,
        description: current.description,
        sections: current.sections.map((section) => ({
          name: section.name,
          description: section.description,
          prompts: section.prompts.map((prompt) => ({
            prompt: prompt.prompt,
            guidance: prompt.guidance,
          })),
        })),
      }
    : {
        name: "Operational Gemba Walk",
        description:
          "A short walk that asks what is visible, where flow stops, and what support the team needs.",
        sections: [
          {
            name: "Safety",
            description: "Conditions that can be seen now.",
            prompts: [
              {
                prompt:
                  "What abnormal or unsafe condition is visible here right now?",
                guidance: null,
              },
            ],
          },
          {
            name: "Flow",
            description: "Where the work is waiting.",
            prompts: [
              {
                prompt: "Where is flow being interrupted?",
                guidance: null,
              },
              {
                prompt: "What support does the team need?",
                guidance: null,
              },
            ],
          },
        ],
      };

  const changeSummary: string[] = [];
  if (intent === "refine" && base.sections[0]) {
    base.sections[0] = { ...base.sections[0], name: "Safety at the workplace" };
    changeSummary.push("Renamed the first section to Safety at the workplace.");
  }

  return {
    message:
      "Here is a draft Gemba definition for you to review. Nothing is saved yet.",
    phase: "proposal",
    understanding: {
      ...emptyGembaUnderstanding(),
      purpose: "See how the work is actually happening.",
      audience: "Team leaders with the team",
    },
    questions: [],
    change_summary: changeSummary,
    proposal: base,
  };
}
