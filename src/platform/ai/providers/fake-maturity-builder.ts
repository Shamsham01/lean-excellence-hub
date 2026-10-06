import {
  extractMaturityBuilderContext,
  type MaturityBuilderContext,
  type RawMaturityBuilderEnvelope,
  type RawMaturityBuilderProposal,
} from "@/modules/maturity/ai-builder";
import type { CreateResponseResult } from "@/platform/ai/types";

/**
 * Deterministic Maturity builder responses for local and CI runs. Triggers:
 * - BROKEN_ENVELOPE_TEST: envelope missing required fields
 * - MALFORMED_PROPOSAL_TEST: proposal that fails validation
 * - TOOL_REQUEST_TEST: provider asks for a tool (must be denied)
 */
export function fakeMaturityBuilderResponse(
  lastUser: string,
): CreateResponseResult {
  const context = extractMaturityBuilderContext(lastUser);
  const request = extractRequest(lastUser);
  const usage = {
    inputTokens: 220,
    outputTokens: 480,
    cachedInputTokens: 0,
    reasoningTokens: 0,
  };

  if (request.includes("BROKEN_ENVELOPE_TEST")) {
    return {
      outputText: "Unstructured reply",
      parsedJson: { message: "Unstructured reply", phase: "proposal" },
      toolCalls: [],
      usage,
    };
  }

  if (request.includes("TOOL_REQUEST_TEST")) {
    return {
      outputText: "",
      toolCalls: [
        {
          id: "fake-builder-tool",
          name: "publish_maturity_model",
          arguments: {},
        },
      ],
      usage,
    };
  }

  const envelope = buildEnvelope(context, request);
  return {
    outputText: envelope.message,
    parsedJson: envelope as unknown as Record<string, unknown>,
    toolCalls: [],
    usage,
  };
}

function extractRequest(lastUser: string): string {
  const marker = "User request:\n";
  const index = lastUser.lastIndexOf(marker);
  return (index >= 0 ? lastUser.slice(index + marker.length) : lastUser).trim();
}

function emptyUnderstanding(): RawMaturityBuilderEnvelope["understanding"] {
  return {
    assessment_purpose: null,
    assessment_scope: null,
    pillars: null,
    level_philosophy: null,
    existing_standards: null,
    suggestion_areas: null,
    existing_framework: null,
  };
}

function understandingFrom(
  context: MaturityBuilderContext | null,
): RawMaturityBuilderEnvelope["understanding"] {
  const prior = context?.understanding_so_far;
  if (!prior) {
    return emptyUnderstanding();
  }
  return {
    assessment_purpose: prior.assessmentPurpose,
    assessment_scope: prior.assessmentScope,
    pillars: prior.pillars,
    level_philosophy: prior.levelPhilosophy,
    existing_standards: prior.existingStandards,
    suggestion_areas: prior.suggestionAreas,
    existing_framework: prior.existingFramework,
  };
}

function buildEnvelope(
  context: MaturityBuilderContext | null,
  request: string,
): RawMaturityBuilderEnvelope {
  const intent = context?.request.intent ?? "answer";
  const current = context?.current_proposal ?? null;
  const understanding = understandingFrom(context);

  if (request.includes("MALFORMED_PROPOSAL_TEST")) {
    return {
      message: "Here is a first proposal.",
      phase: "proposal",
      understanding,
      questions: [],
      change_summary: [],
      proposal: {
        name: "Incomplete framework",
        description: "Missing levels and criteria.",
        assessment_scopes: ["site"],
        levels: [{ name: "Only level", description: "Single", guidance: null }],
        pillars: [
          {
            name: "Empty pillar",
            description: null,
            guidance: null,
            criteria: [],
          },
        ],
      },
    };
  }

  if (current && intent === "refine") {
    return refineEnvelope(
      current,
      context?.request.focus ?? null,
      request,
      understanding,
    );
  }

  if (current && intent === "answer") {
    return {
      message:
        "The proposal stays as it is. Choose Refine on any part you want to change, or create the draft when it looks right.",
      phase: "proposal",
      understanding,
      questions: [],
      change_summary: [],
      proposal: null,
    };
  }

  const firstTurn = !understanding.assessment_purpose;
  if (firstTurn && intent !== "propose") {
    return {
      message:
        "Thanks — that gives me a clear starting point. A couple of quick questions so the framework reflects how you work.",
      phase: "discovery",
      understanding: {
        ...understanding,
        assessment_purpose: request.slice(0, 160),
        suggestion_areas: "LEH can suggest criteria and scored questions.",
      },
      questions: [
        {
          question: "Where will you run assessments?",
          suggested_answers: ["Sites", "Departments", "Areas"],
        },
        {
          question: "How many maturity levels do you want?",
          suggested_answers: ["Four levels", "Five levels"],
        },
      ],
      change_summary: [],
      proposal: null,
    };
  }

  const organisationName = context?.organisation.name ?? "Your organisation";
  return {
    message:
      "Here is a first proposal based on what you told me. Review each part, refine anything that does not fit, then create an editable draft.",
    phase: "proposal",
    understanding: {
      ...understanding,
      assessment_purpose:
        understanding.assessment_purpose ?? request.slice(0, 160),
      assessment_scope: understanding.assessment_scope ?? request.slice(0, 160),
      pillars: "Safety, quality and improvement",
      level_philosophy: "Four levels from reactive to sustaining",
    },
    questions: [],
    change_summary: [],
    proposal: firstProposal(organisationName),
  };
}

function firstProposal(organisationName: string): RawMaturityBuilderProposal {
  return {
    name: `${organisationName} Operational Excellence Framework`.slice(0, 120),
    description:
      "Assesses how consistently our sites apply our own operating standards.",
    assessment_scopes: ["site", "area"],
    levels: [
      {
        name: "Reactive",
        description:
          "Standards are informal and problems are handled as they appear.",
        guidance: null,
      },
      {
        name: "Developing",
        description: "Standards exist and are used in some areas.",
        guidance: "Look for documented standards in daily use.",
      },
      {
        name: "Practising",
        description: "Standards are applied consistently and reviewed.",
        guidance: null,
      },
      {
        name: "Sustaining",
        description: "Teams improve standards themselves and share learning.",
        guidance: "Evidence of team-led improvement over time.",
      },
    ],
    pillars: [
      {
        name: "Safe Work",
        description: "How safely and predictably work is carried out.",
        guidance: null,
        criteria: [
          {
            name: "Standard work",
            description: "Critical tasks follow agreed standards.",
            guidance: "Check standards at the point of use.",
            questions: [
              {
                prompt:
                  "Are critical tasks performed to a current, visible standard?",
              },
              {
                prompt:
                  "Do team members raise deviations from the standard promptly?",
              },
            ],
          },
          {
            name: "Hazard control",
            description: "Hazards are identified and controlled.",
            guidance: null,
            questions: [
              {
                prompt:
                  "Are hazards reviewed and controlled before work starts?",
              },
            ],
          },
        ],
      },
      {
        name: "Quality at Source",
        description: null,
        guidance: null,
        criteria: [
          {
            name: "Built-in quality",
            description: "Defects are prevented rather than inspected out.",
            guidance: null,
            questions: [
              {
                prompt:
                  "Are quality checks built into the process at each step?",
              },
            ],
          },
        ],
      },
      {
        name: "Continuous Improvement",
        description: "How teams find and solve problems.",
        guidance: "Look for improvement cadence and follow-through.",
        criteria: [
          {
            name: "Daily improvement",
            description: "Teams solve small problems every day.",
            guidance: null,
            questions: [
              {
                prompt:
                  "Do teams capture and act on improvement ideas each week?",
              },
            ],
          },
          {
            name: "Problem solving",
            description: "Significant problems are solved to root cause.",
            guidance: null,
            questions: [
              {
                prompt: "Are significant problems investigated to root cause?",
              },
              { prompt: "Are countermeasures checked for effectiveness?" },
            ],
          },
        ],
      },
    ],
  };
}

function requestedName(request: string): string | null {
  const match = request.match(
    /rename(?: it)? to\s+["“]?([^"”\n]+?)["”]?\s*\.?$/i,
  );
  return match?.[1]?.trim().slice(0, 90) || null;
}

function labelName(focus: string | null): string | null {
  const match = focus?.match(/“([^”]+)”/);
  return match?.[1] ?? null;
}

function refineEnvelope(
  current: RawMaturityBuilderProposal,
  focus: string | null,
  request: string,
  understanding: RawMaturityBuilderEnvelope["understanding"],
): RawMaturityBuilderEnvelope {
  const proposal: RawMaturityBuilderProposal = JSON.parse(
    JSON.stringify(current),
  ) as RawMaturityBuilderProposal;
  const newName = requestedName(request);
  const target = labelName(focus);
  const changes: string[] = [];

  if (focus?.startsWith("pillar") && target) {
    const pillar = proposal.pillars.find((entry) => entry.name === target);
    if (pillar) {
      if (newName) {
        pillar.name = newName;
        changes.push(`Renamed pillar “${target}” to “${newName}”.`);
      } else {
        pillar.description = request.slice(0, 200);
        changes.push(`Updated the description of pillar “${target}”.`);
      }
    }
  } else if (focus?.startsWith("criterion") && target) {
    for (const pillar of proposal.pillars) {
      const criterion = pillar.criteria.find((entry) => entry.name === target);
      if (criterion) {
        if (newName) {
          criterion.name = newName;
          changes.push(`Renamed criterion “${target}” to “${newName}”.`);
        } else {
          criterion.description = request.slice(0, 200);
          changes.push(`Updated the description of criterion “${target}”.`);
        }
        break;
      }
    }
  } else if (focus?.includes("levels")) {
    const last = proposal.levels.at(-1);
    if (last) {
      last.guidance = request.slice(0, 200);
      changes.push(`Added guidance to level “${last.name}”.`);
    }
  } else if (newName) {
    proposal.name = newName;
    changes.push(`Renamed the framework to “${newName}”.`);
  } else {
    proposal.description = request.slice(0, 200);
    changes.push("Updated the framework description.");
  }

  return {
    message: changes.length
      ? "I updated the proposal. Everything else is unchanged."
      : "I could not find that part of the proposal, so nothing changed.",
    phase: "proposal",
    understanding,
    questions: [],
    change_summary: changes,
    proposal,
  };
}
