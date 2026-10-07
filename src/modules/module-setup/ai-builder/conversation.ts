import { z } from "zod";

import {
  readTrustedCoachConversation,
  visibleCoachUserMessage,
} from "@/modules/leanai-context/coach/session-validation";

import type {
  ModuleSetupBuilderAssistantTurn,
  ModuleSetupBuilderConversationState,
  ModuleSetupBuilderCurrentProposal,
  ModuleSetupBuilderFocus,
  ModuleSetupBuilderIntent,
  ModuleSetupBuilderTurn,
} from "./types";

const USER_TEXT_MAX = 2000;
const ASSISTANT_TEXT_MAX = 2000;

const storedPayloadSchema = z.object({
  kind: z.string(),
  version: z.literal(1),
  response_status: z.enum(["ok", "invalid_response"]),
  phase: z.enum(["discovery", "proposal"]),
  intent: z.enum(["answer", "propose", "refine"]),
  focus: z.unknown(),
  understanding: z.record(z.string(), z.string().nullable()).nullable(),
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

export function parseModuleSetupBuilderFocus(
  value: unknown,
): ModuleSetupBuilderFocus | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { kind?: unknown; sectionIndex?: unknown };
  if (record.kind === "whole") {
    return { kind: "whole" };
  }
  if (
    record.kind === "section" &&
    typeof record.sectionIndex === "number" &&
    Number.isInteger(record.sectionIndex) &&
    record.sectionIndex >= 0
  ) {
    return { kind: "section", sectionIndex: record.sectionIndex };
  }
  return null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deriveModuleSetupBuilderConversation<TProposal>(
  detail: unknown,
  expected: {
    sessionId: string;
    conversationStartedAt: string | null;
    moduleKey: string;
    interventionKey: string;
    payloadKind: string;
  },
  revalidateProposal: (value: unknown) => TProposal | null,
  counts: (proposal: TProposal) => { sections: number; items: number },
): ModuleSetupBuilderConversationState<TProposal> | null {
  const trusted = readTrustedCoachConversation(
    detail,
    expected.conversationStartedAt
      ? {
          sessionId: expected.sessionId,
          moduleKey: expected.moduleKey,
          interventionKey: expected.interventionKey,
          conversationStartedAt: expected.conversationStartedAt,
        }
      : {
          sessionId: expected.sessionId,
          moduleKey: expected.moduleKey,
          interventionKey: expected.interventionKey,
        },
  );
  if (!trusted || !isRecord(detail) || !Array.isArray(detail.messages)) {
    return null;
  }

  const turns: ModuleSetupBuilderTurn[] = [];
  let understanding: Record<string, string | null> | null = null;
  let currentProposal: ModuleSetupBuilderCurrentProposal<TProposal> | null =
    null;
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
    if (!payload.success || payload.data.kind !== expected.payloadKind) {
      turns.push(unreadableAssistantTurn(id, createdAt, content));
      continue;
    }

    const stored = payload.data;
    if (stored.understanding) {
      understanding = stored.understanding;
    }

    let proposalStatus = stored.proposal_status;
    let proposalIssues = stored.proposal_issues;
    let proposalRevision: number | null = null;
    if (stored.proposal_status === "valid") {
      const proposal = revalidateProposal(stored.proposal);
      if (proposal) {
        revision += 1;
        proposalRevision = revision;
        const proposalCounts = counts(proposal);
        currentProposal = {
          messageId: id,
          revision,
          createdAt,
          proposal,
          sectionCount: proposalCounts.sections,
          itemCount: proposalCounts.items,
          changeSummary: stored.change_summary,
        };
      } else {
        proposalStatus = "invalid";
        proposalIssues = [
          "The stored proposal no longer passes validation. Ask LeanAI to regenerate it.",
        ];
      }
    }

    turns.push({
      id,
      role: "assistant",
      message: content.trim().slice(0, ASSISTANT_TEXT_MAX),
      createdAt,
      responseStatus: stored.response_status,
      phase: stored.phase,
      intent: stored.intent,
      focus: parseModuleSetupBuilderFocus(stored.focus),
      questions: stored.questions,
      changeSummary: stored.change_summary,
      proposalStatus,
      proposalIssues,
      proposalRevision,
    });
  }

  const lastAssistant = [...turns]
    .reverse()
    .find(
      (turn): turn is ModuleSetupBuilderAssistantTurn =>
        turn.role === "assistant",
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
): ModuleSetupBuilderAssistantTurn {
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

export function moduleSetupBuilderHistory<TProposal>(
  state: ModuleSetupBuilderConversationState<TProposal> | null,
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

export function nextModuleSetupBuilderBoundary(
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

export function resolveModuleSetupBuilderFocus(
  focus: unknown,
  sectionCount: number,
): { focus: ModuleSetupBuilderFocus; label: string } | null {
  const parsed = parseModuleSetupBuilderFocus(focus);
  if (!parsed) {
    return null;
  }
  if (parsed.kind === "whole") {
    return { focus: parsed, label: "the whole draft" };
  }
  if (parsed.sectionIndex >= sectionCount) {
    return null;
  }
  return {
    focus: parsed,
    label: `section ${parsed.sectionIndex + 1}`,
  };
}

export function buildModuleSetupStoredPayload(input: {
  kind: string;
  responseStatus: "ok" | "invalid_response";
  phase: "discovery" | "proposal";
  intent: ModuleSetupBuilderIntent;
  focus: ModuleSetupBuilderFocus | null;
  understanding: Record<string, string | null> | null;
  questions: Array<{ question: string; suggestedAnswers: string[] }>;
  changeSummary: string[];
  proposalStatus: "none" | "valid" | "invalid";
  proposal: unknown;
  proposalIssues: string[];
}) {
  return {
    kind: input.kind,
    version: 1 as const,
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
