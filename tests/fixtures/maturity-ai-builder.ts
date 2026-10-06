import type { RawMaturityBuilderProposal } from "@/modules/maturity/ai-builder";
import {
  MATURITY_BUILDER_INTERVENTION_KEY,
  MATURITY_BUILDER_PAYLOAD_KIND,
} from "@/modules/maturity/ai-builder/types";

export const BUILDER_SESSION_ID = "11111111-1111-4111-8111-111111111111";

/** Non-uniform hierarchy: criteria [2,1,2], questions [2,1 | 1 | 1,2]. */
export function rawBuilderProposal(): RawMaturityBuilderProposal {
  return {
    name: "Acme Operating Standard",
    description: "How consistently our sites apply our own standards.",
    assessment_scopes: ["site", "area"],
    levels: [
      { name: "Reactive", description: "Informal standards.", guidance: null },
      {
        name: "Developing",
        description: "Standards used in places.",
        guidance: "Check point of use.",
      },
      { name: "Practising", description: "Consistent use.", guidance: "" },
      {
        name: "Sustaining",
        description: "Team-led improvement.",
        guidance: null,
      },
    ],
    pillars: [
      {
        name: "Safe Work",
        description: "Safety and predictability.",
        guidance: null,
        criteria: [
          {
            name: "Standard work",
            description: "Critical tasks follow standards.",
            guidance: "Observe at the point of use.",
            questions: [
              { prompt: "Are critical tasks performed to a visible standard?" },
              { prompt: "Are deviations raised promptly?" },
            ],
          },
          {
            name: "Hazard control",
            description: "Hazards are controlled.",
            guidance: null,
            questions: [{ prompt: "Are hazards reviewed before work starts?" }],
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
            description: "Defects are prevented.",
            guidance: null,
            questions: [{ prompt: "Are quality checks built into each step?" }],
          },
        ],
      },
      {
        name: "Continuous Improvement",
        description: "Problem solving.",
        guidance: "Look for cadence.",
        criteria: [
          {
            name: "Daily improvement",
            description: "Small problems solved daily.",
            guidance: null,
            questions: [{ prompt: "Do teams act on ideas each week?" }],
          },
          {
            name: "Problem solving",
            description: "Root cause for significant problems.",
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

export function storedProposalFromRaw(raw: RawMaturityBuilderProposal) {
  return {
    name: raw.name,
    description: raw.description,
    assessmentScopes: raw.assessment_scopes,
    levels: raw.levels.map((level) => ({
      name: level.name,
      description: level.description,
      guidance: level.guidance?.trim() ? level.guidance : null,
    })),
    pillars: raw.pillars.map((pillar) => ({
      name: pillar.name,
      description: pillar.description,
      guidance: pillar.guidance,
      criteria: pillar.criteria.map((criterion) => ({
        name: criterion.name,
        description: criterion.description,
        guidance: criterion.guidance,
        questions: criterion.questions.map((question) => ({
          prompt: question.prompt,
        })),
      })),
    })),
  };
}

export function understandingPayload(
  purpose: string | null = "Site standards",
) {
  return {
    assessmentPurpose: purpose,
    assessmentScope: "Sites and areas",
    pillars: null,
    levelPhilosophy: null,
    existingStandards: null,
    suggestionAreas: null,
    existingFramework: null,
  };
}

export function assistantPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: MATURITY_BUILDER_PAYLOAD_KIND,
    version: 1,
    response_status: "ok",
    phase: "discovery",
    intent: "answer",
    focus: null,
    understanding: understandingPayload(),
    questions: [],
    change_summary: [],
    proposal_status: "none",
    proposal: null,
    proposal_issues: [],
    ...overrides,
  };
}

export type DetailMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  structured_payload?: Record<string, unknown> | null;
};

export function sessionDetail(
  messages: DetailMessage[],
  sessionOverrides: Record<string, unknown> = {},
) {
  return {
    session: {
      id: BUILDER_SESSION_ID,
      context_type: "coach",
      problem_solving_case_id: null,
      module_key: "maturity",
      intervention_key: MATURITY_BUILDER_INTERVENTION_KEY,
      status: "active",
      ...sessionOverrides,
    },
    messages: messages.map((message) => ({
      ai_run_id: null,
      structured_payload: null,
      ...message,
    })),
    proposals: [],
  };
}

export function userMessage(id: string, text: string, createdAt: string) {
  return {
    id,
    role: "user" as const,
    content: `[Maturity framework builder · context abc]\n\nUser request:\n${text}`,
    created_at: createdAt,
  };
}

export function proposalTurnMessages(): DetailMessage[] {
  return [
    userMessage(
      "a0000000-0000-4000-8000-000000000001",
      "Assess site standards",
      "2026-10-06T10:00:00.000000+00:00",
    ),
    {
      id: "a0000000-0000-4000-8000-000000000002",
      role: "assistant",
      content: "A couple of questions.",
      created_at: "2026-10-06T10:00:01.000000+00:00",
      structured_payload: assistantPayload({
        questions: [
          { question: "Where will you assess?", suggestedAnswers: ["Sites"] },
        ],
      }),
    },
    userMessage(
      "a0000000-0000-4000-8000-000000000003",
      "Sites, four levels",
      "2026-10-06T10:01:00.000000+00:00",
    ),
    {
      id: "a0000000-0000-4000-8000-000000000004",
      role: "assistant",
      content: "Here is a first proposal.",
      created_at: "2026-10-06T10:01:02.000000+00:00",
      structured_payload: assistantPayload({
        phase: "proposal",
        proposal_status: "valid",
        proposal: storedProposalFromRaw(rawBuilderProposal()),
      }),
    },
  ];
}
