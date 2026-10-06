import { z } from "zod";

import {
  readTrustedCoachConversation,
  visibleCoachUserMessage,
} from "@/modules/leanai-context/coach/session-validation";

import {
  maturityBuilderProposalCounts,
  parseMaturityBuilderFocus,
  revalidateStoredMaturityBuilderProposal,
} from "./proposal";
import {
  MATURITY_BUILDER_INTERVENTION_KEY,
  MATURITY_BUILDER_MODULE_KEY,
  MATURITY_BUILDER_PAYLOAD_KIND,
  MATURITY_BUILDER_PAYLOAD_VERSION,
  type MaturityBuilderAssistantTurn,
  type MaturityBuilderConversationState,
  type MaturityBuilderCurrentProposal,
  type MaturityBuilderDiscoveryQuestion,
  type MaturityBuilderFocus,
  type MaturityBuilderIntent,
  type MaturityBuilderProposal,
  type MaturityBuilderProposalStatus,
  type MaturityBuilderStoredPayload,
  type MaturityBuilderTurn,
  type MaturityBuilderUnderstanding,
} from "./types";

const USER_TEXT_MAX = 2000;
const ASSISTANT_TEXT_MAX = 2000;

const understandingSchema = z.object({
  assessmentPurpose: z.string().nullable(),
  assessmentScope: z.string().nullable(),
  pillars: z.string().nullable(),
  levelPhilosophy: z.string().nullable(),
  existingStandards: z.string().nullable(),
  suggestionAreas: z.string().nullable(),
  existingFramework: z.string().nullable(),
});

const storedPayloadSchema = z.object({
  kind: z.literal(MATURITY_BUILDER_PAYLOAD_KIND),
  version: z.literal(MATURITY_BUILDER_PAYLOAD_VERSION),
  response_status: z.enum(["ok", "invalid_response"]),
  phase: z.enum(["discovery", "proposal"]),
  intent: z.enum(["answer", "propose", "refine"]),
  focus: z.unknown(),
  understanding: understandingSchema.nullable(),
  questions: z
    .array(
      z.object({
        question: z.string(),
        suggestedAnswers: z.array(z.string()),
      }),
    )
    .max(3),
  change_summary: z.array(z.string()).max(6),
  proposal_status: z.enum(["none", "valid", "invalid"]),
  proposal: z.unknown(),
  proposal_issues: z.array(z.string()).max(12),
});

export function buildMaturityBuilderStoredPayload(input: {
  responseStatus: "ok" | "invalid_response";
  phase: "discovery" | "proposal";
  intent: MaturityBuilderIntent;
  focus: MaturityBuilderFocus | null;
  understanding: MaturityBuilderUnderstanding | null;
  questions: MaturityBuilderDiscoveryQuestion[];
  changeSummary: string[];
  proposalStatus: MaturityBuilderProposalStatus;
  proposal: MaturityBuilderProposal | null;
  proposalIssues: string[];
}): MaturityBuilderStoredPayload {
  return {
    kind: MATURITY_BUILDER_PAYLOAD_KIND,
    version: MATURITY_BUILDER_PAYLOAD_VERSION,
    response_status: input.responseStatus,
    phase: input.phase,
    intent: input.intent,
    focus: input.focus,
    understanding: input.understanding,
    questions: input.questions,
    change_summary: input.changeSummary,
    proposal_status: input.proposalStatus,
    proposal: input.proposalStatus === "valid" ? input.proposal : null,
    proposal_issues: input.proposalIssues,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inBoundary(createdAt: unknown, boundary: string | null): boolean {
  if (!boundary) {
    return true;
  }
  if (typeof createdAt !== "string") {
    return false;
  }
  const created = Date.parse(createdAt);
  const started = Date.parse(boundary);
  return Number.isFinite(created) && Number.isFinite(started)
    ? created >= started
    : false;
}

/**
 * Derive builder state from a trusted `get_ai_session_detail` payload. The
 * session binding is verified first; a payload for another session, module,
 * intervention or context type yields null.
 */
export function deriveMaturityBuilderConversation(
  detail: unknown,
  expected: { sessionId: string; conversationStartedAt: string | null },
): MaturityBuilderConversationState | null {
  const trusted = readTrustedCoachConversation(
    detail,
    expected.conversationStartedAt
      ? {
          sessionId: expected.sessionId,
          moduleKey: MATURITY_BUILDER_MODULE_KEY,
          interventionKey: MATURITY_BUILDER_INTERVENTION_KEY,
          conversationStartedAt: expected.conversationStartedAt,
        }
      : {
          sessionId: expected.sessionId,
          moduleKey: MATURITY_BUILDER_MODULE_KEY,
          interventionKey: MATURITY_BUILDER_INTERVENTION_KEY,
        },
  );
  if (!trusted || !isRecord(detail) || !Array.isArray(detail.messages)) {
    return null;
  }

  const turns: MaturityBuilderTurn[] = [];
  let understanding: MaturityBuilderUnderstanding | null = null;
  let currentProposal: MaturityBuilderCurrentProposal | null = null;
  let revision = 0;
  let latestMessageAt: string | null = null;

  for (const message of detail.messages) {
    if (!isRecord(message)) {
      continue;
    }
    if (typeof message.created_at === "string") {
      latestMessageAt = message.created_at;
    }
    if (!inBoundary(message.created_at, expected.conversationStartedAt)) {
      continue;
    }
    const id = typeof message.id === "string" ? message.id : null;
    const createdAt =
      typeof message.created_at === "string" ? message.created_at : null;
    const content = typeof message.content === "string" ? message.content : "";
    if (!id || !createdAt) {
      continue;
    }

    if (message.role === "user") {
      const text = visibleCoachUserMessage(content).trim();
      if (text) {
        turns.push({
          id,
          role: "user",
          text: text.slice(0, USER_TEXT_MAX),
          createdAt,
        });
      }
      continue;
    }

    if (message.role !== "assistant") {
      continue;
    }
    const payload = storedPayloadSchema.safeParse(message.structured_payload);
    if (!payload.success) {
      turns.push(unreadableAssistantTurn(id, createdAt, content));
      continue;
    }
    const stored = payload.data;
    if (stored.understanding) {
      understanding = stored.understanding;
    }

    let proposalStatus: MaturityBuilderProposalStatus = stored.proposal_status;
    let proposalIssues = stored.proposal_issues;
    let proposalRevision: number | null = null;
    if (stored.proposal_status === "valid") {
      const proposal = revalidateStoredMaturityBuilderProposal(stored.proposal);
      if (proposal) {
        revision += 1;
        proposalRevision = revision;
        currentProposal = {
          messageId: id,
          revision,
          createdAt,
          proposal,
          counts: maturityBuilderProposalCounts(proposal),
          changeSummary: stored.change_summary,
        };
      } else {
        proposalStatus = "invalid";
        proposalIssues = [
          "The stored proposal no longer passes validation. Ask LeanAI to regenerate it.",
        ];
      }
    }

    const turn: MaturityBuilderAssistantTurn = {
      id,
      role: "assistant",
      message: content.trim().slice(0, ASSISTANT_TEXT_MAX),
      createdAt,
      responseStatus: stored.response_status,
      phase: stored.phase,
      intent: stored.intent,
      focus: parseMaturityBuilderFocus(stored.focus),
      questions: stored.questions,
      changeSummary: stored.change_summary,
      proposalStatus,
      proposalIssues,
      proposalRevision,
    };
    turns.push(turn);
  }

  const lastAssistant = [...turns]
    .reverse()
    .find(
      (turn): turn is MaturityBuilderAssistantTurn => turn.role === "assistant",
    );
  const lastTurn = turns.at(-1);

  return {
    sessionId: expected.sessionId,
    turns,
    understanding,
    pendingQuestions:
      lastAssistant && lastAssistant.responseStatus === "ok"
        ? lastAssistant.questions
        : [],
    currentProposal,
    lastTurnInvalid: Boolean(
      lastAssistant &&
      lastTurn?.id === lastAssistant.id &&
      (lastAssistant.responseStatus === "invalid_response" ||
        lastAssistant.proposalStatus === "invalid"),
    ),
    userTurnCount: trusted.priorTurnCount,
    latestMessageAt,
  };
}

function unreadableAssistantTurn(
  id: string,
  createdAt: string,
  content: string,
): MaturityBuilderAssistantTurn {
  return {
    id,
    role: "assistant",
    message:
      content.trim().slice(0, ASSISTANT_TEXT_MAX) ||
      "LeanAI could not read this reply.",
    createdAt,
    responseStatus: "invalid_response",
    phase: "discovery",
    intent: "answer",
    focus: null,
    questions: [],
    changeSummary: [],
    proposalStatus: "none",
    proposalIssues: [],
    proposalRevision: null,
  };
}

/** Model-facing history: visible user text and assistant replies only. */
export function maturityBuilderHistory(
  state: MaturityBuilderConversationState | null,
  window: number,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!state) {
    return [];
  }
  return state.turns
    .map((turn) =>
      turn.role === "user"
        ? { role: "user" as const, content: turn.text }
        : { role: "assistant" as const, content: turn.message },
    )
    .filter((entry) => entry.content.trim().length > 0)
    .slice(-window);
}

/** Boundary just after the newest stored message, using database timestamps. */
export function nextMaturityBuilderBoundary(
  latestMessageAt: string | null,
): string | null {
  if (!latestMessageAt) {
    return null;
  }
  const ms = Date.parse(latestMessageAt);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms + 1).toISOString();
}
