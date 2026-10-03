import { randomUUID } from "node:crypto";

import { filterConversationAfterBoundary } from "@/modules/leanai-context/assistant/conversation-boundary";
import { sanitiseExternalWebSources } from "@/modules/leanai-context/assistant/external-sources";
import type { LeanAiAssistantChatMessage } from "@/modules/leanai-context/assistant/types";
import { visibleCoachUserMessage } from "@/modules/leanai-context/coach/session-validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function messagesFromSessionDetail(
  detail: unknown,
  conversationStartedAt: string | null,
): LeanAiAssistantChatMessage[] {
  if (!isRecord(detail) || !Array.isArray(detail.messages)) {
    return [];
  }
  const mapped: LeanAiAssistantChatMessage[] = detail.messages
    .filter(
      (message: unknown) =>
        isRecord(message) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
    .map((message) => {
      const role = message.role as "user" | "assistant";
      const raw = message.content as string;
      const payload = isRecord(message.structured_payload)
        ? message.structured_payload
        : null;
      const assistantText =
        role === "assistant" && typeof payload?.message === "string"
          ? payload.message
          : raw;
      const externalSources =
        role === "assistant"
          ? sanitiseExternalWebSources(payload?.external_sources)
          : [];
      return {
        id: typeof message.id === "string" ? message.id : randomUUID(),
        role,
        content: role === "user" ? visibleCoachUserMessage(raw) : assistantText,
        createdAt:
          typeof message.created_at === "string" ? message.created_at : null,
        source: role === "assistant" ? "ai" : "deterministic",
        ...(externalSources.length > 0 ? { externalSources } : {}),
      };
    });
  return filterConversationAfterBoundary(mapped, conversationStartedAt);
}
